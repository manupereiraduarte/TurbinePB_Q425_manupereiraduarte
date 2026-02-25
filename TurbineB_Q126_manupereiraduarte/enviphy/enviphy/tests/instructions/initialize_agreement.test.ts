import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs } from "../setup";

describe("===== Initialize_agreement =====", () => {

  it("Payer initializes agreement correctly", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
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

    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    expect(configAccount.payer.toString()).to.equal(payer.publicKey.toString());
    expect(configAccount.provider.toString()).to.equal(providerKp.publicKey.toString());
    expect(configAccount.tempMin).to.equal(BASE_PARAMS.tempMin);
    expect(configAccount.tempMax).to.equal(BASE_PARAMS.tempMax);
    expect(configAccount.humidityMin).to.equal(BASE_PARAMS.humidityMin);
    expect(configAccount.humidityMax).to.equal(BASE_PARAMS.humidityMax);
    expect(configAccount.amount.toString()).to.equal(BASE_PARAMS.amount.toString());
    expect(configAccount.createdAt.toString()).to.equal(createdAt.toString());

    const expectedFee = BASE_PARAMS.amount.muln(100).divn(10_000);
    expect(configAccount.protocolFee.toString()).to.equal(expectedFee.toString());

    const stateAccount = await program.account.agreementState.fetch(agreementState, "confirmed");
    expect(stateAccount.isFunded).to.equal(false);
    expect(stateAccount.measurementCount.toString()).to.equal("0");
    
    console.log()
    console.log("✅ Payer initialized agreement correctly");
    console.log("   Temp range:", configAccount.tempMin, "C° -", configAccount.tempMax, "C°" );
    console.log("   Humidity range:", configAccount.humidityMin, "% -", configAccount.humidityMax, "%");
    console.log("   duration:", configAccount.duration.toString(), "seconds");
    console.log("   amount:", configAccount.amount.toString(), "lamports");
  });

  it("Provider initializes agreement correctly", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
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
        payer.publicKey,
        providerKp.publicKey,
        createdAt,
      )
      .accounts({
        signer: providerKp.publicKey,
        config,
        agreementState,
        vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([providerKp])
      .rpc({ commitment: "confirmed" });

    const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
    expect(configAccount.payer.toString()).to.equal(payer.publicKey.toString());
    expect(configAccount.provider.toString()).to.equal(providerKp.publicKey.toString());

    console.log()
    console.log("✅ Provider initialized agreement correctly");
  });

  it("Same provider can initialize multiple agreements", async () => {
    const timestamps = [
      getTimestamp(),
      getTimestamp(),
      getTimestamp(),
    ];

    for (const createdAt of timestamps) {
      const { config, agreementState, vault } = getPDAs(
        payer.publicKey,
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
          payer.publicKey,
          providerKp.publicKey,
          createdAt,
        )
        .accounts({
          signer: providerKp.publicKey,
          config,
          agreementState,
          vault,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([providerKp])
        .rpc({ commitment: "confirmed" });

      const configAccount = await program.account.agreementConfig.fetch(config, "confirmed");
      expect(configAccount.provider.toString()).to.equal(providerKp.publicKey.toString());
      expect(configAccount.createdAt.toString()).to.equal(createdAt.toString());
    }
    console.log()
    console.log("✅ Same provider initialized 3 agreements");

  });

  it("Fails with invalid temp range", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
      providerKp.publicKey,
      createdAt
    );

    try {
      await program.methods
        .initializeAgreement(
          10.0, 5.0, // min > max 
          BASE_PARAMS.humidityMin,
          BASE_PARAMS.humidityMax,
          BASE_PARAMS.duration,
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

      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected invalid temp range");
      console.log("   Temp range:", 10.0, "C° -", 5.0, "C°");
    }
  });

  it("Fails with invalid humidity range", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
      providerKp.publicKey,
      createdAt
    );

    try {
      await program.methods
        .initializeAgreement(
          BASE_PARAMS.tempMin,
          BASE_PARAMS.tempMax,
          80.0, 40.0, // min > max 
          BASE_PARAMS.duration,
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

      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected invalid humidity range");
      console.log("   Humidity range:", 80.0, "% -", 40.0 , "%");
    }
  });

  it("Fails with zero duration", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
      providerKp.publicKey,
      createdAt
    );

    try {
      await program.methods
        .initializeAgreement(
          BASE_PARAMS.tempMin,
          BASE_PARAMS.tempMax,
          BASE_PARAMS.humidityMin,
          BASE_PARAMS.humidityMax,
          new anchor.BN(0), // invalid
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

      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected zero duration");
    }
  });

  it("Fails with zero amount", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
      providerKp.publicKey,
      createdAt
    );

    try {
      await program.methods
        .initializeAgreement(
          BASE_PARAMS.tempMin,
          BASE_PARAMS.tempMax,
          BASE_PARAMS.humidityMin,
          BASE_PARAMS.humidityMax,
          BASE_PARAMS.duration,
          BASE_PARAMS.gracePeriod,
          new anchor.BN(0), // ← invalid
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

      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected zero amount");
    }
  });

  it("Fails with zero grace period", async () => {
    const createdAt = getTimestamp();
    const { config, agreementState, vault } = getPDAs(
      payer.publicKey,
      providerKp.publicKey,
      createdAt
    );

    try {
      await program.methods
        .initializeAgreement(
          BASE_PARAMS.tempMin,
          BASE_PARAMS.tempMax,
          BASE_PARAMS.humidityMin,
          BASE_PARAMS.humidityMax,
          BASE_PARAMS.duration,
          new anchor.BN(0), // ← invalid
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

      expect.fail("Should have thrown an error");
    } catch (err: any) {
      expect(err).to.exist;
      console.log()
      console.log("✅ Correctly rejected zero grace period");
    }
  });

});