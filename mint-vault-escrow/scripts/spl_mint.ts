import {Keypair, PublicKey, Connection, Commitment} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import wallet from "/home/manupereiraduarte/.config/solana/id.json";

const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));
const commitment : Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

const token_decimals = 1_000_000; // 6 decimals

const mint = new PublicKey("DhnECUN4yPciFKTM5pz4MXKw96WK6P7U1GmmM7MEAR6v");

(async() => {
    try {
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey
        );
        console.log(`Your ata is: ${ata.address.toBase58()}`);
        const mintTx = await mintTo(
            connection,
            keypair,
            mint,
            ata.address,
            keypair.publicKey,
            8444449
        );
        console.log(`Mint tx: ${mintTx}`);

        
    } catch (error) {
        console.error("Error minting tokens:", error);
    }
})();