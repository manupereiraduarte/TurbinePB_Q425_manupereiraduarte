# Enviphy - Sequence Diagram (Technical Flow)

This diagram details the step-by-step technical interaction between the various system components: the frontend (Web Dashboard), the Solana wallet, the program (Smart Contract), the state accounts (PDAs), and the hardware (ESP32).

![alt text](<../img/Sequence_Diagram.png>)


### Detailed Technical Phases:
1. **Initialization Phase**: Shows the creation of the "Agreement PDA" and the "Vault PDA," where SLA rules are stored and funds deposited by the Payer are locked.
2. **Monitoring Phase (Loop)**: Illustrates the transmission of signed telemetry from the ESP32 to the Solana blockchain, where the program verifies the cryptographic signature and thresholds in real-time.
3. **Settlement Phase**: Details the logic of "Atomic Settlement." Once the duration expires, the program reads the final state and executes the fund transfer (Payout or Refund) without third-party intervention.