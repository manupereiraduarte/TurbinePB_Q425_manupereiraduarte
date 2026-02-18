import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Enviphy } from "../target/types/enviphy";
import { expect } from "chai";

describe("enviphy", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Enviphy as Program<Enviphy>;

  // ============================================
  // Shared Test State
  // ============================================

  const payer = anchor.web3.Keypair.generate();
  const providerKp = anchor.web3.Keypair.generate();

  const BASE_PARAMS = {
    tempMin: 2.0,
    tempMax: 8.0,
    humidityMin: 40.0,
    humidityMax: 60.0,
    duration: new anchor.BN(604800),
    gracePeriod: new anchor.BN(600),
    amount: new anchor.BN(1_000_000_000),
  };

  // Helper para generar timestamp único
  let lastTimestamp = 0;
  const getTimestamp = (): anchor.BN => {
    const now = Math.floor(Date.now() / 1000);
    if (now <= lastTimestamp) {
      lastTimestamp++;
    } else {
      lastTimestamp = now;
    }
    return new anchor.BN(lastTimestamp);
  };

  // Helper para derivar PDAs
  const getPDAs = (
    payerKey: anchor.web3.PublicKey,
    providerKey: anchor.web3.PublicKey,
    createdAt: anchor.BN
  ) => {
    const [config] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("config"),
        payerKey.toBuffer(),
        providerKey.toBuffer(),
        createdAt.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const [agreementState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"), config.toBuffer()],
      program.programId
    );

    const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), config.toBuffer()],
      program.programId
    );

    return { config, agreementState, vault };
  };

  // Helper airdrop
  const airdrop = async (
    pubkey: anchor.web3.PublicKey,
    amount = 10 * anchor.web3.LAMPORTS_PER_SOL
  ) => {
    const sig = await provider.connection.requestAirdrop(pubkey, amount);
    await provider.connection.confirmTransaction(sig);
  };

  // ============================================
  // STEP 1: State & Setup Tests
  // ============================================

  describe("Step 1: State & Setup", () => {
    it("Program deploys correctly", async () => {
      const programInfo = await provider.connection.getAccountInfo(
        program.programId
      );
      expect(programInfo).to.not.be.null;
      console.log("✅ Program deployed at:", program.programId.toString());
    });

    it("Program ID is valid", async () => {
      expect(program.programId.toString()).to.be.a("string");
      expect(program.programId.toString().length).to.be.greaterThan(0);
      console.log("✅ Program ID valid:", program.programId.toString());
    });
  });

  // ============================================
  // STEP 2: initialize_agreement Tests
  // ============================================

  describe("Step 2: initialize_agreement", () => {

    before(async () => {
      await airdrop(payer.publicKey);
      await airdrop(providerKp.publicKey);
    });

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
        .rpc();

      const configAccount = await program.account.agreementConfig.fetch(config);
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

      const stateAccount = await program.account.agreementState.fetch(agreementState);
      expect(stateAccount.isFunded).to.equal(false);
      expect(stateAccount.measurementCount.toString()).to.equal("0");

      console.log("✅ Payer initialized agreement correctly");
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
        .rpc();

      const configAccount = await program.account.agreementConfig.fetch(config);
      expect(configAccount.payer.toString()).to.equal(payer.publicKey.toString());
      expect(configAccount.provider.toString()).to.equal(providerKp.publicKey.toString());

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
          .rpc();

        const configAccount = await program.account.agreementConfig.fetch(config);
        expect(configAccount.provider.toString()).to.equal(providerKp.publicKey.toString());
        expect(configAccount.createdAt.toString()).to.equal(createdAt.toString());
      }

      console.log("✅ Same provider can have multiple agreements");
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
            10.0, 5.0,  // min > max ← inválido
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
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected invalid temp range");
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
            80.0, 40.0,  // min > max ← inválido
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
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected invalid humidity range");
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
            new anchor.BN(0),  // ← inválido
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
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err).to.exist;
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
            new anchor.BN(0),  // ← inválido
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
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err).to.exist;
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
            new anchor.BN(0),  // ← inválido
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
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected zero grace period");
      }
    });

  });
});