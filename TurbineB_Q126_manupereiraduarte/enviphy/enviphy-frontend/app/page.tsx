"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const { publicKey } = useWallet();

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16">
        <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
          Devnet · Live
        </div>

        <h1 className="text-5xl font-bold text-white tracking-tight mb-4">
          Cold Chain
          <span className="text-sky-400"> on-chain.</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">
          Trustless temperature & humidity monitoring agreements. Funds locked
          in vault, released on successful delivery.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/create"
            className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 text-sm"
          >
            Create Agreement
          </Link>
          <Link
            href="/agreements"
            className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 text-slate-300 font-medium px-6 py-3 rounded-lg transition-all duration-200 text-sm"
          >
            View Agreements
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        {[
          { label: "Network", value: "Devnet", sub: "Solana" },
          { label: "Protocol Fee", value: "1%", sub: "of agreement amount" },
          {
            label: "Wallet",
            value: publicKey ? `${publicKey.toBase58().slice(0, 8)}...` : "Not connected",
            sub: publicKey ? "Connected" : "Connect to start",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-white font-semibold text-lg">{stat.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mt-12">
        <h2 className="text-white font-semibold text-lg mb-4">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: "01", title: "Initialize", desc: "Payer sets temperature, humidity ranges and amount." },
            { step: "02", title: "Deposit", desc: "Payer locks funds in on-chain vault." },
            { step: "03", title: "Monitor", desc: "Provider submits telemetry. Breach auto-detected." },
            { step: "04", title: "Resolve", desc: "Funds sent to provider (success) or payer (breach)." },
          ].map((item) => (
            <div key={item.step} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-sky-500 text-xs font-mono font-bold">{item.step}</span>
              <h3 className="text-white font-medium mt-2 mb-1">{item.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}