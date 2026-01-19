import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import {TOKEN_2022_PROGRAM_ID,getOrCreateAssociatedTokenAccount,getAccount, getAssociatedTokenAddressSync} from "@solana/spl-token";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";

describe("vault", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);  

  const TOKEN_2022_PROGRAM_ID = new anchor.web3.PublicKey(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  )
  const user = provider.wallet;
  const mintAccount = new anchor.web3.PublicKey("DYxPmi6GRuCNjCKXcDzTpbjbzzsh1pEybcRUWxG8DxCN");
  let userAta: anchor.web3.PublicKey;
  let statePda: anchor.web3.PublicKey;
  let vaultAta: anchor.web3.PublicKey;

  const program = anchor.workspace.vault as Program<Vault>;

  it("Is initialized!", async () => {
    
    //Here we are defining user ATA
    console.log("User Public Key: ", user.publicKey.toBase58());
    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      user.publicKey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
  
    console.log("User ATA: ", userAta.address.toBase58());

    // Derive vaultPDA and statePDA
    const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"),user.publicKey.toBuffer()],
      program.programId
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"),user.publicKey.toBuffer()],
      program.programId
    );

    const vaultAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      vaultPDA,
      true,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Vault ATA:" , vaultAta.address.toBase58());
    
    await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);

    // Add your test here.
    const tx = await program.methods.initialize(new anchor.BN(100)).accountsPartial({
      user: user.publicKey,
      userAta: userAta.address,
      state: statePda,
      vault: vaultPDA,
      vaultMint: mintAccount,
      vaultAta: vaultAta.address,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();
    console.log("Your transaction signature", tx);
    console.log("Balance of vault after initialization: ");
    await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
  });


  // Deposit test
  it("Deposit", async () => { 
    // Derive vaultPDA and statePDA
    const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"),user.publicKey.toBuffer()],
      program.programId
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"),user.publicKey.toBuffer()],
      program.programId
    );


    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      user.publicKey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    
  const vaultAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      vaultPDA,
      true,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
    const tx = await program.methods.deposit(new anchor.BN(1000)).accounts({
      user: user.publicKey,
      vaultMint: mintAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    }).rpc();
  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
  })

  it("Withdraw", async() => {
      // Derive vaultPDA and statePDA
    const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"),user.publicKey.toBuffer()],
      program.programId
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"),user.publicKey.toBuffer()],
      program.programId
    );


    const userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      user.publicKey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    
  const vaultAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      vaultPDA,
      true,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
    const tx = await program.methods.withdraw(new anchor.BN(1000)).accounts({
      user: user.publicKey,
      vaultMint: mintAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    }).rpc();
  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
  })

  it("Lock Vault", async() => {
         // Derive vaultPDA and statePDA
     const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"),user.publicKey.toBuffer()],
      program.programId
    );

    const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"),user.publicKey.toBuffer()],
      program.programId
    );


     const userAta = await getOrCreateAssociatedTokenAccount(
     provider.connection,
     user.payer,
     mintAccount,
     user.publicKey,
     false,
     "confirmed",
     undefined,
     TOKEN_2022_PROGRAM_ID
   );


   const vaultAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       vaultPDA,
       true,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

   await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
     const tx = await program.methods.lock().accounts({
       user: user.publicKey,
       vaultMint: mintAccount,
       tokenProgram: TOKEN_2022_PROGRAM_ID
     }).rpc();
  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
  })


   it("Unlock Vault", async() => {
         // Derive vaultPDA and statePDA
     const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("state"),user.publicKey.toBuffer()],
       program.programId
     );

     const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("vault"),user.publicKey.toBuffer()],
       program.programId
     );


     const userAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       user.publicKey,
       false,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

   const vaultAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       vaultPDA,
       true,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

   await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
     const tx = await program.methods.lock().accounts({
       user: user.publicKey,
       vaultMint: mintAccount,
       tokenProgram: TOKEN_2022_PROGRAM_ID
     }).rpc();
  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
  })


   it("Unlock Vault", async() => {
         // Derive vaultPDA and statePDA
     const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("state"),user.publicKey.toBuffer()],
       program.programId
     );

     const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("vault"),user.publicKey.toBuffer()],
       program.programId
     );


     const userAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       user.publicKey,
       false,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

   const vaultAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       vaultPDA,
       true,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

   await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
     const tx = await program.methods.lock().accounts({
       user: user.publicKey,
       vaultMint: mintAccount,
       tokenProgram: TOKEN_2022_PROGRAM_ID
     }).rpc();
  await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
  })


   it("Unlock Vault", async() => {
         // Derive vaultPDA and statePDA
     const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("state"),user.publicKey.toBuffer()],
       program.programId
     );

     const [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("vault"),user.publicKey.toBuffer()],
       program.programId
     );


     const userAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       user.publicKey,
       false,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

     const vaultAta = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       user.payer,
       mintAccount,
       vaultPDA,
       true,
       "confirmed",
       undefined,
       TOKEN_2022_PROGRAM_ID
     );

   await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
   const tx = await program.methods.unlock().accounts({
     user: user.publicKey,
     vaultMint: mintAccount,
     tokenProgram: TOKEN_2022_PROGRAM_ID
   }).rpc();
   await printBalances(provider.connection, userAta.address,vaultAta.address,TOKEN_2022_PROGRAM_ID);
   })
});


async function printBalances(
  connection: anchor.web3.Connection,
  userAta: anchor.web3.PublicKey,
  vaultAta: anchor.web3.PublicKey,
  tokenProgram: anchor.web3.PublicKey,
  decimals = 6
){
  const userAccountInfo = await getAccount(connection,userAta,undefined,tokenProgram);
  const vaultAccountInfo = await getAccount(connection,vaultAta,undefined,tokenProgram);

  const userBalance = Number(userAccountInfo.amount);
  const vaultBalance = Number(vaultAccountInfo.amount);

  console.log(`User Token Balance: ${userBalance}`);
  console.log(`Vault Token Balance: ${vaultBalance}`);
}