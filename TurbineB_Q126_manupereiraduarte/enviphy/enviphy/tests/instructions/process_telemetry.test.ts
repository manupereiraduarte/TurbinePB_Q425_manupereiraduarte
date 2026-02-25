import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs, airdrop } from "../setup";
import { createAgreement, createAndFundAgreement } from "../fixtures";

describe("===== Process_telemetry =====", () => {

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

    console.log()
    console.log("✅ Valid telemetry accepted");
    console.log("   Temperature:", stateAfter.lastTemperature, "°C");
    console.log("   Humidity:", stateAfter.lastHumidity, "%");
    console.log("   Measurement count:", stateAfter.measurementCount.toString());
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

    console.log()
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

    console.log()
    console.log("✅ Measurement count incremented");
    console.log("   New measurement count:", stateAfter.measurementCount.toString());
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

    console.log()
    console.log("✅ Temperature above max marked as breach");
    console.log("   Temp Range:", 2.0, "°C -", 8.0, "°C");
    console.log("   Reported temperature:", stateAfter.lastTemperature, "°C");
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

    console.log()
    console.log("✅ Temperature below min marked as breach");
    console.log("   Temp Range:", 2.0, "°C -", 8.0, "°C");
    console.log("   Reported temperature:", stateAfter.lastTemperature, "°C");
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

    console.log()
    console.log("✅ Humidity above max marked as breach");
    console.log("   Humidity Range:", 40.0, "% -", 60.0, "%");
    console.log("   Reported humidity:", stateAfter.lastHumidity, "%");
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

    console.log()
    console.log("✅ Humidity below min marked as breach");
    console.log("   Humidity Range:", 40.0, "% -", 60.0, "%");
    console.log("   Reported humidity:", stateAfter.lastHumidity, "%");
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

    // more telemetry after breach
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
      console.log()
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
      console.log()
      console.log("✅ Correctly rejected old timestamp");
      console.log("   Last heartbeat:", stateBefore.lastHeartbeat.toNumber());
      console.log("   Reported timestamp:", stateBefore.lastHeartbeat.toNumber() - 10);
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
          provider: payer.publicKey, // non-provider tries to submit telemetry
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([payer])
        .rpc({ commitment: "confirmed" });

      expect.fail("Should have rejected non-provider");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected non-provider");
    }
  });

  it("Fails when agreement is not funded", async () => {
    const { config, agreementState } = await createAgreement(); // no fund
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
      console.log()
      console.log("✅ Correctly rejected unfunded agreement");
    }
  });

});