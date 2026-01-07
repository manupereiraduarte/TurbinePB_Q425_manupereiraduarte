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

  // variables
  let importer: anchor.web3.Keypair;
  let operationId: string;
  let operationPda: PublicKey;
  let bump: number;

  // variables para deposit
  let nftMint: PublicKey;
  let exporterNftAccount: PublicKey;
  let vaultNftAccount: PublicKey;


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
    // ejecuto instruccion
    await program.methods
      .initialize(operationId, importer.publicKey)
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
  });