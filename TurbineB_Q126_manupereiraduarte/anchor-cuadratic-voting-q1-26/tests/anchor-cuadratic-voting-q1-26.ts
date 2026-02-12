import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorCuadraticVotingQ126 } from "../target/types/anchor_cuadratic_voting_q1_26";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import { assert } from "chai";

describe("anchor-cuadratic-voting-q1-26", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorCuadraticVotingQ126 as Program<AnchorCuadraticVotingQ126>;
  
  const creator = provider.wallet;
  const voter1 = Keypair.generate();
  const voter2 = Keypair.generate();
  
  let mint: PublicKey;
  let creatorTokenAccount: PublicKey;
  let voter1TokenAccount: PublicKey;
  let voter2TokenAccount: PublicKey;
  
  const daoName = "Test DAO";
  const proposalMetadata = "Should we build a new feature?";

  before(async () => {
    // Airdrop SOL a los votantes
    const airdropTx1 = await provider.connection.requestAirdrop(
      voter1.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx1);

    const airdropTx2 = await provider.connection.requestAirdrop(
      voter2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx2);

    // Crear mint de tokens
    mint = await createMint(
      provider.connection,
      creator.payer,
      creator.publicKey,
      null,
      9
    );

    // Crear cuentas de tokens
    const creatorAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      mint,
      creator.publicKey
    );
    creatorTokenAccount = creatorAta.address;

    const voter1Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      mint,
      voter1.publicKey
    );
    voter1TokenAccount = voter1Ata.address;

    const voter2Ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator.payer,
      mint,
      voter2.publicKey
    );
    voter2TokenAccount = voter2Ata.address;

    // Mintear tokens: 100 tokens = 10 créditos de voto (sqrt(100) = 10)
    await mintTo(
      provider.connection,
      creator.payer,
      mint,
      voter1TokenAccount,
      creator.publicKey,
      100_000_000_000 // 100 tokens con 9 decimales
    );

    // 25 tokens = 5 créditos de voto (sqrt(25) = 5)
    await mintTo(
      provider.connection,
      creator.payer,
      mint,
      voter2TokenAccount,
      creator.publicKey,
      25_000_000_000 // 25 tokens con 9 decimales
    );
  });

  it("Inicializa un DAO", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("dao"),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName)
      ],
      program.programId
    );

    await program.methods
      .initDao(daoName)
      .accounts({
        creator: creator.publicKey,
        daoAccount: daoPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const daoAccount = await program.account.dao.fetch(daoPda);
    
    assert.equal(daoAccount.name, daoName);
    assert.ok(daoAccount.authority.equals(creator.publicKey));
    assert.equal(daoAccount.proposalCount.toNumber(), 0);
    
    console.log("✅ DAO inicializado:", daoAccount.name);
  });

  it("Crea una propuesta", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("dao"),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName)
      ],
      program.programId
    );

    const daoAccountBefore = await program.account.dao.fetch(daoPda);
    const proposalCount = daoAccountBefore.proposalCount.toNumber();

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(proposalCount).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    await program.methods
      .initProposal(proposalMetadata)
      .accounts({
        creator: creator.publicKey,
        daoAccount: daoPda,
        proposal: proposalPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const proposal = await program.account.proposal.fetch(proposalPda);
    const daoAccountAfter = await program.account.dao.fetch(daoPda);
    
    assert.equal(proposal.metadata, proposalMetadata);
    assert.ok(proposal.authority.equals(creator.publicKey));
    assert.equal(proposal.yesVoteCount.toNumber(), 0);
    assert.equal(proposal.noVoteCount.toNumber(), 0);
    assert.equal(daoAccountAfter.proposalCount.toNumber(), 1);
    
    console.log("✅ Propuesta creada:", proposal.metadata);
  });

  it("Voter1 vota SÍ (100 tokens = 10 créditos)", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("dao"),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName)
      ],
      program.programId
    );

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [votePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        voter1.publicKey.toBuffer(),
        proposalPda.toBuffer()
      ],
      program.programId
    );

    await program.methods
      .castVote(1) // 1 = SÍ
      .accounts({
        voter: voter1.publicKey,
        daoAccount: daoPda,
        proposal: proposalPda,
        voteAccount: votePda,
        creatorTokenAccount: voter1TokenAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter1])
      .rpc();

    const vote = await program.account.vote.fetch(votePda);
    const proposal = await program.account.proposal.fetch(proposalPda);
    
    assert.ok(vote.authority.equals(voter1.publicKey));
    assert.equal(vote.voteType, 1);
    assert.equal(vote.voteCredits.toNumber(), 10); // sqrt(100)
    assert.equal(proposal.yesVoteCount.toNumber(), 10);
    
    console.log("✅ Voter1 votó SÍ con 10 créditos");
  });

  it("Voter2 vota NO (25 tokens = 5 créditos)", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("dao"),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName)
      ],
      program.programId
    );

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [votePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        voter2.publicKey.toBuffer(),
        proposalPda.toBuffer()
      ],
      program.programId
    );

    await program.methods
      .castVote(0) // 0 = NO
      .accounts({
        voter: voter2.publicKey,
        daoAccount: daoPda,
        proposal: proposalPda,
        voteAccount: votePda,
        creatorTokenAccount: voter2TokenAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter2])
      .rpc();

    const vote = await program.account.vote.fetch(votePda);
    const proposal = await program.account.proposal.fetch(proposalPda);
    
    assert.ok(vote.authority.equals(voter2.publicKey));
    assert.equal(vote.voteType, 0);
    assert.equal(vote.voteCredits.toNumber(), 5); // sqrt(25)
    assert.equal(proposal.yesVoteCount.toNumber(), 10);
    assert.equal(proposal.noVoteCount.toNumber(), 5);
    
    console.log("✅ Voter2 votó NO con 5 créditos");
    console.log("📊 Resultado: SÍ=10, NO=5");
  });

  it("No permite votar dos veces", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("dao"),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName)
      ],
      program.programId
    );

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const [votePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        voter1.publicKey.toBuffer(),
        proposalPda.toBuffer()
      ],
      program.programId
    );

    try {
      await program.methods
        .castVote(0)
        .accounts({
          voter: voter1.publicKey,
          daoAccount: daoPda,
          proposal: proposalPda,
          voteAccount: votePda,
          creatorTokenAccount: voter1TokenAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter1])
        .rpc();
      
      assert.fail("Debería haber fallado");
    } catch (error) {
      assert.ok(error.message.includes("already in use"));
      console.log("✅ Correctamente previene doble voto");
    }
  });
});