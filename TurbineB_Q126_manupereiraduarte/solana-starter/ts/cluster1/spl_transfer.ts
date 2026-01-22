import { Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import wallet from "./wallet/turbin3-wallet.json"
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

// Mint address
const mint = new PublicKey("DJEMgZEDLL9Y2K2QUotUNu5vw2jAA9CuNVNxvrzjrSj6");

// Recipient address
const to = new PublicKey("A3C4QJHCEw9BdbyDSYRCSQGJYYYxq7v5yYe4qPHRays6");

(async () => {
    try {
        // Get the token account of the fromWallet address, and if it does not exist, create it
        const sourceAta = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey
        );
        console.log(`Source ATA Address: ${sourceAta.address.toBase58()}`);

        // Get the token account of the toWallet address, and if it does not exist, create it
        const toWalletAta = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            to
        );
        console.log(`Destination ATA Address: ${toWalletAta.address.toBase58()}`);

        const transferTx = await transfer(
            connection,
            keypair,
            sourceAta.address,
            toWalletAta.address,
            keypair,
            10e6 // Transferring 10 tokens
        );
        console.log(`Transfer Transaction: ${transferTx}`);

        // Transfer the new token to the "toTokenAccount" we just created
    } catch(e) {
        console.error(`Oops, something went wrong: ${e}`)
    }
})();