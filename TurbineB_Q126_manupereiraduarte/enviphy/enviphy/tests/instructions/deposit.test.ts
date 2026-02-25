import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs, airdrop } from "../setup";
import { createAgreement } from "../fixtures";

describe("===== Deposit_funds =====", () => {

  it("Payer deposits funds correctly", async () => {
    const { config, agreementState, vault } = await createAgreement();

    await program.methods
      .depositFunds()
      .accounts({
        payer: payer.publicKey,
        config,
        agreementState,
        vault,
        feeRecipient: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    const stateAccount = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAccount.isFunded).to.equal(true);
    expect(stateAccount.startTime.toNumber()).to.be.greaterThan(0);
    expect(stateAccount.lastHeartbeat.toNumber()).to.be.greaterThan(0);

    const vaultBalance = await provider.connection.getBalance(vault);
    expect(vaultBalance.toString()).to.equal(BASE_PARAMS.amount.toString());

    console.log()
    console.log("✅ Payer deposited funds correctly");
    console.log("   Vault balance:", vaultBalance);
    console.log("   Start time:", stateAccount.startTime.toString());
  });

  it("Fails when trying to deposit twice", async () => {
    const { config, agreementState, vault } = await createAgreement();

    // first deposit
    await program.methods
      .depositFunds()
      .accounts({
        payer: payer.publicKey,
        config,
        agreementState,
        vault,
        feeRecipient: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    try {
      // Second deposit, must fail
      await program.methods
        .depositFunds()
        .accounts({
          payer: payer.publicKey,
          config,
          agreementState,
          vault,
          feeRecipient: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([payer])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have thrown AlreadyFunded");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected double deposit");
    }
  });

  it("Fails when non-payer tries to deposit", async () => {
    const { config, agreementState, vault } = await createAgreement();

    try {
      await program.methods
        .depositFunds()
        .accounts({
          payer: providerKp.publicKey, // provider tries to deposit
          config,
          agreementState,
          vault,
          feeRecipient: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have thrown UnauthorizedPayer");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected non-payer deposit");
    }
  });

  it("Transfers correct amounts to vault and fee recipient", async () => {
    const newPayer = anchor.web3.Keypair.generate();
    const feeRecipientKp = anchor.web3.Keypair.generate();
    await airdrop(newPayer.publicKey);
    await airdrop(feeRecipientKp.publicKey);

    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      newPayer.publicKey,
      providerKp.publicKey,
      createdAt
    );

    await program.methods
      .initializeAgreement(
        BASE_PARAMS.tempMin,
        BASE_PARAMS.tempMax,
        BASE_PARAMS.humidityMin,
        BASE_PARAMS.humidityMax,
        BASE_PARAMS.duration,
        BASE_PARAMS.gracePeriod,
        BASE_PARAMS.amount,
        newPayer.publicKey,
        providerKp.publicKey,
        createdAt,
      )
      .accounts({
        signer: feeRecipientKp.publicKey,
        config,
        agreementState,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([feeRecipientKp])
      .rpc({ commitment: "confirmed" });

    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    const feeRecipient = configAccount.feeRecipient;
    const feeRecipientBalanceBefore = await provider.connection.getBalance(feeRecipient);

    await program.methods
      .depositFunds()
      .accounts({
        payer: newPayer.publicKey,
        config,
        agreementState,
        vault,
        feeRecipient,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([newPayer])
      .rpc({ commitment: "confirmed" });

    const vaultBalance = await provider.connection.getBalance(vault);
    expect(vaultBalance.toString()).to.equal(configAccount.amount.toString());

    const feeRecipientBalanceAfter = await provider.connection.getBalance(feeRecipient);
    const feeReceived = feeRecipientBalanceAfter - feeRecipientBalanceBefore;
    expect(feeReceived.toString()).to.equal(configAccount.protocolFee.toString());

    console.log()
    console.log("✅ Correct amounts transferred");
    console.log("   Agreement amount:", configAccount.amount.toString(), "lamports");
    console.log("   Vault received:", vaultBalance, "lamports");
    console.log("   Fee received:", feeReceived, "lamports");
  });

  it("Sets start_time and last_heartbeat correctly", async () => {
    const { config, agreementState, vault } = await createAgreement();
    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");

    const stateBeforeDeposit = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateBeforeDeposit.isFunded).to.equal(false);
    expect(stateBeforeDeposit.startTime.toNumber()).to.equal(0);
    expect(stateBeforeDeposit.lastHeartbeat.toNumber()).to.equal(0);

    await program.methods
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

    const stateAccount = await program.account.agreementState.fetch(agreementState, "confirmed");
    const startTime = stateAccount.startTime.toNumber();
    const lastHeartbeat = stateAccount.lastHeartbeat.toNumber();

    expect(startTime).to.be.greaterThan(0);
    expect(lastHeartbeat).to.be.greaterThan(0);
    expect(lastHeartbeat).to.equal(startTime);
    expect(startTime).to.be.greaterThan(1577836800);  // 1 Jan 2020
    expect(startTime).to.be.lessThan(4102444800);     // 1 Jan 2100
    expect(stateAccount.isFunded).to.equal(true);

    console.log()
    console.log("✅ Timestamps set correctly");
    console.log("   Start time:", startTime);
    console.log("   Last heartbeat:", lastHeartbeat);
    console.log("   is_funded:", stateAccount.isFunded);
  });

  it("Emits FundsDeposited event", async () => {
    const { config, agreementState, vault } = await createAgreement();
    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");

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

    expect(tx).to.be.a("string");
    console.log()
    console.log("✅ FundsDeposited event emitted");
  });

});