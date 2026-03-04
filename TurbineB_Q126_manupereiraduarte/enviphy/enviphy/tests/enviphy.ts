import * as anchor from "@coral-xyz/anchor";
import { payer, providerKp, provider, program } from "./setup";
import { SystemProgram, Transaction } from "@solana/web3.js";

before(async () => {
  // Transferir SOL al provider desde tu wallet (sin airdrop)
  const transferTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: providerKp.publicKey,
      lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
    })
  );

  const sig = await anchor.web3.sendAndConfirmTransaction(
    provider.connection,
    transferTx,
    [payer],
    { commitment: "confirmed" }
  );

  console.log("✅ Provider funded:", sig);
  console.log("Payer:", payer.publicKey.toBase58());
  console.log("Provider:", providerKp.publicKey.toBase58());
});

// Suites — el orden importa
import "./instructions/happy_path.test";
import "./instructions/initialize_agreement.test";
import "./instructions/deposit.test";
import "./instructions/process_telemetry.test";
import "./instructions/resolve_agreement.test";
import "./instructions/close_agreement.test";