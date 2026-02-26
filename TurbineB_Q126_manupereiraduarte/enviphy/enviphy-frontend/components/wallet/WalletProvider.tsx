"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { DEVNET_ENDPOINT } from "@/lib/constants";

require("@solana/wallet-adapter-react-ui/styles.css");

export const SolanaWalletProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Lista vacía — wallet-adapter detecta automáticamente las wallets
  // instaladas en el browser (Phantom, Backpack, Solflare, etc.)
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={DEVNET_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};