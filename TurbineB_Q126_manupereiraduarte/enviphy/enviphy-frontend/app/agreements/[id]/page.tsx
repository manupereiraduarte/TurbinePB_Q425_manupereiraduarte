"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "@/hooks/useAnchorProgram";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { DEMO_PROVIDER } from "@/lib/constants";
import BN from "bn.js";
import Link from "next/link";

const getStatus = (state: any) => {
  if (state.status.active !== undefined) return "active";
  if (state.status.breached !== undefined) return "breached";
  if (state.status.completed !== undefined) return "completed";
  if (state.status.refunded !== undefined) return "refunded";
  return "active";
};

const statusStyle: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  breached: "text-red-400 bg-red-500/10 border-red-500/20",
  completed: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  refunded: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const formatSeconds = (s: number) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

type TxStatus = "idle" | "loading" | "success" | "error";

export default function AgreementDetailPage() {
  const { id } = useParams();
  const { publicKey } = useWallet();
  const { program } = useAnchorProgram();

  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [statePda, setStatePda] = useState<PublicKey | null>(null);
  const [vaultPda, setVaultPda] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(true);

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txSig, setTxSig] = useState("");
  const [txError, setTxError] = useState("");

  // Telemetry form
  const [temp, setTemp] = useState("5.0");
  const [humidity, setHumidity] = useState("50.0");

  const configPda = id ? new PublicKey(id as string) : null;

  const fetchData = async () => {
    if (!program || !configPda) return;
    setLoading(true);
    try {
      const [sPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("state"), configPda.toBuffer()],
        program.programId
      );
      const [vPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), configPda.toBuffer()],
        program.programId
      );
      setStatePda(sPda);
      setVaultPda(vPda);

      const configData = await (program.account as any).agreementConfig.fetch(configPda);
      const stateData = await (program.account as any).agreementState.fetch(sPda);
      setConfig(configData);
      setState(stateData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [program, id]);

  const handleDeposit = async () => {
    if (!program || !publicKey || !configPda || !statePda || !vaultPda) return;
    setTxStatus("loading");
    setTxError("");
    try {
      const tx = await program.methods
        .depositFunds()
        .accounts({
          payer: publicKey,
          config: configPda,
          agreementState: statePda,
          vault: vaultPda,
          feeRecipient: config.feeRecipient,
          systemProgram: SystemProgram.programId,
          clock: new PublicKey("SysvarC1ock11111111111111111111111111111111"),
        } as any)
        .rpc({ commitment: "confirmed" });
      setTxSig(tx);
      setTxStatus("success");
      await fetchData();
    } catch (e: any) {
      setTxError(e?.message || "Transaction failed");
      setTxStatus("error");
    }
  };

  const handleTelemetry = async () => {
    if (!program || !publicKey || !configPda || !statePda) return;
    setTxStatus("loading");
    setTxError("");
    try {
      const timestamp = new BN(Math.floor(Date.now() / 1000));
      const tx = await program.methods
        .processTelemetry(
          parseFloat(temp),
          parseFloat(humidity),
          timestamp
        )
        .accounts({
          provider: publicKey,
          config: configPda,
          agreementState: statePda,
          clock: new PublicKey("SysvarC1ock11111111111111111111111111111111"),
        } as any)
        .rpc({ commitment: "confirmed" });
      setTxSig(tx);
      setTxStatus("success");
      await fetchData();
    } catch (e: any) {
      setTxError(e?.message || "Transaction failed");
      setTxStatus("error");
    }
  };

  const handleResolve = async () => {
    if (!program || !publicKey || !configPda || !statePda || !vaultPda || !state) return;
    setTxStatus("loading");
    setTxError("");
    try {
      const status = getStatus(state);
      const recipient = status === "breached" ? config.payer : config.provider;
    // DEBUG: Ver qué estás pasando
      console.log("SystemProgram.programId:", SystemProgram.programId.toBase58());
      console.log("Recipient:", recipient.toBase58());
      console.log("Config:", configPda.toBase58());

      const accounts = {
        signer: publicKey,
        config: configPda,
        agreementState: statePda,
        vault: vaultPda,
        recipient,
        systemProgram: SystemProgram.programId,
        clock: new PublicKey("SysvarC1ock11111111111111111111111111111111"),
      };

      console.log("Accounts being passed:", accounts);
      const tx = await program.methods
        .resolveAgreement()
        .accounts({
          signer: publicKey,
          config: configPda,
          agreementState: statePda,
          vault: vaultPda,
          recipient,
          systemProgram: SystemProgram.programId,
          clock: new PublicKey("SysvarC1ock11111111111111111111111111111111"),
        } as any)
        .rpc({ commitment: "confirmed" });
      setTxSig(tx);
      setTxStatus("success");
      await fetchData();
    } catch (e: any) {
      setTxError(e?.message || "Transaction failed");
      setTxStatus("error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!config || !state) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-400">Agreement not found.</p>
        <Link href="/agreements" className="text-sky-400 text-sm hover:underline mt-2 inline-block">
          ← Back to agreements
        </Link>
      </div>
    );
  }

  const status = getStatus(state);
  const isActive = status === "active";
  const now = Math.floor(Date.now() / 1000);
  const hasExpired = config && state && 
    now >= state.startTime.toNumber() + config.duration.toNumber();
  const isFunded = state.isFunded;
  const isPayer = publicKey?.equals(config.payer);
  const isProvider = publicKey?.equals(config.provider);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/agreements" className="text-slate-500 text-sm hover:text-slate-300 transition-colors">
          ← My Agreements
        </Link>
        <div className="flex items-center gap-3 mt-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Agreement Detail</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        <p className="text-slate-500 font-mono text-xs mt-1">{id}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Parameters</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <InfoRow label="Temp Range" value={`${config.tempMin}°C – ${config.tempMax}°C`} />
              <InfoRow label="Humidity" value={`${config.humidityMin}% – ${config.humidityMax}%`} />
              <InfoRow label="Duration" value={formatSeconds(config.duration.toNumber())} />
              <InfoRow label="Grace Period" value={formatSeconds(config.gracePeriod.toNumber())} />
              <InfoRow label="Amount" value={`${(config.amount.toNumber() / 1_000_000_000).toFixed(2)} SOL`} />
              <InfoRow label="Funded" value={isFunded ? "Yes" : "No"} />
            </div>
          </div>

          {/* State */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Live State</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <InfoRow label="Measurements" value={state.measurementCount.toNumber()} />
              <InfoRow label="Last Temp" value={isFunded ? `${state.lastTemperature.toFixed(2)}°C` : "—"} />
              <InfoRow label="Last Humidity" value={isFunded ? `${state.lastHumidity.toFixed(2)}%` : "—"} />
              <InfoRow label="Breach Reason" value={
                state.breachReason.none !== undefined ? "None" :
                state.breachReason.thresholdViolation !== undefined ? "Threshold" :
                "Connectivity"
              } />
            </div>
          </div>

          {/* Telemetry form — solo para provider */}
          {isProvider && isActive && isFunded && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-white font-semibold mb-4">Send Telemetry</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Temperature (°C)</label>
                  <input
                    type="number"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Humidity (%)</label>
                  <input
                    type="number"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>
              <ActionButton onClick={handleTelemetry} loading={txStatus === "loading"} label="Send Telemetry" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Actions</h2>
            <div className="space-y-3">

              {/* Deposit */}
              {isPayer && !isFunded && (
                <ActionButton onClick={handleDeposit} loading={txStatus === "loading"} label="Deposit Funds" />
              )}

              {/* Resolve */}
              {(isPayer || isProvider) && isFunded && (!isActive || hasExpired) && (
                <ActionButton onClick={handleResolve} loading={txStatus === "loading"} label="Resolve Agreement" variant="secondary" />
              )}

              {isActive && isFunded && !hasExpired && (
                <p className="text-slate-500 text-xs text-center">Agreement is active and running.</p>
              )}

              {(status === "completed" || status === "refunded") && (
                <p className="text-slate-500 text-xs text-center">This agreement has been resolved.</p>
              )}
            </div>

            {/* TX feedback */}
            {txStatus === "success" && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-emerald-400 text-xs font-semibold mb-1">✓ Transaction confirmed!</p>
                <a
                  href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 text-xs hover:underline break-all"
                >
                  View on Explorer →
                </a>
              </div>
            )}

            {txStatus === "error" && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs font-semibold mb-1">Transaction failed</p>
                <p className="text-red-300/70 text-xs break-all">{txError}</p>
              </div>
            )}
          </div>

          {/* Parties */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Parties</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1">Payer</p>
                <p className="text-slate-300 font-mono text-xs break-all">{config.payer.toBase58()}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Provider</p>
                <p className="text-slate-300 font-mono text-xs break-all">{config.provider.toBase58()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const InfoRow = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-slate-500 text-xs mb-0.5">{label}</p>
    <p className="text-slate-200">{value}</p>
  </div>
);

const ActionButton = ({
  onClick,
  loading,
  label,
  variant = "primary",
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  variant?: "primary" | "secondary";
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`w-full font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 text-sm disabled:opacity-50 ${
      variant === "primary"
        ? "bg-sky-500 hover:bg-sky-400 text-white"
        : "bg-slate-800 hover:bg-slate-700 text-slate-200"
    }`}
  >
    {loading ? (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Processing...
      </span>
    ) : label}
  </button>
);