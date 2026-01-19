import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RngGame } from "../target/types/rng_game";

describe("rng-game", () => {
  // Configura el cliente para usar el cluster local
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RngGame as Program<RngGame>;
  const user = provider.wallet;

  beforeEach(async () => {
    // Aumentar límite de compute units para cada test
    const modifyComputeUnits = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
  });

  it("Says hello world!", async () => {
    const tx = await program.methods.helloWorld().rpc();
    console.log("Hello world ejecutado. TX:", tx);
  });

  it("Inicializa el contador en 0", async () => {
    // PDA (o cuenta) para el counter
    const counterKeypair = anchor.web3.Keypair.generate();

    await program.methods
      .initializeCounter()
      .accounts({
        counter: counterKeypair.publicKey,
        user: user.publicKey,
        system_program: anchor.web3.SystemProgram.programId,
      })
      .signers([counterKeypair])
      .rpc();

    const counterAccount = await program.account.counter.fetch(counterKeypair.publicKey);
    console.log("Contador inicializado con valor:", counterAccount.count.toString());

    // Verificamos que empiece en 0
    if (!counterAccount.count.eq(new anchor.BN(0))) {
      throw new Error("El contador no se inicializó correctamente");
    }
  });

  it("Incrementa el contador", async () => {
    const counterKeypair = anchor.web3.Keypair.generate();

    // Inicializamos
    await program.methods
      .initializeCounter()
      .accounts({
        counter: counterKeypair.publicKey,
        user: user.publicKey,
        system_program: anchor.web3.SystemProgram.programId,
      })
      .signers([counterKeypair])
      .rpc();

    // Incrementamos
    await program.methods
      .increment()
      .accounts({
        counter: counterKeypair.publicKey,
      })
      .rpc();

    const counterAccount = await program.account.counter.fetch(counterKeypair.publicKey);
    console.log("✅ Contador incrementado a:", counterAccount.count.toString());
  });

  it("Decrementa el contador", async () => {
    const counterKeypair = anchor.web3.Keypair.generate();

    // Inicializamos
    await program.methods
      .initializeCounter()
      .accounts({
        counter: counterKeypair.publicKey,
        user: user.publicKey,
        system_program: anchor.web3.SystemProgram.programId,
      })
      .signers([counterKeypair])
      .rpc();

    // Decrementamos (quedará en -1)
    await program.methods
      .decrement()
      .accounts({
        counter: counterKeypair.publicKey,
      })
      .rpc();

    const counterAccount = await program.account.counter.fetch(counterKeypair.publicKey);
    console.log("✅ Contador decrementado a:", counterAccount.count.toString());
  });

  it("Inicializa un juego", async () => {
    const gameKeypair = anchor.web3.Keypair.generate();

    await program.methods
      .initializeGame()
      .accounts({
        game: gameKeypair.publicKey,
        user: user.publicKey,
        system_program: anchor.web3.SystemProgram.programId,
      })
      .signers([gameKeypair])
      .rpc();

    const gameAccount = await program.account.game.fetch(gameKeypair.publicKey);
    console.log("✅ Juego inicializado. Estado:", gameAccount.isActive);
    console.log("Número secreto (oculto en producción):", gameAccount.secretNumber.toString());

    if (!gameAccount.isActive) throw new Error("El juego no se inicializó correctamente");
  });

  it("Permite adivinar un número", async () => {
    const gameKeypair = anchor.web3.Keypair.generate();

    // Inicializamos primero el juego
    await program.methods
      .initializeGame()
      .accounts({
        game: gameKeypair.publicKey,
        user: user.publicKey,
        system_program: anchor.web3.SystemProgram.programId,
      })
      .signers([gameKeypair])
      .rpc();

    // Obtenemos el número secreto
    const gameBefore = await program.account.game.fetch(gameKeypair.publicKey);
    const secret = Number(gameBefore.secretNumber);
    console.log("🔢 El número secreto (solo para test) es:", secret);

    // Adivinamos el número correcto
    await program.methods
      .guess(new anchor.BN(secret))
      .accounts({
        game: gameKeypair.publicKey,
      })
      .rpc();

    const gameAfter = await program.account.game.fetch(gameKeypair.publicKey);
    console.log("✅ Juego después de adivinar. isActive:", gameAfter.isActive);

    // Verificamos que se haya desactivado (porque ganó)
    if (gameAfter.isActive) throw new Error("El juego debería haberse terminado");
  });
});