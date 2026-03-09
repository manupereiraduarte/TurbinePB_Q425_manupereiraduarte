"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useAgreements } from "@/hooks/useAgreements";
import Link from "next/link";

const statusLabel: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  expired: { label: "Expired — Ready to Resolve", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  breached: { label: "Breached", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  completed: { label: "Completed", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  refunded: { label: "Refunded", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
};

const getStatus = (state: any, config: any) => {
  if (state.status.completed !== undefined) return "completed";
  if (state.status.refunded !== undefined) return "refunded";
  if (state.status.breached !== undefined) return "breached";
  if (state.status.active !== undefined) {
    if (state.isFunded) {
      const now = Math.floor(Date.now() / 1000);
      const expired = now >= state.startTime.toNumber() + config.duration.toNumber();
      if (expired) return "expired";
    }
    return "active";
  }
  return "active";
};

const formatSeconds = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export default function AgreementsPage() {
  const { publicKey } = useWallet();
  const { agreements, loading, refetch } = useAgreements();

  if (!publicKey) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-400">Connect your wallet to see your agreements.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">My Agreements</h1>
          <p className="text-slate-400 text-sm mt-1">
            {agreements.length} agreement{agreements.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refetch}
            className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-all"
          >
            Refresh
          </button>
          <Link
            href="/create"
            className="bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
          >
            + New
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : agreements.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-sm">No agreements found.</p>
          <Link href="/create" className="text-sky-400 text-sm hover:underline mt-2 inline-block">
            Create your first agreement →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {agreements.map((agreement) => {
            const status = getStatus(agreement.state, agreement.config);
            const statusStyle = statusLabel[status];
            const role = agreement.config.payer.equals(publicKey) ? "Payer" : "Provider";

            return (
              <Link
                key={agreement.publicKey.toBase58()}
                href={`/agreements/${agreement.publicKey.toBase58()}`}
                className="block bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl p-6 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle.color}`}>
                        {statusStyle.label}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                        {role}
                      </span>
                    </div>
                    <p className="text-white font-mono text-sm">
                      {agreement.publicKey.toBase58().slice(0, 16)}...
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-white font-semibold">
                      {(agreement.config.amount.toNumber() / 1_000_000_000).toFixed(2)} SOL
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {formatSeconds(agreement.config.duration.toNumber())} duration
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-800 text-xs">
                  <div>
                    <p className="text-slate-500">Temp Range</p>
                    <p className="text-slate-300 mt-0.5">
                      {agreement.config.tempMin}°C – {agreement.config.tempMax}°C
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Humidity</p>
                    <p className="text-slate-300 mt-0.5">
                      {agreement.config.humidityMin}% – {agreement.config.humidityMax}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Measurements</p>
                    <p className="text-slate-300 mt-0.5">
                      {agreement.state.measurementCount.toNumber()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Funded</p>
                    <p className="text-slate-300 mt-0.5">
                      {agreement.state.isFunded ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}