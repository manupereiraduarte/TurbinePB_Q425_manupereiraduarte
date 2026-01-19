import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SportsComplex } from "../target/types/sports_complex";
import { assert } from "chai";

describe("court-reservations", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SportsComplex as Program<SportsComplex>;

  const complex = anchor.web3.Keypair.generate();
  const MAX_COURTS = new anchor.BN(3);
  const authority = provider.wallet.publicKey;

  beforeEach(async () => {
    const modifyComputeUnits = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000,
    });
  });

  // --- 1. Initialization ---
  it("Initializes the sports complex state!", async () => {
    await program.methods
      .initializeComplex(MAX_COURTS)
      .accounts({
        complex: complex.publicKey,
        authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([complex])
      .rpc();

    const account = await program.account.complex.fetch(complex.publicKey);

    assert.equal(account.maxCourts.toNumber(), MAX_COURTS.toNumber(), "Max courts should be 3");
    assert.equal(account.totalReservations.toNumber(), 0, "Initial reservations must be 0");
    assert.ok(account.authority.equals(authority), "Authority must match the initializer");
  });

  // --- 2. Reserve successfully ---
  it("Reserves a court successfully and increments the count", async () => {
    await program.methods
      .reserveCourt()
      .accounts({
        complex: complex.publicKey,
      })
      .rpc();

    let account = await program.account.complex.fetch(complex.publicKey);
    assert.equal(account.totalReservations.toNumber(), 1, "Total reservations should be 1 after first reservation");

    await program.methods.reserveCourt().accounts({ complex: complex.publicKey }).rpc();
    await program.methods.reserveCourt().accounts({ complex: complex.publicKey }).rpc();

    account = await program.account.complex.fetch(complex.publicKey);
    assert.equal(account.totalReservations.toNumber(), 3, "Total reservations should be 3 (max)");
  });

  // --- 3. Fails to reserve beyond max ---
  it("Fails to reserve a court when max courts are reserved", async () => {
    try {
      await program.methods
        .reserveCourt()
        .accounts({
          complex: complex.publicKey,
        })
        .rpc();

      assert.fail("The transaction should have failed due to NoCourtsAvailable error.");
    } catch (error) {
      const err = error as anchor.AnchorError;
      assert.include(
        err.error.errorMessage,
        "There are no courts available for reservation at this time.",
        "Should throw NoCourtsAvailable error"
      );
    }
  });

  // --- 4. Cancel successfully ---
  it("Cancels a reservation successfully and decrements the count", async () => {
    await program.methods
      .cancelReservation()
      .accounts({
        complex: complex.publicKey,
      })
      .rpc();

    const account = await program.account.complex.fetch(complex.publicKey);
    assert.equal(account.totalReservations.toNumber(), 2, "Total reservations should be 2 after cancellation");

    await program.methods.cancelReservation().accounts({ complex: complex.publicKey }).rpc();
    await program.methods.cancelReservation().accounts({ complex: complex.publicKey }).rpc();
  });

  // --- 5. Fails to cancel when count is zero ---
  it("Fails to cancel when there are no active reservations", async () => {
    try {
      await program.methods
        .cancelReservation()
        .accounts({
          complex: complex.publicKey,
        })
        .rpc();

      assert.fail("The transaction should have failed due to NoActiveReservations error.");
    } catch (error) {
      const err = error as anchor.AnchorError;
      assert.include(
        err.error.errorMessage,
        "There are no active reservations to cancel.",
        "Should throw NoActiveReservations error"
      );
    }
  });

  // --- 6. Resets successfully (authority only) ---
  it("Resets the total reservations when called by the authority", async () => {
    await program.methods.reserveCourt().accounts({ complex: complex.publicKey }).rpc();

    await program.methods
      .resetReservations()
      .accounts({
        complex: complex.publicKey,
        authority,
      })
      .rpc();

    const account = await program.account.complex.fetch(complex.publicKey);
    assert.equal(account.totalReservations.toNumber(), 0, "Total reservations should be 0 after reset");
  });

  // --- 7. Fails to reset (non-authority) ---
  it("Fails to reset reservations when called by a non-authority", async () => {
    const otherUser = anchor.web3.Keypair.generate();

    try {
      await program.methods
        .resetReservations()
        .accounts({
          complex: complex.publicKey,
          authority: otherUser.publicKey,
        })
        .signers([otherUser])
        .rpc();

      assert.fail("The transaction should have failed due to Unauthorized error.");
    } catch (error) {
      const err = error as anchor.AnchorError;
      assert.include(
        err.error.errorMessage,
        "Only the complex authority can perform this action.",
        "Should throw Unauthorized error"
      );
    }
  });
});
