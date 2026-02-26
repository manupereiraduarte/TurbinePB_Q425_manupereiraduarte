"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PROGRAM_ID } from "@/lib/constants";
import IDL from "@/types/enviphy.json";

export const useAnchorProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const program = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;

    const provider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      },
      { commitment: "confirmed" }
    );

    return new Program(IDL as any, provider);
  }, [connection, wallet.publicKey, wallet.signTransaction]);

  return { program, wallet };
};