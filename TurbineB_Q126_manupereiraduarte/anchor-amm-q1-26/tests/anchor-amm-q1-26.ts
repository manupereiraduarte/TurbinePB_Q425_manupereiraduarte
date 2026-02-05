import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AnchorAmmQ126 } from "../target/types/anchor_amm_q1_26";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("anchor-amm-q1-26", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorAmmQ126 as Program<AnchorAmmQ126>;
  const connection = provider.connection;

  const admin = Keypair.generate();
  
  let mintX: PublicKey;
  let mintY: PublicKey;
  let userXAccount: PublicKey;
  let userYAccount: PublicKey;
  let config: PublicKey;
  let mintLp: PublicKey;
  let vaultX: PublicKey;
  let vaultY: PublicKey;
  let userLp: PublicKey;

  const seed = new BN(Math.floor(Math.random() * 1000000));
  const fee = 300; // 3% fee

  before(async () => {
    console.log("Setting up test environment...");

    // airdrop to admin
    const airdropSignature = await connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL);
    
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    }, "confirmed"); 

    console.log("Admin airdropped 10 SOL");
    
    // create mints
    mintX = await createMint(
      connection,
      admin, 
      admin.publicKey, 
      null,
      6
    );
    console.log("Mint X created:", mintX.toBase58());

    mintY = await createMint(
      connection,
      admin,
      admin.publicKey,
      null,
      6
    );
    console.log("Mint Y created:", mintY.toBase58());

    // Create users ata
    const userXAta = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      mintX,
      admin.publicKey
    );
    userXAccount = userXAta.address;

    const userYAta = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      mintY,
      admin.publicKey
    );
    userYAccount = userYAta.address;

    // Mint tokens
    await mintTo(
      connection,
      admin,
      mintX,
      userXAccount,
      admin.publicKey, 
      1_000_000_000
    );

    await mintTo(
      connection,
      admin,
      mintY,
      userYAccount,
      admin.publicKey,
      1_000_000_000
    );

    console.log("User tokens minted");

    const uX = await getAccount(connection, userXAccount);
    const uY = await getAccount(connection, userYAccount);
    console.log("-----------------------------------------");
    console.log("[Setup] User X Balance:", uX.amount.toString());
    console.log("[Setup] User Y Balance:", uY.amount.toString());
    console.log("-----------------------------------------");

    // Derive PDAs
    [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    [mintLp] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), config.toBuffer()],
      program.programId
    );
    
    // calculate vault addresses
    vaultX = await getAssociatedTokenAddress(mintX, config, true);
    vaultY = await getAssociatedTokenAddress(mintY, config, true);
  });

  it("1. Initialize pool", async () => {
    console.log("\n--- TEST: Initialize Pool ---");
    
    const tx = await program.methods
      .initialize(seed, fee, null)
      .accounts({
        initializer: admin.publicKey,
        mintX: mintX,
        mintY: mintY,
        config: config,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin]) 
      .rpc();

    console.log("Initialize transaction signature:", tx);

    // Verify config
    const configAccount = await program.account.config.fetch(config);
    assert.equal(configAccount.fee, fee);
    assert.equal(configAccount.locked, false);
    
    const vX = await getAccount(connection, vaultX);
    const vY = await getAccount(connection, vaultY);

    console.log("-----------------------------------------");
    console.log("[Initialize] Vault X Balance:", vX.amount.toString());
    console.log("[Initialize] Vault Y Balance:", vY.amount.toString());
    console.log("-----------------------------------------");

    console.log("✅ Pool initialized successfully");
  });

  it("2. Deposit initial liquidity", async () => {
    console.log("\n--- TEST: Deposit Initial Liquidity ---");
    
    const amount = new BN(100_000_000);
    const maxX = new BN(100_000_000);
    const maxY = new BN(100_000_000);

    userLp = await getAssociatedTokenAddress(mintLp, admin.publicKey);

    const tx = await program.methods
      .deposit(amount, maxX, maxY)
      .accounts({
        user: admin.publicKey,
        mintX: mintX,
        mintY: mintY,
        mintLp: mintLp,     
        vaultX: vaultX,     
        vaultY: vaultY,    
        userX: userXAccount,
        userY: userYAccount,
        userLp: userLp,     
        config: config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    console.log("Deposit transaction signature:", tx);

    const userLpAccount = await getAccount(connection, userLp);
    assert.equal(userLpAccount.amount.toString(), amount.toString());

    const vX = await getAccount(connection, vaultX);
    const vY = await getAccount(connection, vaultY);
    const uX = await getAccount(connection, userXAccount);
    const uY = await getAccount(connection, userYAccount);
    const uLp = await getAccount(connection, userLp);

    console.log("-----------------------------------------");
    console.log("[Deposit] Vault X Balance:", vX.amount.toString());
    console.log("[Deposit] Vault Y Balance:", vY.amount.toString());
    console.log("[Deposit] User X Balance: ", uX.amount.toString());
    console.log("[Deposit] User Y Balance: ", uY.amount.toString());
    console.log("[Deposit] User LP Balance:", uLp.amount.toString());
    console.log("-----------------------------------------");

    console.log("✅ Liquidity deposited successfully");
  });

  it("3. Swap X for Y", async () => {
    console.log("\n--- TEST: Swap X for Y ---");
    
    const amountIn = new BN(10_000_000);
    const minAmountOut = new BN(1);

    const userXBefore = await getAccount(connection, userXAccount);
    const userYBefore = await getAccount(connection, userYAccount);

    const tx = await program.methods
      .swap(true, amountIn, minAmountOut) // is_x = true
      .accounts({
        user: admin.publicKey,
        mintX: mintX,
        mintY: mintY,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userXAccount,
        userY: userYAccount,
        config: config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    const userXAfter = await getAccount(connection, userXAccount);
    const userYAfter = await getAccount(connection, userYAccount);

    const xSpent = userXBefore.amount - userXAfter.amount;
    const yReceived = userYAfter.amount - userYBefore.amount;

    assert.equal(xSpent.toString(), amountIn.toString());
    assert.isTrue(yReceived > 0n);

    const vX = await getAccount(connection, vaultX);
    const vY = await getAccount(connection, vaultY);

    console.log("-----------------------------------------");
    console.log("[Swap X->Y] Vault X Balance (Increased):", vX.amount.toString());
    console.log("[Swap X->Y] Vault Y Balance (Decreased):", vY.amount.toString());
    console.log("[Swap X->Y] User X Balance (Spent):     ", userXAfter.amount.toString());
    console.log("[Swap X->Y] User Y Balance (Received):  ", userYAfter.amount.toString());
    console.log("-----------------------------------------");

    console.log("✅ Swap X for Y successful");
  });

  it("4. Swap Y for X", async () => {
    console.log("\n--- TEST: Swap Y for X ---");
    
    const amountIn = new BN(5_000_000);
    const minAmountOut = new BN(1);

    const userXBefore = await getAccount(connection, userXAccount);
    const userYBefore = await getAccount(connection, userYAccount);

    const tx = await program.methods
      .swap(false, amountIn, minAmountOut) // is_x = false
      .accounts({
        user: admin.publicKey,
        mintX: mintX,
        mintY: mintY,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userXAccount,
        userY: userYAccount,
        config: config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    const userXAfter = await getAccount(connection, userXAccount);
    const userYAfter = await getAccount(connection, userYAccount);

    assert.isTrue(userXAfter.amount > userXBefore.amount);

    const vX = await getAccount(connection, vaultX);
    const vY = await getAccount(connection, vaultY);

    console.log("-----------------------------------------");
    console.log("[Swap Y->X] Vault X Balance (Decreased):", vX.amount.toString());
    console.log("[Swap Y->X] Vault Y Balance (Increased):", vY.amount.toString());
    console.log("[Swap Y->X] User X Balance (Received):  ", userXAfter.amount.toString());
    console.log("[Swap Y->X] User Y Balance (Spent):     ", userYAfter.amount.toString());
    console.log("-----------------------------------------");

    console.log("✅ Swap Y for X successful");
  });

  it("5. Withdraw liquidity", async () => {
    console.log("\n--- TEST: Withdraw Liquidity ---");
    
    const userLpBefore = await getAccount(connection, userLp);
    const amount = new BN(userLpBefore.amount.toString());
    const minX = new BN(1);
    const minY = new BN(1);

    const tx = await program.methods
      .withdraw(amount, minX, minY)
      .accounts({
        user: admin.publicKey,
        mintX: mintX,
        mintY: mintY,
        mintLp: mintLp,
        vaultX: vaultX,
        vaultY: vaultY,
        userX: userXAccount,
        userY: userYAccount,
        userLp: userLp,
        config: config,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();
    
    const vX = await getAccount(connection, vaultX);
    const vY = await getAccount(connection, vaultY);
    const uX = await getAccount(connection, userXAccount);
    const uY = await getAccount(connection, userYAccount);
    const uLp = await getAccount(connection, userLp);

    console.log("-----------------------------------------");
    console.log("[Withdraw] Vault X Balance (Decreased):", vX.amount.toString());
    console.log("[Withdraw] Vault Y Balance (Decreased):", vY.amount.toString());
    console.log("[Withdraw] User X Balance (Increased): ", uX.amount.toString());
    console.log("[Withdraw] User Y Balance (Increased): ", uY.amount.toString());
    console.log("[Withdraw] User LP Balance (Burned):   ", uLp.amount.toString());
    console.log("-----------------------------------------");

    console.log("✅ Liquidity withdrawn successfully");
  });
});