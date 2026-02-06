# Architecture Diagram
![alt text](<WhatsApp Image 2026-02-06 at 11.30.54.jpeg>)
## Architecture Layers

The system is organized into four main layers:

## 1. External Actors

- **Payer Account**:  
  Initiates agreements by defining SLA parameters and depositing funds into escrow.  
  Triggers settlement after expiration and receives refunds in case of breaches.

- **Provider Account**:  
  Responsible for maintaining environmental conditions within agreed parameters.  
  Receives automatic payment upon successful compliance.

## 2. Device Layer (Hardware Oracle)

- **Sensors (Temp/Humidity)**:  
  Physical sensors that measure environmental conditions in real-time.

- **ESP32 Microcontroller**:  
  Acts as a Physical Oracle, collecting sensor data and processing it locally.

- **Cryptographic Signer (Ed25519)**:  
  Signs telemetry data cryptographically before submission to ensure data authenticity and prevent tampering.

## 3. Solana Blockchain (On-Chain)

### Enviphy Program (Anchor Smart Contract)

The core logic of the protocol, implemented as a Rust-based Anchor program with the following responsibilities:

- **Validates Signature**:  
  Verifies Ed25519 signatures from ESP32 devices.

- **Checks Thresholds**:  
  Compares incoming telemetry against SLA rules (temperature and humidity ranges).

- **Updates Status**:  
  Marks agreement as breached if conditions are violated or connectivity is lost.

- **Locks/Unlocks Funds**:  
  Manages escrow via Cross-Program Invocations (CPIs) to Solana's System Program.

- **Emits Events**:  
  Publishes on-chain events for audit trail and real-time monitoring.

### Program Accounts (PDAs)

- **Agreement State (PDA)**:  
  Stores SLA rules, current status, and last heartbeat timestamp.

- **Escrow Vault (PDA)**:  
  Holds locked SOL/SPL tokens under program authority until settlement.

## 4. Interface & Monitoring

- **On-Chain Events (Audit Trail)**:  
  Immutable logs emitted by the program for every state change.

- **Enviphy Dashboard (React/Next.js)**:  
  Web interface providing real-time status queries and historical event visualization.

## Key Flows

- **Initialize Agreement**:  
  Payer creates SLA, program creates PDAs and locks funds in vault.

- **Process Telemetry**:  
  ESP32 submits signed data, program validates and updates agreement state.

- **Resolve Agreement**:  
  After expiration, anyone can trigger settlement:  
  - If Status **Active** → Payout to Provider  
  - If Status **Breached** → Refund to Payer

## Trustless Guarantees

- **No intermediaries**: Smart contract acts as neutral arbiter.
- **Cryptographic verification**: Ed25519 signatures ensure data authenticity.
- **Automatic execution**: Settlements trigger based on objective on-chain state.
- **Immutable audit trail**: All events permanently recorded on Solana blockchain.