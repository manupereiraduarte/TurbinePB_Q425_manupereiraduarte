import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradeOrchestrator } from "../target/types/trade_orchestrator";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

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
    })
});
