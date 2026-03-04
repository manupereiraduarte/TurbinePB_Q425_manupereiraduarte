import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs } from "../setup";

// this test suite walks through the full lifecycle of an agreement in a happy path scenario, validating each step along the way. 
// It serves as an end-to-end integration test to ensure all components work together as expected.
// the other ones focus on individual instructions and edge cases, while this one simulates a real-world flow from initialization to resolution. 
// It also provides a clear narrative of how the system is intended to be used.
describe("===== Happy Path: Full Agreement Lifecycle =====", () => {

  let config: anchor.web3.PublicKey;
  let agreementState: anchor.web3.PublicKey;
  let vault: anchor.web3.PublicKey;
  let createdAt: anchor.BN;
  let configAccount: any;

  it("Step 1: Initialize agreement", async () => {
    createdAt = getTimestamp();
    const pdas = getPDAs(payer.publicKey, providerKp.publicKey, createdAt);
    config = pdas.config;
    agreementState = pdas.agreementState;
    vault = pdas.vault;

    const tx = await program.methods
      .initializeAgreement(
        BASE_PARAMS.tempMin,
        BASE_PARAMS.tempMax,
        BASE_PARAMS.humidityMin,
        BASE_PARAMS.humidityMax,
        new anchor.BN(10), // 10 segundos para que expire rápido
        BASE_PARAMS.gracePeriod,
        BASE_PARAMS.amount,
        payer.publicKey,
        providerKp.publicKey,
        createdAt,
      )
      .accounts({
        signer: payer.publicKey,
        config,
        agreementState,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    const stateAccount = await program.account.agreementState.fetch(agreementState, "confirmed");

    expect(configAccount.payer.toString()).to.equal(payer.publicKey.toString());
    expect(configAccount.provider.toString()).to.equal(providerKp.publicKey.toString());
    expect(stateAccount.isFunded).to.equal(false);
    expect(stateAccount.status).to.deep.equal({ active: {} });

    console.log();
    console.log("✅ Step 1: Agreement initialized");
    console.log("   Temp range:", configAccount.tempMin, "C° -", configAccount.tempMax, "C°" );
    console.log("   Humidity range:", configAccount.humidityMin, "% -", configAccount.humidityMax, "%");
    console.log("   duration:", configAccount.duration.toString(), "seconds");
    console.log("   amount:", configAccount.amount.toString(), "lamports");
    console.log("   Config PDA:", config.toBase58());
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Step 2: Deposit funds", async () => {
    configAccount = await program.account.agreementConfig.fetch(config, "confirmed");

    const tx = await program.methods
      .depositFunds()
      .accounts({
        payer: payer.publicKey,
        config,
        agreementState,
        vault,
        feeRecipient: configAccount.feeRecipient,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAccount = await program.account.agreementState.fetch(agreementState, "confirmed");
    const vaultBalance = await provider.connection.getBalance(vault);

    expect(stateAccount.isFunded).to.equal(true);
    expect(stateAccount.startTime.toNumber()).to.be.greaterThan(0);
    expect(vaultBalance.toString()).to.equal(configAccount.amount.toString());

    console.log();
    console.log("✅ Step 2: Funds deposited");
    console.log("   Vault balance:", vaultBalance, "lamports");
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Step 3: Provider sends valid telemetry", async () => {
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx = await program.methods
      .processTelemetry(
        5.0,  // dentro del rango 2-8°C
        50.0, // dentro del rango 40-60%
        new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 10)
      )
      .accounts({
        provider: providerKp.publicKey,
        config,
        agreementState,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([providerKp])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");

    expect(stateAfter.status).to.deep.equal({ active: {} });
    expect(stateAfter.lastTemperature).to.equal(5.0);
    expect(stateAfter.lastHumidity).to.equal(50.0);
    expect(stateAfter.measurementCount.toNumber()).to.equal(1);

    console.log();
    console.log("✅ Step 3: Valid telemetry accepted");
    console.log("   Temperature:", stateAfter.lastTemperature, "°C");
    console.log("   Humidity:", stateAfter.lastHumidity, "%");
    console.log("   Measurements:", stateAfter.measurementCount.toNumber());
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Step 4: Agreement expires and provider gets paid", async () => {
    // Esperar que expire (10 segundos de duration + margen)
    console.log();
    console.log("   Waiting for agreement to expire...");
    await new Promise(resolve => setTimeout(resolve, 10000)); 

    const providerBalanceBefore = await provider.connection.getBalance(providerKp.publicKey);

    const tx = await program.methods
      .resolveAgreement()
      .accounts({
        signer: payer.publicKey,
        config,
        agreementState,
        vault,
        recipient: providerKp.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");
    const providerBalanceAfter = await provider.connection.getBalance(providerKp.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vault);
    const received = providerBalanceAfter - providerBalanceBefore;

    expect(stateAfter.status).to.deep.equal({ completed: {} });
    expect(stateAfter.resolvedAt.toNumber()).to.be.greaterThan(0);
    expect(vaultBalanceAfter).to.equal(0);
    expect(received.toString()).to.equal(configAccount.amount.toString());
    
    console.log();
    console.log("✅ Step 4: Agreement resolved successfully");
    console.log("   Status: Completed");
    console.log("   Provider received:", received, "lamports");
    console.log("   Vault balance:", vaultBalanceAfter, "lamports");
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Step 5: Close completed agreement", async () => {
    const payerBalanceBefore = await provider.connection.getBalance(payer.publicKey);

    const tx = await program.methods
      .closeAgreement()
      .accounts({
        signer: payer.publicKey,
        config,
        agreementState,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    // Verificar que las cuentas fueron cerradas
    const configInfo = await provider.connection.getAccountInfo(config);
    const stateInfo = await provider.connection.getAccountInfo(agreementState);
    const vaultInfo = await provider.connection.getAccountInfo(vault);
    const payerBalanceAfter = await provider.connection.getBalance(payer.publicKey);

    expect(configInfo).to.be.null;
    expect(stateInfo).to.be.null;
    expect(vaultInfo).to.be.null;
    expect(payerBalanceAfter).to.be.greaterThan(payerBalanceBefore);

    console.log();
    console.log("✅ Step 5: Agreement closed successfully");
    console.log("   Rent recovered:", payerBalanceAfter - payerBalanceBefore, "lamports");
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

});