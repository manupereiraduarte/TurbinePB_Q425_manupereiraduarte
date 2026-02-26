import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useAnchorProgram } from "./useAnchorProgram";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";

export type Agreement = {
  config: any;
  state: any;
  publicKey: PublicKey;
  statePda: PublicKey;
};

export function useAgreements() {
  const { program } = useAnchorProgram();
  const wallet = useAnchorWallet();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgreements = async () => {
    if (!wallet || !program) return;
    setLoading(true);
    try {
      const allConfigs = await (program.account as any).agreementConfig.all();

      const myConfigs = allConfigs.filter(
        (config: any) =>
          config.account.payer.equals(wallet.publicKey) ||
          config.account.provider.equals(wallet.publicKey)
      );

      const agreementsWithState = await Promise.all(
        myConfigs.map(async (config: any) => {
          const [statePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("state"), config.publicKey.toBuffer()],
            program.programId
          );
          try {
            const state = await (program.account as any).agreementState.fetch(statePda);
            return {
              config: config.account,
              state,
              publicKey: config.publicKey,
              statePda,
            };
          } catch (e) {
            return null;
          }
        })
      );

      setAgreements(
        agreementsWithState.filter((a: any): a is Agreement => a !== null)
      );
    } catch (error) {
      console.error("Error fetching agreements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, [wallet, program]);

  return { agreements, loading, refetch: fetchAgreements };
}