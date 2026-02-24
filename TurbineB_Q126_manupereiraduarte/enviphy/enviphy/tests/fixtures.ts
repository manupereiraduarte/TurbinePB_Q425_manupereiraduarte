import * as anchor from "@coral-xyz/anchor";
import { program, payer, providerKp, BASE_PARAMS, getTimestamp, getPDAs } from "./setup";

export interface AgreementFixture {
  config: anchor.web3.PublicKey;
  agreementState: anchor.web3.PublicKey;
  vault: anchor.web3.PublicKey;
  createdAt: anchor.BN;
}

export const createAgreement = async (
  params = BASE_PARAMS
): Promise<AgreementFixture> => {
  const createdAt = getTimestamp();
  const { config, agreementState, vault } = getPDAs(
    payer.publicKey,
    providerKp.publicKey,
    createdAt
  );

  await program.methods
    .initializeAgreement(
      params.tempMin,
      params.tempMax,
      params.humidityMin,
      params.humidityMax,
      params.duration,
      params.gracePeriod,
      params.amount,
      payer.publicKey,
      providerKp.publicKey,
      createdAt,
    )
    .accounts({
      signer: payer.publicKey,
      config,
      agreementState,
      vault,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .signers([payer])
    .rpc({ commitment: "confirmed" });

  return { config, agreementState, vault, createdAt };
};

export const createAndFundAgreement = async (
  params = BASE_PARAMS
): Promise<AgreementFixture> => {
  const fixture = await createAgreement(params);
  const { config, agreementState, vault } = fixture;

  const configAccount = await program.account.agreementConfig.fetch(
    config,
    "confirmed"
  );

  await program.methods
    .depositFunds()
    .accounts({
      payer: payer.publicKey,
      config,
      agreementState,
      vault,
      feeRecipient: configAccount.feeRecipient,
      systemProgram: anchor.web3.SystemProgram.programId,
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    } as any)
    .signers([payer])
    .rpc({ commitment: "confirmed" });

  return fixture;
};