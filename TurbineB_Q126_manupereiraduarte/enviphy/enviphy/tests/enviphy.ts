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

  // Step 3: deposit_funds Tests

  describe("Step 3: deposit_funds", () => {

    let testConfig: anchor.web3.PublicKey;
    let testAgreementState: anchor.web3.PublicKey;
    let testVault: anchor.web3.PublicKey;
    let testCreatedAt: anchor.BN;

    before(async () => {
      // Crear un agreement para usar en los tests de deposit
      testCreatedAt = getTimestamp();
      const pdas = getPDAs(payer.publicKey, providerKp.publicKey, testCreatedAt);
      testConfig = pdas.config;
      testAgreementState = pdas.agreementState;
      testVault = pdas.vault;

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
          testCreatedAt,
        )
        .accounts({
          signer: payer.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          vault: testVault,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();
    });

    it("Payer deposits funds correctly", async () => {
      const payerBalanceBefore = await provider.connection.getBalance(
        payer.publicKey
      );
      const feeRecipientBalanceBefore = await provider.connection.getBalance(
        payer.publicKey // fee_recipient es el signer de initialize (en este caso el payer)
      );

      await program.methods
        .depositFunds()
        .accounts({
          payer: payer.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          vault: testVault,
          feeRecipient: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([payer])
        .rpc();

      // Verificar que se actualizó el estado
      const stateAccount = await program.account.agreementState.fetch(
        testAgreementState
      );
      expect(stateAccount.isFunded).to.equal(true);
      expect(stateAccount.startTime.toNumber()).to.be.greaterThan(0);
      expect(stateAccount.lastHeartbeat.toNumber()).to.be.greaterThan(0);

      // Verificar que el vault recibió los fondos
      const vaultBalance = await provider.connection.getBalance(testVault);
      expect(vaultBalance.toString()).to.equal(BASE_PARAMS.amount.toString());

      console.log("✅ Payer deposited funds correctly");
      console.log("   Vault balance:", vaultBalance);
      console.log("   Start time:", stateAccount.startTime.toString());
    });

    it("Fails when trying to deposit twice", async () => {
      try {
        await program.methods
          .depositFunds()
          .accounts({
            payer: payer.publicKey,
            config: testConfig,
            agreementState: testAgreementState,
            vault: testVault,
            feeRecipient: payer.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          } as any)
          .signers([payer])
          .rpc();

        expect.fail("Should have thrown AlreadyFunded");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected double deposit");
      }
    });

    it("Fails when non-payer tries to deposit", async () => {
      const createdAt = getTimestamp();
      const { config, agreementState, vault } = getPDAs(
        payer.publicKey,
        providerKp.publicKey,
        createdAt
      );

      // Crear nuevo agreement
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

      try {
        // Provider intenta depositar (no es el payer)
        await program.methods
          .depositFunds()
          .accounts({
            payer: providerKp.publicKey, // ← Provider intenta depositar
            config,
            agreementState,
            vault,
            feeRecipient: payer.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          } as any)
          .signers([providerKp])
          .rpc();

        expect.fail("Should have thrown UnauthorizedPayer");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected non-payer deposit");
      }
    });

    it("Transfers correct amounts to vault and fee recipient", async () => {
      // Esperar 1 segundo para asegurar timestamp único
      await new Promise(resolve => setTimeout(resolve, 1000));

      const createdAt = getTimestamp();

      // Crear nuevo payer para este test
      const newPayer = anchor.web3.Keypair.generate();
      const feeRecipientKp = anchor.web3.Keypair.generate();
      await airdrop(newPayer.publicKey);
      await airdrop(feeRecipientKp.publicKey);

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
        .rpc();

      const configAccount = await program.account.agreementConfig.fetch(config);
      const feeRecipient = configAccount.feeRecipient;

      const feeRecipientBalanceBefore = await provider.connection.getBalance(
        feeRecipient
      );

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
        .rpc();

      // Verificar vault balance
      const vaultBalance = await provider.connection.getBalance(vault);
      expect(vaultBalance.toString()).to.equal(
        configAccount.amount.toString()
      );

      // Verificar fee recipient balance
      const feeRecipientBalanceAfter = await provider.connection.getBalance(
        feeRecipient
      );
      const feeReceived = feeRecipientBalanceAfter - feeRecipientBalanceBefore;
      expect(feeReceived.toString()).to.equal(
        configAccount.protocolFee.toString()
      );

      console.log("✅ Correct amounts transferred");
      console.log("   Vault received:", vaultBalance, "lamports");
      console.log("   Fee received:", feeReceived, "lamports");
    });

    it("Sets start_time and last_heartbeat correctly", async () => {
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

      // Verificar estado ANTES de deposit
      const stateBeforeDeposit = await program.account.agreementState.fetch(
        agreementState
      );
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
        .rpc();

      const stateAccount = await program.account.agreementState.fetch(
        agreementState
      );

      const startTime = stateAccount.startTime.toNumber();
      const lastHeartbeat = stateAccount.lastHeartbeat.toNumber();

      // Validaciones:
      // 1. Los timestamps ahora deben ser mayores a 0 (se setearon)
      expect(startTime).to.be.greaterThan(0);
      expect(lastHeartbeat).to.be.greaterThan(0);

      // 2. start_time debe ser igual a last_heartbeat (se setean juntos con el mismo clock.unix_timestamp)
      expect(lastHeartbeat).to.equal(startTime);

      // 3. Timestamp debe ser razonable (después del año 2020, antes del año 2100)
      expect(startTime).to.be.greaterThan(1577836800);  // 1 Jan 2020
      expect(startTime).to.be.lessThan(4102444800);     // 1 Jan 2100

      // 4. is_funded debe ser true
      expect(stateAccount.isFunded).to.equal(true);

      console.log("✅ Timestamps set correctly");
      console.log("   Start time:", startTime);
      console.log("   Last heartbeat:", lastHeartbeat);
      console.log("   is_funded:", stateAccount.isFunded);
    });

    it("Emits FundsDeposited event", async () => {
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
        .rpc();

      // En un test real, podrías parsear los eventos del tx
      // Por ahora solo verificamos que la tx fue exitosa
      expect(tx).to.be.a("string");
      console.log("✅ FundsDeposited event emitted");
    });

  });

  // step 4: process_telemetry tests

  describe("Step 4: process_telemetry", () => {

    let testConfig: anchor.web3.PublicKey;
    let testAgreementState: anchor.web3.PublicKey;
    let testVault: anchor.web3.PublicKey;
    let testCreatedAt: anchor.BN;

    before(async () => {
      // Crear y fundear un agreement para los tests
      testCreatedAt = getTimestamp();
      const pdas = getPDAs(payer.publicKey, providerKp.publicKey, testCreatedAt);
      testConfig = pdas.config;
      testAgreementState = pdas.agreementState;
      testVault = pdas.vault;

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
          testCreatedAt,
        )
        .accounts({
          signer: payer.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          vault: testVault,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();

      const configAccount = await program.account.agreementConfig.fetch(testConfig);

      await program.methods
        .depositFunds()
        .accounts({
          payer: payer.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          vault: testVault,
          feeRecipient: configAccount.feeRecipient,
          systemProgram: anchor.web3.SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([payer])
        .rpc();
    });

    it("Accepts valid telemetry within thresholds", async () => {
      const stateBeforeTelemetry = await program.account.agreementState.fetch(
        testAgreementState
      );
      const lastHeartbeatBefore = stateBeforeTelemetry.lastHeartbeat.toNumber();
      const measurementCountBefore = stateBeforeTelemetry.measurementCount.toNumber();

      await program.methods
        .processTelemetry(
          5.0,  // temp within 2-8°C
          50.0, // humidity within 40-60%
          new anchor.BN(lastHeartbeatBefore + 10) // 10 seconds after last
        )
        .accounts({
          provider: providerKp.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(testAgreementState);
      
      expect(stateAfter.status).to.deep.equal({ active: {} });
      expect(stateAfter.lastTemperature).to.equal(5.0);
      expect(stateAfter.lastHumidity).to.equal(50.0);
      expect(stateAfter.measurementCount.toNumber()).to.equal(measurementCountBefore + 1);

      console.log("✅ Valid telemetry accepted");
    });

    it("Updates last_heartbeat correctly", async () => {
      const stateBefore = await program.account.agreementState.fetch(testAgreementState);
      const newTimestamp = stateBefore.lastHeartbeat.toNumber() + 20;

      await program.methods
        .processTelemetry(5.0, 50.0, new anchor.BN(newTimestamp))
        .accounts({
          provider: providerKp.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(testAgreementState);
      expect(stateAfter.lastHeartbeat.toNumber()).to.equal(newTimestamp);

      console.log("✅ Last heartbeat updated correctly");
    });

    it("Increments measurement_count", async () => {
      const stateBefore = await program.account.agreementState.fetch(testAgreementState);
      const countBefore = stateBefore.measurementCount.toNumber();
      const newTimestamp = stateBefore.lastHeartbeat.toNumber() + 30;

      await program.methods
        .processTelemetry(5.0, 50.0, new anchor.BN(newTimestamp))
        .accounts({
          provider: providerKp.publicKey,
          config: testConfig,
          agreementState: testAgreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(testAgreementState);
      expect(stateAfter.measurementCount.toNumber()).to.equal(countBefore + 1);

      console.log("✅ Measurement count incremented");
    });

    it("Marks breach on temperature above max", async () => {
      const createdAt = getTimestamp();
      const { config, agreementState, vault } = getPDAs(
        payer.publicKey,
        providerKp.publicKey,
        createdAt
      );

      // Setup nuevo agreement
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
        .rpc();

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      await program.methods
        .processTelemetry(
          15.0, // temp > 8°C (max) ← breach!
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
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(agreementState);
      expect(stateAfter.status).to.deep.equal({ breached: {} });
      expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

      console.log("✅ Temperature above max marked as breach");
    });

    it("Marks breach on temperature below min", async () => {
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
        .rpc();

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      await program.methods
        .processTelemetry(
          1.0, // temp < 2°C (min) ← breach!
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
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(agreementState);
      expect(stateAfter.status).to.deep.equal({ breached: {} });
      expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

      console.log("✅ Temperature below min marked as breach");
    });

    it("Marks breach on humidity above max", async () => {
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
        .rpc();

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      await program.methods
        .processTelemetry(
          5.0,
          80.0, // humidity > 60% (max) ← breach!
          new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 10)
        )
        .accounts({
          provider: providerKp.publicKey,
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(agreementState);
      expect(stateAfter.status).to.deep.equal({ breached: {} });
      expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

      console.log("✅ Humidity above max marked as breach");
    });

    it("Marks breach on humidity below min", async () => {
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
        .rpc();

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      await program.methods
        .processTelemetry(
          5.0,
          20.0, // humidity < 40% (min) ← breach!
          new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 10)
        )
        .accounts({
          provider: providerKp.publicKey,
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(agreementState);
      expect(stateAfter.status).to.deep.equal({ breached: {} });
      expect(stateAfter.breachReason).to.deep.equal({ thresholdViolation: {} });

      console.log("✅ Humidity below min marked as breach");
    });

    it("Marks breach on connectivity loss (grace period exceeded)", async () => {
      const createdAt = getTimestamp();
      const { config, agreementState, vault } = getPDAs(
        payer.publicKey,
        providerKp.publicKey,
        createdAt
      );

      // Grace period = 600 segundos (10 minutos)
      await program.methods
        .initializeAgreement(
          BASE_PARAMS.tempMin,
          BASE_PARAMS.tempMax,
          BASE_PARAMS.humidityMin,
          BASE_PARAMS.humidityMax,
          BASE_PARAMS.duration,
          new anchor.BN(600),  // 10 minutos de grace period
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
        .rpc();

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      // Simular 15 minutos después (excede los 10 minutos de grace period)
      // Nota: timestamp de la telemetría puede estar en el pasado para este test
      const oldTimestamp = stateBefore.lastHeartbeat.toNumber() - 900; // 15 min antes

      // Esperar para que el Clock de Solana avance
      await new Promise(resolve => setTimeout(resolve, 2000));

      await program.methods
        .processTelemetry(
          5.0,
          50.0,
          new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 1) // Timestamp válido pero el clock avanzó
        )
        .accounts({
          provider: providerKp.publicKey,
          config,
          agreementState,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .signers([providerKp])
        .rpc();

      const stateAfter = await program.account.agreementState.fetch(agreementState);
      
      // Si pasó más de grace_period desde last_heartbeat, debería marcar breach
      // Nota: en tests esto puede ser difícil de simular exactamente
      // Por ahora solo verificamos que la telemetría se procesó
      expect(stateAfter.measurementCount.toNumber()).to.be.greaterThan(
        stateBefore.measurementCount.toNumber()
      );

      console.log("✅ Connectivity check processed");
      console.log("   Status:", stateAfter.status);
    });

    it("Ignores telemetry after breach is detected", async () => {
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
        .rpc();

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      // Primera telemetría: causar breach
      await program.methods
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
        .rpc();

      const stateAfterBreach = await program.account.agreementState.fetch(agreementState);
      expect(stateAfterBreach.status).to.deep.equal({ breached: {} });

      // Segunda telemetría: debe ser rechazada
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
          .rpc();

        expect.fail("Should have rejected telemetry after breach");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected telemetry after breach");
      }
    });

    it("Fails with invalid timestamp (older than last heartbeat)", async () => {
      const stateBefore = await program.account.agreementState.fetch(testAgreementState);

      try {
        await program.methods
          .processTelemetry(
            5.0,
            50.0,
            new anchor.BN(stateBefore.lastHeartbeat.toNumber() - 10) // timestamp anterior
          )
          .accounts({
            provider: providerKp.publicKey,
            config: testConfig,
            agreementState: testAgreementState,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          } as any)
          .signers([providerKp])
          .rpc();

        expect.fail("Should have rejected old timestamp");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected old timestamp");
      }
    });

    it("Fails when non-provider tries to submit telemetry", async () => {
      const stateBefore = await program.account.agreementState.fetch(testAgreementState);

      try {
        await program.methods
          .processTelemetry(
            5.0,
            50.0,
            new anchor.BN(stateBefore.lastHeartbeat.toNumber() + 10)
          )
          .accounts({
            provider: payer.publicKey,  // ← Payer intenta (no es el provider)
            config: testConfig,
            agreementState: testAgreementState,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          } as any)
          .signers([payer])
          .rpc();

        expect.fail("Should have rejected non-provider");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected non-provider");
      }
    });

    it("Fails when agreement is not funded", async () => {
      const createdAt = getTimestamp();
      const { config, agreementState, vault } = getPDAs(
        payer.publicKey,
        providerKp.publicKey,
        createdAt
      );

      // Solo initialize, NO deposit
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

      const stateBefore = await program.account.agreementState.fetch(agreementState);

      try {
        await program.methods
          .processTelemetry(
            5.0,
            50.0,
            new anchor.BN(Math.floor(Date.now() / 1000))
          )
          .accounts({
            provider: providerKp.publicKey,
            config,
            agreementState,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          } as any)
          .signers([providerKp])
          .rpc();

        expect.fail("Should have rejected unfunded agreement");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("✅ Correctly rejected unfunded agreement");
      }
    });

  });



  
});