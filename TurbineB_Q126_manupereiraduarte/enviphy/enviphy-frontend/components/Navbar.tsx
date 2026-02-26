"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

export const Navbar = () => {
  const { publicKey } = useWallet();

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-sky-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="font-semibold text-white tracking-tight">
              Enviphy
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/create" className="text-slate-400 hover:text-white transition-colors">
              New Agreement
            </Link>
            <Link href="/agreements" className="text-slate-400 hover:text-white transition-colors">
              My Agreements
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {publicKey && (
            <span className="hidden sm:block text-xs text-slate-500 font-mono bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          )}
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
};