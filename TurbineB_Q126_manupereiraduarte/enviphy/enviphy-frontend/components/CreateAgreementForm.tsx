"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { getPDAs, getTimestamp, DEMO_PROVIDER } from "@/lib/constants";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";

type FormState = {
  tempMin: string;
  tempMax: string;
  humidityMin: string;
  humidityMax: string;
  duration: string;
  gracePeriod: string;
  amount: string;
};

const DEFAULT_FORM: FormState = {
  tempMin: "2",
  tempMax: "8",
  humidityMin: "40",
  humidityMax: "60",
  duration: "604800",
  gracePeriod: "600",
  amount: "1",
};

type Status = "idle" | "loading" | "success" | "error";

export const CreateAgreementForm = () => {
  const { publicKey } = useWallet();
  const { program } = useAnchorProgram();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<Status>("idle");
  const [txSig, setTxSig] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!publicKey || !program) return;

    setStatus("loading");
    setError("");
    setTxSig("");

    try {
      const createdAt = getTimestamp();
      const { config, agreementState, vault } = getPDAs(
        publicKey,
        DEMO_PROVIDER,
        createdAt
      );

      const amountLamports = new BN(
        Math.floor(parseFloat(form.amount) * 1_000_000_000)
      );

      const tx = await program.methods
        .initializeAgreement(
          parseFloat(form.tempMin),
          parseFloat(form.tempMax),
          parseFloat(form.humidityMin),
          parseFloat(form.humidityMax),
          new BN(parseInt(form.duration)),
          new BN(parseInt(form.gracePeriod)),
          amountLamports,
          publicKey,
          DEMO_PROVIDER,
          createdAt
        )
        .accounts({
          signer: publicKey,
          config,
          agreementState,
          vault,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc({ commitment: "confirmed" });

      setTxSig(tx);
      setStatus("success");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Transaction failed");
      setStatus("error");
    }
  };

  const isDisabled = !publicKey || !program || status === "loading";

  const formatSeconds = (s: number) => {
    if (isNaN(s)) return "—";
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">New Agreement</h1>
        <p className="text-slate-400 mt-2 text-sm">
          Configure the cold chain monitoring parameters and deposit amount.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* Temperature */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">🌡 Temperature Range</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Min (°C)</label>
                <input type="number" name="tempMin" value={form.tempMin} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Max (°C)</label>
                <input type="number" name="tempMax" value={form.tempMax} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">💧 Humidity Range</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Min (%)</label>
                <input type="number" name="humidityMin" value={form.humidityMin} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Max (%)</label>
                <input type="number" name="humidityMax" value={form.humidityMax} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">⏱ Timing</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Duration (seconds)</label>
                <input type="number" name="duration" value={form.duration} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
                <p className="text-slate-600 text-xs mt-1">604800 = 7 days</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Grace Period (seconds)</label>
                <input type="number" name="gracePeriod" value={form.gracePeriod} onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
                <p className="text-slate-600 text-xs mt-1">600 = 10 minutes</p>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">◎ Payment</h2>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount (SOL)</label>
              <input type="number" name="amount" value={form.amount} onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors" />
              <p className="text-slate-600 text-xs mt-1">Amount locked in vault until resolution</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sticky top-24">
            <h2 className="text-white font-semibold mb-4">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Payer</span><span className="text-slate-300">{publicKey ? `${publicKey.toBase58().slice(0, 8)}...` : "Not connected"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="text-slate-300">{`${DEMO_PROVIDER.toBase58().slice(0, 8)}...`}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Temp Range</span><span className="text-slate-300">{form.tempMin}°C – {form.tempMax}°C</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Humidity</span><span className="text-slate-300">{form.humidityMin}% – {form.humidityMax}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="text-slate-300">{formatSeconds(parseInt(form.duration))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Grace Period</span><span className="text-slate-300">{formatSeconds(parseInt(form.gracePeriod))}</span></div>
              <div className="border-t border-slate-800 pt-3 mt-3 space-y-3">
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="text-white font-semibold">{form.amount} SOL</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Protocol Fee (1%)</span><span className="text-slate-300">{(parseFloat(form.amount) * 0.01).toFixed(4)} SOL</span></div>
              </div>
            </div>

            {!publicKey && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-amber-400 text-xs">Connect your wallet to create an agreement.</p>
              </div>
            )}

            {status !== "success" && (
              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                className="mt-6 w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 text-sm"
              >
                {status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : "Create Agreement"}
              </button>
            )}

            {status === "success" && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-emerald-400 text-xs font-semibold mb-1">✓ Agreement created!</p>
                <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                  className="text-sky-400 text-xs hover:underline break-all">
                  View on Explorer →
                </a>
              </div>
            )}

            {status === "error" && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs font-semibold mb-1">Transaction failed</p>
                <p className="text-red-300/70 text-xs break-all">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};