import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Enviphy } from "../target/types/enviphy";
import fs from "fs";
import os from "os";

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
export const program = anchor.workspace.Enviphy as Program<Enviphy>;

// Usar la wallet local como payer (ya tiene SOL en devnet)
const payerKeypair = JSON.parse(
  fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf-8")
);
export const payer = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(payerKeypair)
);

// Provider sigue siendo random, se fondea en el before
export const providerKp = anchor.web3.Keypair.generate();

export const BASE_PARAMS = {
  tempMin: 2.0,
  tempMax: 8.0,
  humidityMin: 40.0,
  humidityMax: 60.0,
  duration: new anchor.BN(604800),
  gracePeriod: new anchor.BN(86400),
  amount: new anchor.BN(100_000_000),
};

let lastTimestamp = 0;
export const getTimestamp = (): anchor.BN => {
  const now = Math.floor(Date.now() / 1000);
  if (now <= lastTimestamp) {
    lastTimestamp++;
  } else {
    lastTimestamp = now;
  }
  return new anchor.BN(lastTimestamp);
};

export const getPDAs = (
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

// Solo para fondear el providerKp en devnet
export const airdrop = async (
  pubkey: anchor.web3.PublicKey,
  amount = 2 * anchor.web3.LAMPORTS_PER_SOL
) => {
  const sig = await provider.connection.requestAirdrop(pubkey, amount);
  await provider.connection.confirmTransaction(sig, "confirmed");
};