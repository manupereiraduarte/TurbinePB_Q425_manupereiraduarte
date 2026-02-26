import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const PROGRAM_ID = new PublicKey(
  "2dF1MZUAvR8uF8YorNKyKg8Dn7nzGqvSkAMF5ZzDfmye"
);

export const DEMO_PROVIDER = new PublicKey(
  "A3C4QJHCEw9BdbyDSYRCSQGJYYYxq7v5yYe4qPHRays6"
);

export const DEVNET_ENDPOINT = "https://api.devnet.solana.com";

export const getPDAs = (
  payerKey: PublicKey,
  providerKey: PublicKey,
  createdAt: BN
) => {
  const [config] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("config"),
      payerKey.toBuffer(),
      providerKey.toBuffer(),
      createdAt.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );

  const [agreementState] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), config.toBuffer()],
    PROGRAM_ID
  );

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), config.toBuffer()],
    PROGRAM_ID
  );

  return { config, agreementState, vault };
};

export const getTimestamp = (): BN => {
  return new BN(Math.floor(Date.now() / 1000));
};