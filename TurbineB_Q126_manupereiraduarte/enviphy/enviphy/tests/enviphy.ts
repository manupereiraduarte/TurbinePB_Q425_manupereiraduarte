import { airdrop, payer, providerKp } from "./setup";

// Airdrop global antes de todos los tests
before(async () => {
  await airdrop(payer.publicKey);
  await airdrop(providerKp.publicKey);
});

// Suites — el orden importa
import "./instructions/initialize_agreement.test";
import "./instructions/deposit.test";
import "./instructions/process_telemetry.test";
import "./instructions/resolve_agreement.test";