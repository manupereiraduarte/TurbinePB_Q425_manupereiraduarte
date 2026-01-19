import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradeOrchestrator } from "../target/types/trade_orchestrator";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("trade_orchestrator", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.tradeOrchestrator as Program<TradeOrchestrator>;

  // Core variables
  let importer: anchor.web3.Keypair;
  let operationId: string;
  let operationPda: PublicKey;
  let bump: number;

  // Deposit variables (NFT)
  let nftMint: PublicKey;
  let exporterNftAccount: PublicKey;
  let vaultNftAccount: PublicKey;

  // Payment variables (USDC)
  let usdcMint: PublicKey;
  let importerUsdcAccount: PublicKey;
  let vaultPaymentAccount: PublicKey;

  console.log("\n🚀 STARTING INTEGRATION TESTS FOR TRADE ORCHESTRATOR...\n");

  it("Step 1: Initializes a Trade Operation", async () => {
    console.log("---------------------------------------------------");
    console.log("➡️  Step 1: Initialization");
    
    // Prepare test data
    importer = anchor.web3.Keypair.generate();
    operationId = "OP-" + Math.floor(Math.random() * 100000); // Random ID

    // Calculate expected PDA
    [operationPda, bump] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("operation"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(operationId),
      ],
      program.programId
    );
    
    console.log(`   ℹ️  Operation ID: ${operationId}`);
    console.log(`   ℹ️  Expected PDA: ${operationPda.toBase58()}`);

    const duration = new anchor.BN(86400); // 1 Day

    // Execute instruction
    await program.methods
      .initialize(operationId, importer.publicKey, duration)
      .accounts({
        operationAccount: operationPda,
        signer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Verify state
    const account = await program.account.operationState.fetch(operationPda);

    // Assertions
    assert.equal(account.operationId, operationId);
    assert.equal(account.exporter.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(account.importer.toBase58(), importer.publicKey.toBase58());
    assert.equal(account.state, 0); 

    console.log("   ✅ Operation initialized successfully.");
    console.log("   ✅ Time-Lock set to 86400 seconds.");
  });

  it("Step 2: Notarize a Document (Stores Hash)", async () => {
    console.log("---------------------------------------------------");
    console.log("➡️  Step 2: Document Notarization");

    // Create fake hash
    const falseHash = anchor.web3.Keypair.generate().publicKey.toBuffer();
    const hashArray = Array.from(falseHash);
    
    console.log(`   ℹ️  Document Hash: ${falseHash.toString("hex").slice(0, 30)}...`);

    // Execute instruction
    await program.methods
    .notarizeDocument(Array.from(falseHash))
    .accounts({
      operationAccount: operationPda,
      exporter: provider.wallet.publicKey,
    })
    .rpc();
    
    // Verify state
    const account = await program.account.operationState.fetch(operationPda);
    
    assert.equal(account.documents.length, 1);
    assert.deepEqual(account.documents[0], hashArray);

    console.log("   ✅ Document Hash stored on-chain.");
  });

  it("Step 3: Mints & Locks Bill of Lading (NFT) into Vault", async () => {
    console.log("---------------------------------------------------");
    console.log("➡️  Step 3: Deposit NFT (Bill of Lading)");

    // Create Token
    nftMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      0 // 0 decimals 
    );

    // Create Exporter ATA
    const exporterAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      nftMint,
      provider.wallet.publicKey
    );
    exporterNftAccount = exporterAta.address;
    
    // Mint to Exporter
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      nftMint,
      exporterNftAccount,
      provider.wallet.payer,
      1
    );
    console.log("   ℹ️  NFT Minted to Exporter wallet.");

    // Calculate Vault PDA
    [vaultNftAccount] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_nft"),
        Buffer.from(operationId)
      ],
      program.programId
    );

    // Execute Deposit
    await program.methods
      .depositNft(operationId)
      .accounts({
        operationAccount: operationPda,
        exporter: provider.wallet.publicKey,
        nftMint: nftMint,
        exporterTokenAccount: exporterNftAccount,
        vaultAccount: vaultNftAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Verify Balances
    const vaultBalance = await provider.connection.getTokenAccountBalance(vaultNftAccount);
    const exporterBalance = await provider.connection.getTokenAccountBalance(exporterNftAccount);

    assert.equal(vaultBalance.value.uiAmount, 1);
    assert.equal(exporterBalance.value.uiAmount, 0);

    const account = await program.account.operationState.fetch(operationPda);
    assert.equal(account.state, 1); // 1 = AssetLocked

    console.log("   ✅ NFT moved to Program Vault.");
    console.log("   ✅ Operation State updated to 'AssetLocked'.");
  });

  it("Step 4: Deposits Payment (USDC) into Vault", async () => {
    console.log("---------------------------------------------------");
    console.log("➡️  Step 4: Deposit Payment (USDC)");

    // Create fake USDC
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6
    );

    // Create Importer ATA
    const importerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      importer.publicKey
    );
    importerUsdcAccount = importerAta.address;

    // Mint USDC to Importer
    const amount = 1000 * 1_000_000; // 1000 USDC
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      importerUsdcAccount,
      provider.wallet.payer,
      amount
    );
    console.log(`   ℹ️  Minted 1,000 USDC to Importer.`);
    
    // Calculate Payment Vault PDA
    [vaultPaymentAccount] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_payment"),
        Buffer.from(operationId)
      ],
      program.programId
    );

    // Fund Importer with SOL for fees
    const transferSolTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: importer.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transferSolTx);

    // Execute Deposit Payment
    await program.methods
      .depositPayment(operationId, new anchor.BN(amount))
      .accounts({
        operationAccount: operationPda,
        importer: importer.publicKey,
        tokenMint: usdcMint,
        importerTokenAccount: importerUsdcAccount,
        vaultAccount: vaultPaymentAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([importer])
      .rpc();

    // Verify Balance
    const vaultBalance = await provider.connection.getTokenAccountBalance(vaultPaymentAccount);
    
    assert.equal(vaultBalance.value.amount, amount.toString());
    
    const account = await program.account.operationState.fetch(operationPda);
    assert.equal(account.state, 2); // 2 = PaymentDeposited

    console.log("   ✅ 1,000 USDC locked in Escrow Vault.");
    console.log("   ✅ Operation State updated to 'PaymentDeposited'.");
  });

  it("Step 5: Executes Atomic Swap!", async () => {
    console.log("---------------------------------------------------");
    console.log("➡️  Step 5: Execute Atomic Swap");

    // Prepare receiver accounts
    const exporterUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      provider.wallet.publicKey
    );
    const exporterUsdcAccount = exporterUsdcAta.address;

    const importerNftAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      nftMint,
      importer.publicKey
    );
    const importerNftAccount = importerNftAta.address;

    // Treasury for fees
    const treasurykeypair = anchor.web3.Keypair.generate();
    const treasuryUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      treasurykeypair.publicKey
    );
    const treasuryUsdcAccount = treasuryUsdcAta.address;

    // Execute Swap
    await program.methods
      .executeSwap(operationId)
      .accounts({
        operationAccount: operationPda,
        // Receivers
        exporter: provider.wallet.publicKey,
        importer: importer.publicKey,
        // Destinations
        exporterTokenAccount: exporterUsdcAccount,
        importerTokenAccount: importerNftAccount,
        adminTreasuryTokenAccount: treasuryUsdcAccount,
        // Sources (Vaults)
        vaultNftAccount: vaultNftAccount,
        vaultPaymentAccount: vaultPaymentAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      // Verify final balances
      const exporterUsdcBalance = await provider.connection.getTokenAccountBalance(exporterUsdcAccount);
      const importernftBalance = await provider.connection.getTokenAccountBalance(importerNftAccount);
      const treasuryUsdcBalance = await provider.connection.getTokenAccountBalance(treasuryUsdcAccount);
      const account = await program.account.operationState.fetch(operationPda);

      // Calculations
      const totalAmount = 1000 * 1_000_000;
      const feeAmount = totalAmount * 1 / 100; // 1% fee
      const netAmount = totalAmount - feeAmount;

      assert.equal(exporterUsdcBalance.value.amount, netAmount.toString());
      assert.equal(treasuryUsdcBalance.value.amount, feeAmount.toString());
      assert.equal(importernftBalance.value.uiAmount, 1);
      assert.equal(account.state, 3); // 3 = Swapped/Completed

      console.log("   ✅ Swap Executed Successfully.");
      console.log(`   💰 Protocol Fee (1%): ${feeAmount / 1_000_000} USDC -> Treasury`);
      console.log(`   💵 Exporter Recieved: ${netAmount / 1_000_000} USDC`);
      console.log(`   📦 Importer Recieved: 1 Bill of Lading (NFT)`);
  });

  it("Step 6: Cancels Operation and Refunds Assets (Safety Check)", async () => {
    console.log("---------------------------------------------------");
    console.log("➡️  Step 6: Test Cancel & Refund Flow");
    console.log("   ℹ️  Creating a NEW operation to test cancellation...");

    // Setup new operation for cancel test
    const cancelOpId = "OP-CANCEL-" + Math.floor(Math.random() * 1000);

    const [cancelOpPda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("operation"), provider.wallet.publicKey.toBuffer(), Buffer.from(cancelOpId)],
      program.programId
    );
    const [cancelVaultNft] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_nft"), Buffer.from(cancelOpId)],
      program.programId
    );
    const [cancelVaultPayment] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_payment"), Buffer.from(cancelOpId)],
      program.programId
    );

    const duration = new anchor.BN(86400);

    // 1. Initialize
    await program.methods
      .initialize(cancelOpId, importer.publicKey, duration)
      .accounts({
        operationAccount: cancelOpPda,
        signer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

      // 2. Deposit NFT (Mint a new one just in case or reuse logic)
      // Reusing mint logic but minting 1 more to exporter
      await mintTo(
        provider.connection,
        provider.wallet.payer,
        nftMint,
        exporterNftAccount,
        provider.wallet.payer,
        1
      );

      await program.methods
      .depositNft(cancelOpId)
      .accounts({
        operationAccount: cancelOpPda,
        exporter: provider.wallet.publicKey,
        nftMint: nftMint,
        exporterTokenAccount: exporterNftAccount,
        vaultAccount: cancelVaultNft,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
      
      // 3. Deposit Payment (500 USDC)
      const refundAmount = 500 * 1_000_000;
      await mintTo(
        provider.connection,
        provider.wallet.payer,
        usdcMint,
        importerUsdcAccount,
        provider.wallet.payer,
        refundAmount
      );

      await program.methods
      .depositPayment(cancelOpId, new anchor.BN(refundAmount))
      .accounts({
        operationAccount: cancelOpPda,
        importer: importer.publicKey,
        tokenMint: usdcMint,
        importerTokenAccount: importerUsdcAccount,
        vaultAccount: cancelVaultPayment,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([importer])
      .rpc();

      console.log("   ℹ️  Assets Deposited. Executing Cancel...");

      // Snapshots before refund
      const preRefundExporterNft = (await provider.connection.getTokenAccountBalance(exporterNftAccount)).value.uiAmount;
      const preRefundImporterUsdc = (await provider.connection.getTokenAccountBalance(importerUsdcAccount)).value.amount;

      // 4. Cancel
      await program.methods
      .cancelOperation(cancelOpId)
      .accounts({
        operationAccount: cancelOpPda,
        signer: provider.wallet.publicKey, // ADDED: Matches generic signer update
        exporter: provider.wallet.publicKey,
        importer: importer.publicKey,
        // Refunds go back to owners
        exporterTokenAccount: exporterNftAccount,
        importerTokenAccount: importerUsdcAccount,
        // From Vaults
        vaultNftAccount: cancelVaultNft,
        vaultPaymentAccount: cancelVaultPayment,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      // Verify Refunds
      const postRefundExporterNft = (await provider.connection.getTokenAccountBalance(exporterNftAccount)).value.uiAmount;
      const postRefundImporterUsdc = (await provider.connection.getTokenAccountBalance(importerUsdcAccount)).value.amount;
      const opAccount = await program.account.operationState.fetch(cancelOpPda);

      assert.equal(postRefundExporterNft, preRefundExporterNft + 1);
      
      const expectedUsdc = new anchor.BN(preRefundImporterUsdc).add(new anchor.BN(refundAmount)); 
      assert.equal(postRefundImporterUsdc, expectedUsdc.toString());
      
      assert.equal(opAccount.state, 4); // 4 = Cancelled

      console.log("   ✅ Operation Cancelled.");
      console.log("   ✅ NFT Returned to Exporter.");
      console.log("   ✅ USDC Refunded to Importer.");
      console.log("---------------------------------------------------");
  });
});