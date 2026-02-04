# Capstone Project User Stories & On-Chain Requirements  
**Manuel Pereira Duarte – Async Builders Q126**

---

## 1. User Personas

### Product and Conservation Service Provider

This is the entity that sells the product or service. It is the entity that assumes the economic cost of  
maintaining the environment. This could be a logistics SME, an office owner, a warehousing company, or  
any stakeholder that needs to guarantee certain environmental conditions to protect an asset or service.

It contractually commits to complying with the environmental ranges defined by the buyer. Its payment  
depends directly on IoT sensors certifying that the product was stored as agreed.

It represents a verifiable business model. The Proof of Concept demonstrates that a supplier can offer  
genuine quality guarantees and collect payment automatically without relying on manual inspections or  
subsequent disputes.

---

### Responsible Operator for the Environment

This is the operational actor responsible for maintaining environmental conditions within agreed-upon  
parameters. This could be a food transporter, a maintenance technician, a logistics operator, or anyone  
directly responsible for the physical control of the environment.

They interact indirectly with the system through a device (for example, an ESP32), which objectively  
measures their performance. If they meet the defined ranges, the smart contract automatically processes  
the payment to them.

It is essential because it allows for the validation of incentive coordination. The Proof of Concept  
demonstrates that good performance is rewarded immediately, transparently, and without bureaucracy,  
eliminating disputes, manual audits, and payment delays typical of current schemes.

---

### Buyer of Product with Environmental Guarantee

This is the customer who purchases the product or service and requires it to arrive in optimal  
environmental conditions. This could be an importer, distributor, supermarket, laboratory, or B2B client.

They deposit the funds into the smart contract before the service is delivered. They define acceptable  
environmental parameters (temperature, humidity, tolerances) and agree that the payment will be held  
until physical data verifies compliance.

It is essential for demonstrating trust without intermediaries. It represents the most vulnerable party in  
the agreement and proves that the system eliminates the need for claims, audits, or litigation, as the  
physical facts directly trigger financial execution.

---

## 2. User Stories & On-Chain Requirements

### 1. Establishment of the Rules of Service

As a buyer, I want to set the temperature/humidity thresholds and the duration of the agreement, so  
that the rules of economic execution are objective and public from the start.

**On-chain requirements**

- Agreement State Account: A space in the blockchain memory (PDA) that stores the allowed  
  temperature and humidity limits.

---

### 2. Secure Payment Deposit

As a buyer, I want to place the money in a neutral deposit within the system, so that the worker has the  
guarantee that the funds are reserved and will be released only if they fulfill their duties.

**On-chain requirements**

- Vault Account: A system account controlled exclusively by your Solana program to safeguard  
  funds.

---

### 3. Automatic Payment for Compliance

As a supplier, I want the money to be automatically transferred, if I managed to keep the environment  
within the agreed limits, so I can collect my payment immediately and without any paperwork.

**On-chain requirements**

- Verification Engine: Internal logic that compares the data received from the sensor against the  
  rules established in the first story.

---

### 4. Automatic Recovery for Non-Compliance

As a buyer, I want the system to automatically refund my money if the environment was not  
maintained in the agreed conditions, so I can recover my investment without having to initiate a  
legal claim.

**On-chain requirements**

- Escrow program

---

### 5. Real Test Consultation

As an operator, I want to see the history of the exact measurements recorded by the device, to confirm  
with real evidence the reason why the money was given or returned.

**On-chain requirements**

- Events: Lightweight logs that the program emits each time it processes a measurement, allowing  
  the process to be audited without saturating the memory.

---

### 6. Connectivity Monitoring (Keep-alive)

As a buyer, I want the system to automatically detect if the device stops sending signals, to pause or  
refund my money if the monitoring is interrupted for too long.

**On-chain requirements**

- Last Signal Timestamp: A dedicated data field within the contract account to store the exact  
  network time of the last communication received from the device.
- Inactivity Threshold (Grace Period): A configurable variable defined during the contract setup  
  (e.g., 10 minutes) that sets the maximum allowed silence before a breach is triggered.
- Heartbeat Verification Logic: An internal function to compare the current network time with the  
  stored last_timestamp; if the difference exceeds the threshold, the contract automatically  
  executes a refund or penalty.
- Connectivity Breach Event: An on-chain event emitted by the program when the silence  
  threshold is met, allowing front-end interfaces to display a "Disconnected" status in real time.

---

### Clarification

For this first version I will concentrate on the logic involving the chain, leaving aside for now the  
connection with the hardware until I complete and develop the first version.

---