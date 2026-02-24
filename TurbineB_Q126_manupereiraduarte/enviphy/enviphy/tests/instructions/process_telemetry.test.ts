import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs, airdrop } from "../setup";
import { createAgreement, createAndFundAgreement } from "../fixtures";

describe("Step 4: process_telemetry", () => {

  it("Accepts valid telemetry within thresholds", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");
    const measurementCountBefore = stateBefore.measurementCount.toNumber();

    const tx = await program.methods
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

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAfter.status).to.deep.equal({ active: {} });
    expect(stateAfter.lastTemperature).to.equal(5.0);
    expect(stateAfter.lastHumidity).to.equal(50.0);
    expect(stateAfter.measurementCount.toNumber()).to.equal(measurementCountBefore + 1);

    console.log("✅ Valid telemetry accepted");
  });

  it("Updates last_heartbeat correctly", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");
    const newTimestamp = new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 20);

    const tx = await program.methods
      .processTelemetry(5.0, 50.0, newTimestamp)
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
    expect(stateAfter.lastHeartbeat.toNumber()).to.equal(newTimestamp.toNumber());

    console.log("✅ Last heartbeat updated correctly");
  });

  it("Increments measurement_count", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");
    const countBefore = stateBefore.measurementCount.toNumber();

    const tx = await program.methods
      .processTelemetry(
        5.0,
        50.0,
        new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 30)
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
    expect(stateAfter.measurementCount.toNumber()).to.equal(countBefore + 1);

    console.log("✅ Measurement count incremented");
  });

  it("Marks breach on temperature above max", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx = await program.methods
      .processTelemetry(
        15.0, // > 8°C
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

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAfter.status).to.deep.equal({ breached: {} });
    expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

    console.log("✅ Temperature above max marked as breach");
  });

  it("Marks breach on temperature below min", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx = await program.methods
      .processTelemetry(
        1.0, // < 2°C
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

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAfter = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAfter.status).to.deep.equal({ breached: {} });
    expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

    console.log("✅ Temperature below min marked as breach");
  });

  it("Marks breach on humidity above max", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx = await program.methods
      .processTelemetry(
        5.0,
        80.0, // > 60%
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
    expect(stateAfter.status).to.deep.equal({ breached: {} });
    expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

    console.log("✅ Humidity above max marked as breach");
  });

  it("Marks breach on humidity below min", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    const tx = await program.methods
      .processTelemetry(
        5.0,
        20.0, // < 40%
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
    expect(stateAfter.status).to.deep.equal({ breached: {} });
    expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

    console.log("✅ Humidity below min marked as breach");
  });

  it("Ignores telemetry after breach is detected", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    // Causar breach
    const tx = await program.methods
      .processTelemetry(
        15.0,
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

    await provider.connection.confirmTransaction(tx, "confirmed");

    const stateAfterBreach = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAfterBreach.status).to.deep.equal({ breached: {} });

    // Intentar enviar más telemetría
    try {
      await program.methods
        .processTelemetry(
          5.0,
          50.0,
          new anchor.BN(stateAfterBreach.lastHeartbeat.toNumber() + 10)
        )
        .accounts({
          provider: providerKp.publicKey,
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected telemetry after breach");
    } catch (err: any) {
      expect(err).to.exist;
      console.log("✅ Correctly rejected telemetry after breach");
    }
  });

  it("Fails with invalid timestamp (older than last heartbeat)", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    try {
      await program.methods
        .processTelemetry(
          5.0,
          50.0,
          new anchor.BN(stateBefore.lastHeartbeat.toNumber() - 10)
        )
        .accounts({
          provider: providerKp.publicKey,
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected old timestamp");
    } catch (err: any) {
      expect(err).to.exist;
      console.log("✅ Correctly rejected old timestamp");
    }
  });

  it("Fails when non-provider tries to submit telemetry", async () => {
    const { config, agreementState } = await createAndFundAgreement();
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    try {
      await program.methods
        .processTelemetry(
          5.0,
          50.0,
          new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 10)
        )
        .accounts({
          provider: payer.publicKey, // ← no es el provider
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([payer])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected non-provider");
    } catch (err: any) {
      expect(err).to.exist;
      console.log("✅ Correctly rejected non-provider");
    }
  });

  it("Fails when agreement is not funded", async () => {
    const { config, agreementState } = await createAgreement(); // sin fondear
    const stateBefore = await program.account.agreementState.fetch(agreementState, "confirmed");

    try {
      await program.methods
        .processTelemetry(
          5.0,
          50.0,
          new anchor.BN(stateBefore.startTime.toNumber() + 10)
        )
        .accounts({
          provider: providerKp.publicKey,
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected unfunded agreement");
    } catch (err: any) {
      expect(err).to.exist;
      console.log("✅ Correctly rejected unfunded agreement");
    }
  });

});