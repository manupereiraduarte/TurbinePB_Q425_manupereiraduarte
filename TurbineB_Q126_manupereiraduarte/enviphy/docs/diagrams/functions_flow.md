# Enviphy Program - Function Flow Diagrams

This document contains detailed flow diagrams for each instruction in the Enviphy smart contract.

---

## 1. Initialize Agreement

Creates a new environmental monitoring agreement by setting up PDAs and locking funds in escrow.
```plantuml
@startuml Initialize_Agreement_Flow

title Initialize Agreement - Flow Diagram

start

:Payer calls initialize_agreement();

:Receive parameters:
- temp_min, temp_max
- humidity_min, humidity_max
- duration
- grace_period
- provider_pubkey
- deposit_amount;

:Validate parameters;

if (Parameters valid?) then (yes)
  :Derive Agreement PDA;
  note right
    seeds = [
      b"agreement",
      payer.key(),
      provider.key(),
      timestamp
    ]
  end note
  
  :Create Agreement account;
  
  :Store SLA rules in Agreement:
  - Temperature range
  - Humidity range
  - Duration
  - Grace period
  - Payer & Provider pubkeys;
  
  :Set initial state:
  - status = Active
  - start_time = current_timestamp
  - last_heartbeat = current_timestamp
  - measurement_count = 0;
  
  :Derive Vault PDA;
  note right
    seeds = [
      b"vault",
      agreement.key()
    ]
  end note
  
  :CPI: Transfer funds from Payer to Vault;
  
  if (Transfer successful?) then (yes)
    :Emit AgreementCreated event;
    
    :Return success;
    stop
  else (no)
    :Revert transaction;
    stop
  endif
  
else (no)
  :Return error: InvalidParameters;
  stop
endif

@enduml
```

---

## 2. Process Telemetry

Validates and processes environmental data from the ESP32 oracle, checking signatures, thresholds, and connectivity.

**MVP Implementation:** For the capstone, telemetry data will be simulated through hardcoded values or manual input via frontend/tests. The cryptographic signature validation will use standard Solana wallets instead of ESP32 keypairs. Post-MVP, this will be replaced with actual ESP32-signed telemetry submitted via a relay bridge. ESP32 integration planned for post-capstone phase.
```plantuml
@startuml Process_Telemetry_Flow

title Process Telemetry - Flow Diagram

start

:ESP32 calls process_telemetry();

:Receive parameters:
- temperature
- humidity
- timestamp
- signature (Ed25519);

:Load Agreement account;

partition "Signature Verification" {
  :Verify Ed25519 signature;
  
  if (Signature valid?) then (yes)
    :Continue;
  else (no)
    :Return error: InvalidSignature;
    stop
  endif
}

partition "Timestamp Validation" {
  :Get current blockchain time;
  
  if (timestamp > last_heartbeat AND\ntimestamp <= current_time + 60s?) then (yes)
    :Continue;
  else (no)
    :Return error: InvalidTimestamp;
    stop
  endif
}

partition "Connectivity Check (Keep-Alive)" {
  :Calculate time_since_last_heartbeat;
  
  if (time_since_last_heartbeat > grace_period?) then (yes)
    :Set status = Breached;
    :Set breach_reason = ConnectivityLoss;
    :Emit ConnectivityBreach event;
    :Update last_heartbeat = timestamp;
    :Return early (skip threshold check);
    stop
  else (no)
    :Continue to threshold validation;
  endif
}

partition "Threshold Validation" {
  if (status == Active?) then (yes)
    if (temp < temp_min OR\ntemp > temp_max OR\nhumidity < humidity_min OR\nhumidity > humidity_max?) then (yes)
      :Set status = Breached;
      :Set breach_reason = ThresholdViolation;
      :Emit ThresholdBreach event;
    else (no)
      :Status remains Active;
    endif
  else (already breached)
    :Skip threshold check;
  endif
}

partition "State Update" {
  :Update Agreement:
  - last_temperature = temperature
  - last_humidity = humidity
  - last_heartbeat = timestamp
  - measurement_count += 1;
  
  :Emit TelemetryProcessed event;
}

:Return success;

stop

@enduml
```

---

## 3. Resolve Agreement

Executes final settlement by reading the agreement status and transferring funds to the appropriate party.
```plantuml
@startuml Resolve_Agreement_Flow

title Resolve Agreement - Flow Diagram

start

:Anyone calls resolve_agreement();

:Load Agreement account;

partition "Validation" {
  :Get current blockchain time;
  
  if (current_time >= start_time + duration?) then (yes)
    :Continue;
  else (no)
    :Return error: AgreementNotExpired;
    stop
  endif
  
  if (status == Completed OR\nstatus == Refunded?) then (yes)
    :Return error: AlreadyResolved;
    stop
  else (no)
    :Continue;
  endif
}

partition "Determine Winner" {
  if (status == Active?) then (yes)
    :recipient = provider;
    :final_status = Completed;
    :reason = "SLA fulfilled successfully";
  else (status == Breached)
    :recipient = payer;
    :final_status = Refunded;
    if (breach_reason == ThresholdViolation?) then (yes)
      :reason = "Environmental conditions violated";
    else (ConnectivityLoss)
      :reason = "Device connectivity lost";
    endif
  endif
}

partition "Fund Transfer" {
  :Load Vault PDA;
  
  :Prepare vault authority seeds;
  note right
    seeds = [
      b"vault",
      agreement.key(),
      bump
    ]
  end note
  
  :CPI: System Program transfer();
  note right
    From: Vault PDA
    To: recipient
    Amount: agreement.amount
    Signer: Vault PDA (with seeds)
  end note
  
  if (Transfer successful?) then (yes)
    :Continue;
  else (no)
    :Return error: TransferFailed;
    stop
  endif
}

partition "Finalization" {
  :Update Agreement:
  - status = final_status
  - resolved_at = current_time;
  
  :Emit AgreementResolved event:
  - agreement_id
  - recipient
  - amount
  - final_status
  - reason;
  
  :Return success;
}

stop

@enduml
```
---
## Summary

| Function | Caller | Purpose | Key Validations |
|----------|--------|---------|-----------------|
| **initialize_agreement** | Payer | Create agreement & lock funds | Parameter validity, fund transfer |
| **process_telemetry** | ESP32 Oracle | Validate & update state | Signature, timestamp, thresholds, connectivity |
| **resolve_agreement** | Anyone | Execute settlement | Expiration, not already resolved |

---

## Notes

- All functions emit events for audit trail purposes
- PDAs are derived deterministically using program-defined seeds
- Cross-Program Invocations (CPIs) are used for fund transfers via System Program
- The settlement logic is permissionless - anyone can trigger `resolve_agreement` after expiration