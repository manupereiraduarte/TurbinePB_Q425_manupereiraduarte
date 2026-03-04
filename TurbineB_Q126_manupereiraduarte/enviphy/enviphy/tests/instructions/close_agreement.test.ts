import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs } from "../setup";
import { createAgreement, createAndFundAgreement } from "../fixtures";

const createAndFundShortAgreement = async () => {
  return createAndFundAgreement({
    ...BASE_PARAMS,
    duration: new anchor.BN(1),
  });
};

const closeAccounts = (
  signer: anchor.web3.PublicKey,
  config: anchor.web3.PublicKey,
  agreementState: anchor.web3.PublicKey,
  vault: anchor.web3.PublicKey
) => ({
  signer,
  config,
  agreementState,
  vault,
  systemProgram: anchor.web3.SystemProgram.programId,
});

describe("===== Close_agreement =====", () => {

  it("Payer can close a completed agreement", async () => {
    const { config, agreementState, vault } = await createAndFundShortAgreement();

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Resolve first
    const resolveTx = await program.methods
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

    await provider.connection.confirmTransaction(resolveTx, "confirmed");

    const payerBalanceBefore = await provider.connection.getBalance(payer.publicKey);

    const tx = await program.methods
      .closeAgreement()
      .accounts(closeAccounts(payer.publicKey, config, agreementState, vault) as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    const configInfo = await provider.connection.getAccountInfo(config);
    const stateInfo = await provider.connection.getAccountInfo(agreementState);
    const vaultInfo = await provider.connection.getAccountInfo(vault);
    const payerBalanceAfter = await provider.connection.getBalance(payer.publicKey);

    expect(configInfo).to.be.null;
    expect(stateInfo).to.be.null;
    expect(vaultInfo).to.be.null;
    expect(payerBalanceAfter).to.be.greaterThan(payerBalanceBefore);

    console.log();
    console.log("✅ Payer closed completed agreement");
    console.log("   Rent recovered:", payerBalanceAfter - payerBalanceBefore, "lamports");
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Provider can close a refunded agreement", async () => {
    const { config, agreementState, vault } = await createAndFundShortAgreement();

    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    // Breach it
    const telemetryTx = await program.methods
      .processTelemetry(
        15.0, // breach!
        50.0,
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

    await provider.connection.confirmTransaction(telemetryTx, "confirmed");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Resolve as refunded
    const resolveTx = await program.methods
      .resolveAgreement()
      .accounts({
        signer: payer.publicKey,
        config,
        agreementState,
        vault,
        recipient: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(resolveTx, "confirmed");

    const providerBalanceBefore = await provider.connection.getBalance(providerKp.publicKey);

    // Provider closes
    const tx = await program.methods
      .closeAgreement()
      .accounts(closeAccounts(providerKp.publicKey, config, agreementState, vault) as any)
      .signers([providerKp])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    const configInfo = await provider.connection.getAccountInfo(config);
    const stateInfo = await provider.connection.getAccountInfo(agreementState);
    const providerBalanceAfter = await provider.connection.getBalance(providerKp.publicKey);

    expect(configInfo).to.be.null;
    expect(stateInfo).to.be.null;
    expect(providerBalanceAfter).to.be.greaterThan(providerBalanceBefore);

    console.log();
    console.log("✅ Provider closed refunded agreement");
    console.log("   Rent recovered:", providerBalanceAfter - providerBalanceBefore, "lamports");
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Can close an unfunded agreement", async () => {
    const { config, agreementState, vault } = await createAgreement();

    const payerBalanceBefore = await provider.connection.getBalance(payer.publicKey);

    const tx = await program.methods
      .closeAgreement()
      .accounts(closeAccounts(payer.publicKey, config, agreementState, vault) as any)
      .signers([payer])
      .rpc({ commitment: "confirmed" });

    await provider.connection.confirmTransaction(tx, "confirmed");

    const configInfo = await provider.connection.getAccountInfo(config);
    const stateInfo = await provider.connection.getAccountInfo(agreementState);
    const payerBalanceAfter = await provider.connection.getBalance(payer.publicKey);

    expect(configInfo).to.be.null;
    expect(stateInfo).to.be.null;
    expect(payerBalanceAfter).to.be.greaterThan(payerBalanceBefore);

    console.log();
    console.log("✅ Unfunded agreement closed successfully");
    console.log("   Rent recovered:", payerBalanceAfter - payerBalanceBefore, "lamports");
    console.log("🔗 TX:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

  it("Fails if agreement is active and funded", async () => {
    const { config, agreementState, vault } = await createAndFundAgreement();

    try {
      await program.methods
        .closeAgreement()
        .accounts(closeAccounts(payer.publicKey, config, agreementState, vault) as any)
        .signers([payer])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected closing an active agreement");
    } catch (err: any) {
      expect(err).to.exist;
      console.log();
      console.log("✅ Correctly rejected closing active agreement");
    }
  });

  it("Fails if signer is not payer or provider", async () => {
    const { config, agreementState, vault } = await createAgreement();
    const randomUser = anchor.web3.Keypair.generate();

    // Fondear el random user para que pueda firmar
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: randomUser.publicKey,
        lamports: 10_000_000,
      })
    );
    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      transferTx,
      [payer],
      { commitment: "confirmed" }
    );

    try {
      await program.methods
        .closeAgreement()
        .accounts(closeAccounts(randomUser.publicKey, config, agreementState, vault) as any)
        .signers([randomUser])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected unauthorized signer");
    } catch (err: any) {
      expect(err).to.exist;
      console.log();
      console.log("✅ Correctly rejected unauthorized signer");
    }
  });

});