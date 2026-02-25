import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs } from "../setup";
import { createAndFundAgreement } from "../fixtures";

// local helper to create agreements with short duration for testing resolution logic
const createAndFundShortAgreement = async () => {
  return createAndFundAgreement({
    ...BASE_PARAMS,
    duration: new anchor.BN(1), // 1 sec duration for quick expiry
  });
};

describe("===== Resolve_agreement =====", () => {

  it("Pays provider on successful completion", async () => {
    const { config, agreementState, vault } = await createAndFundShortAgreement();

    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx1 = await program.methods
      .processTelemetry(
        5.0,
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

    await provider.connection.confirmTransaction(tx1, "confirmed");

    await new Promise(resolve => setTimeout(resolve, 3000));

    const providerBalanceBefore = await provider.connection.getBalance(providerKp.publicKey);

    const tx2 = await program.methods
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

    await provider.connection.confirmTransaction(tx2, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAfter.status).to.deep.equal({ completed: {} });
    expect(stateAfter.resolvedAt.toNumber()).to.be.greaterThan(0);

    const providerBalanceAfter = await provider.connection.getBalance(providerKp.publicKey);
    const received = providerBalanceAfter - providerBalanceBefore;
    expect(received.toString()).to.equal(configAccount.amount.toString());

    console.log()
    console.log("✅ Provider received payout on success");
    console.log("   Amount:", received, "lamports");
  });

  it("Refunds payer on threshold breach", async () => {
    const { config, agreementState, vault } = await createAndFundShortAgreement();

    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx1 = await program.methods
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

    await provider.connection.confirmTransaction(tx1, "confirmed");

    await new Promise(resolve => setTimeout(resolve, 3000));


    const payerBalanceBefore = await provider.connection.getBalance(payer.publicKey);

    const tx2 = await program.methods
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

    await provider.connection.confirmTransaction(tx2, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAfter.status).to.deep.equal({ refunded: {} });

    const payerBalanceAfter = await provider.connection.getBalance(payer.publicKey);
    const balanceDiff = payerBalanceAfter - payerBalanceBefore;
    expect(balanceDiff).to.be.greaterThan(configAccount.amount.toNumber() * 0.99);

    console.log()
    console.log("✅ Payer received refund on breach");
    console.log("   Refund amount:", balanceDiff, "lamports");
  });

  it("Fails if agreement not yet expired", async () => {
    // long duration agreement that won't expire during test
    const { config, agreementState, vault } = await createAndFundAgreement();

    try {
      await program.methods
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

      expect.fail("Should have rejected early resolution");
    } catch (err: any) {
      expect(err).to.exist;
      console.log("✅ Correctly rejected early resolution");
    }
  });

  it("Fails if already resolved", async () => {
    const { config, agreementState, vault } = await createAndFundShortAgreement();

    await new Promise(resolve => setTimeout(resolve, 3000));

    // first resolution
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

    // Second resolution attempt, should fail
    try {
      await program.methods
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

      expect.fail("Should have rejected double resolution");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected double resolution");
    }
  });

  it("Vault balance is zero after resolution", async () => {
    const { config, agreementState, vault } = await createAndFundShortAgreement();

    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    const vaultBalanceBefore = await provider.connection.getBalance(vault);
    expect(vaultBalanceBefore.toString()).to.equal(configAccount.amount.toString());

    await new Promise(resolve => setTimeout(resolve, 3000));

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

    const vaultBalanceAfter = await provider.connection.getBalance(vault);
    expect(vaultBalanceAfter).to.equal(0);

    console.log()
    console.log("✅ Vault emptied after resolution");
    console.log("   Vault balance after resolution:", vaultBalanceAfter, "lamports");
  });

});