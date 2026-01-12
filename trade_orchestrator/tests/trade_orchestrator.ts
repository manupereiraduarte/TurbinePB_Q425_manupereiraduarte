import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradeOrchestrator } from "../target/types/trade_orchestrator";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { publicKey, token } from "@coral-xyz/anchor/dist/cjs/utils";

describe("trade_orchestrator", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.tradeOrchestrator as Program<TradeOrchestrator>;

  // variables
  let importer: anchor.web3.Keypair;
  let operationId: string;
  let operationPda: PublicKey;
  let bump: number;

  // variables para deposit
  let nftMint: PublicKey;
  let exporterNftAccount: PublicKey;
  let vaultNftAccount: PublicKey;

  // variables para el pago
  let usdcMint: PublicKey;
  let importerUsdcAccount: PublicKey;
  let vaultPaymentAccount: PublicKey;


  it("Initializes a Trade operation", async () => {
    // preparo datos de prueba
    importer = anchor.web3.Keypair.generate();
    operationId = "OP-1234567"; // id de ejemplo

    // calculo PDA esperada
    [operationPda, bump] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("operation"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(operationId),
      ],
      program.programId
    );
    console.log("PDA esperada: ", operationPda.toBase58());

    const duration = new anchor.BN(86400); 
    // ejecuto instruccion
    await program.methods
      .initialize(operationId, importer.publicKey, duration)
      .accounts({
        operationAccount: operationPda,
        signer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // verifico estado de la cuenta
    const account = await program.account.operationState.fetch(operationPda);

    // verificamos datos
    assert.equal(account.operationId, operationId);
    assert.equal(account.exporter.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(account.importer.toBase58(), importer.publicKey.toBase58());
    assert.equal(account.state, 0); // 0 = created

    console.log("operation account initalized correctly");
  });

  it("Notarize a Document (stores hash)!", async () => {
    // creamos hash de prueba
    const falseHash = anchor.web3.Keypair.generate().publicKey.toBuffer();
    // convertimos a array de nuemeros para simplificar assert
    const hashArray = Array.from(falseHash);
    
    console.log("Storing hash:", falseHash.toString("hex"));

    // ejecuto instruccion
    await program.methods
    .notarizeDocument(Array.from(falseHash))
    .accounts({
      operationAccount: operationPda,
      exporter: provider.wallet.publicKey,
    })
    .rpc();
    
    // verifico estado de la cuenta
    const account = await program.account.operationState.fetch(operationPda);
    // verificamos datos
    assert.equal(account.documents.length, 1);
    assert.deepEqual(account.documents[0], hashArray);

    console.log("Document notarized correctly");
    });

  it("Mints & Locks document (NFT) into Vault!", async () => {
    // creo token
    nftMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      0
    );

    // creo cuenta del exportador (ATA)
    const exporterAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      nftMint,
      provider.wallet.publicKey
    );
    exporterNftAccount = exporterAta.address;
    
    // mint token to exporter
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      nftMint,
      exporterNftAccount,
      provider.wallet.payer,
      1
    );
    console.log("NFT created and minted to exporter");

    // calculo direccion de vault
    [vaultNftAccount] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_nft"),
        Buffer.from(operationId)
      ],
      program.programId
    );

    // ejecuto instruccion de deposit
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

    // verifico que el NFT este en la vault
    const vaultBalance = await provider.connection.getTokenAccountBalance(vaultNftAccount);
    const exporterBalance = await provider.connection.getTokenAccountBalance(exporterNftAccount);

    assert.equal(vaultBalance.value.uiAmount, 1);
    assert.equal(exporterBalance.value.uiAmount, 0);

    const account = await program.account.operationState.fetch(operationPda);
    assert.equal(account.state, 1); // 1 = nft deposited

    console.log("NFT deposited into vault correctly");
      })

  it("Deposits Payment (USDC) into Vault!", async () => {
    // creo token USDC
    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6
    );

    // creo cuenta del importador
    const importerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      importer.publicKey
    );
    importerUsdcAccount = importerAta.address;

    // mintear

    const amount = 1000 * 1_000_000; // 1000 USDC con 6 decimales
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      importerUsdcAccount,
      provider.wallet.payer,
      amount
    );
    
    // calculo direccion de vault para payment
    [vaultPaymentAccount] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_payment"),
        Buffer.from(operationId)
      ],
      program.programId
    );

    const transferSolTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: importer.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL, // 1 SOL para fees
      })
    );
    await provider.sendAndConfirm(transferSolTx);

    // ejecuto instruccion de deposit payment
    await program.methods
      .depositPayment(operationId, new anchor.BN(amount)) // mando id y monto
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

    // verifico que el USDC este en la vault
    const vaultBalance = await provider.connection.getTokenAccountBalance(vaultPaymentAccount);
    // debe haber mil
    assert.equal(vaultBalance.value.amount, amount.toString());
    // verifico estado on chain
    const account = await program.account.operationState.fetch(operationPda);
    assert.equal(account.state, 2); // 2 = payment deposited

    console.log("Payment deposited into vault correctly");

  });

  it("Executes Atomic Swap!", async () => {
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

    // billetera de fee, usamos keypair nueva para simular ser admin
    const treasurykeypair = anchor.web3.Keypair.generate();
    const treasuryUsdcAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint,
      treasurykeypair.publicKey
    );
    const treasuryUsdcAccount = treasuryUsdcAta.address;

    // ejecuto instruccion de swap
    await program.methods
      .executeSwap(operationId)
      .accounts({
        operationAccount: operationPda,
        // quienes reciben
        exporter: provider.wallet.publicKey,
        importer: importer.publicKey,
        // donde reciben los activos
        exporterTokenAccount: exporterUsdcAccount,
        importerTokenAccount: importerNftAccount,
        adminTreasuryTokenAccount: treasuryUsdcAccount,
        // vaults de donde salen los activos
        vaultNftAccount: vaultNftAccount,
        vaultPaymentAccount: vaultPaymentAccount,
        // programas
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      // verificacion
      const exporterUsdcBalance = await provider.connection.getTokenAccountBalance(exporterUsdcAccount);
      const importernftBalance = await provider.connection.getTokenAccountBalance(importerNftAccount);
      const treasuryUsdcBalance = await provider.connection.getTokenAccountBalance(treasuryUsdcAccount);
      const account = await program.account.operationState.fetch(operationPda);

      // calculos esperados
      const totalAmount = 1000 * 1_000_000;
      const feeAmount = totalAmount * 1 / 100; // 1% fee
      const netAmount = totalAmount - feeAmount;

      assert.equal(exporterUsdcBalance.value.amount, netAmount.toString()); // exporter recibe 1000 USDC menos fee
      assert.equal(treasuryUsdcBalance.value.amount, feeAmount.toString()); // treasury recibe 1% fee
      assert.equal(importernftBalance.value.uiAmount, 1); // importer recibe 1 NFT
      assert.equal(account.state, 3); // 3 = completed

      console.log("Atomic swap executed correctly");
      console.log(`✅ Fee: ${feeAmount / 1_000_000} USDC`);
      console.log(`✅ Net: ${netAmount / 1_000_000} USDC`);
  });

  it("Cancels Operation and Refunds Assets!", async () => {
    // el test anterior cierra y completa operacion, asique creamos una nueva.
    const cancelOpId = "OP-CANCEL-TEST";

    const [cancelOpPda] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("operation"),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(cancelOpId),
      ],
      program.programId
    );
    // calculo pdas de nuevas bovedas
    const [cancelVaultNft] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_nft"),
        Buffer.from(cancelOpId)
      ],
      program.programId
    );
    const [cancelVaultPayment] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_payment"),
        Buffer.from(cancelOpId)
      ],
      program.programId
    );

    const duration = new anchor.BN(86400);

    // inicializo nueva operacion
    await program.methods
      .initialize(cancelOpId, importer.publicKey, duration)
      .accounts({
        operationAccount: cancelOpPda,
        signer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

      // deposito nft, asumimos que exporter tiene tokens del mint anterior. minteo 1 para asegurar.
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
      
      // deposito pago, 500 usdc
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

      // cancelacion
      const preRefundExporterNft = (await provider.connection.getTokenAccountBalance(exporterNftAccount)).value.uiAmount;
      const preRefundImporterUsdc = (await provider.connection.getTokenAccountBalance(importerUsdcAccount)).value.amount;

      console.log("Cancelling operation and refunding assets...");
      await program.methods
      .cancelOperation(cancelOpId)
      .accounts({
        operationAccount: cancelOpPda,
        exporter: provider.wallet.publicKey,
        importer: importer.publicKey,
        // vuelven a los owners 
        exporterTokenAccount: exporterNftAccount,
        importerTokenAccount: importerUsdcAccount,
        // origenes
        vaultNftAccount: cancelVaultNft,
        vaultPaymentAccount: cancelVaultPayment,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      // validaciones
      const postRefundExporterNft = (await provider.connection.getTokenAccountBalance(exporterNftAccount)).value.uiAmount;
      const postRefundImporterUsdc = (await provider.connection.getTokenAccountBalance(importerUsdcAccount)).value.amount;
      const opAccount = await program.account.operationState.fetch(cancelOpPda);

      // exporter debe tener 1 NFT mas
      assert.equal(postRefundExporterNft, preRefundExporterNft + 1);
      // importer recupera 500, pasamos a bn para comparar montos grandes
      const expectedUsdc = new anchor.BN(preRefundImporterUsdc).add(new anchor.BN(refundAmount)); 
      assert.equal(postRefundImporterUsdc, expectedUsdc.toString());
      // operacion queda cancelada
      assert.equal(opAccount.state, 4); // 4 = cancelled

      console.log("Operation cancelled and assets refunded correctly");
  });
});