# On-Chain Trade Orchestrator (Comex RWA Platform)

> **A Web3-enabled Foreign Trade Management System built on Solana.**

### 1. What am I building?
I am building a Web3-enabled Foreign Trade Management System. This platform acts as a hybrid orchestration layer for international logistics, connecting Exporters, Importers, Customs Brokers, and Forwarders.

While the user experience resembles a collaborative SaaS (like a project planner), the core infrastructure leverages the **Solana Blockchain** to solve the industry's lack of trust and interoperability.

**The MVP will include:**
* **❖ Proof of Existence (Digital Notary):** A mechanism to hash critical trade documents (e.g., Commercial Invoices) and register them on-chain to ensure immutability and version control.
* **❖ Automated Settlement (Smart Escrow):** A smart contract that holds funds (USDC) and releases them automatically when specific documentation milestones are met/approved by authorized parties.
* **❖ RWA Tokenization:** Representing the "Bill of Lading" (title of cargo ownership) as a digital asset (Token/NFT) on Solana to facilitate easier transfer of ownership and transparency.

---

### 2. Why this project?
This initiative stems from a specific problem identified through conversations with a friend currently working in the sector here in Argentina. We detected that the current state of Foreign Trade is defined by fragmentation and inefficiency. Operations rely on "infinite email threads" and isolated silos of information, leading to a lack of a "Single Source of Truth."

I chose to build this on Solana because trust is the currency of trade. A standard database (SQL) can be tampered with by the administrator; a blockchain cannot.

* **❖ Data Integrity:** By anchoring document hashes on Solana, we eliminate disputes regarding document falsification or versioning errors.
* **❖ Financial Efficiency:** Traditional trade finance (Letters of Credit) is slow and expensive. Solana’s high throughput allows for instant, programmatic settlements that reduce friction and capital costs for exporters.

---

### 3. How do I intend to build it?
I will implement a **Hybrid Architecture** that combines the speed of Web2 with the security of Web3:

* **❖ Off-Chain Layer (The Dashboard):** A Next.js/Node.js application will serve as the interface for the actors (Despachantes, Forwarders, Clients) to upload files (stored in AWS S3) and manage the operational workflow (chat, status updates).

* **❖ On-Chain Layer (The Protocol - Anchor):**
    * **Document Hashing:** When a document is uploaded, the backend will generate a SHA-256 hash. The Anchor program will store this hash in a PDA (Program Derived Address) linked to the specific Operation ID. Any subsequent change to the file off-chain would invalidate the on-chain proof.
    * **Conditional Escrow:** I will build a contract that accepts SPL Tokens (USDC). It will listen for the "Document Approved" state change signed by the Importer/Broker wallet to execute the fund transfer to the Exporter.
    * **Asset Tokenization:** I will use the Metaplex Standard to mint a semi-fungible token or NFT representing the "Bill of Lading." Transfers of this token between wallets will legally signify the transfer of cargo rights.

* **❖ Interaction:** Users will interact with the blockchain via a wallet adapter (Phantom/Backpack), signing transactions only when critical approvals or asset transfers are required.

---
## Architecture Diagram (MVP Scope)

![alt text](<architecture.png>)

## User Stories (MVP Scope)

### 1. Initialize Trade Operation
> "As an Exporter, I want to initialize a new trade operation defining the Importer and **a validity period (Time-Lock)**, so that the deal has a clear expiration date and my assets don't get locked indefinitely."

**Acceptance Criteria:**
* The program must derive a PDA using the `operation_id` and the creator's Pubkey.
* The instruction must accept a `duration` (in seconds) to calculate and store the `expiry_time` (Unix Timestamp).
* The initial state must be set to `Created`.
* The transaction must fail if an operation with the same ID already exists.

### 2. Notarize Document
> "As a Broker or Exporter, I want to upload the cryptographic hash (SHA-256) of a critical document (e.g., Invoice) to the operation account, so that all parties can mathematically verify that the document hasn't been altered off-chain."

**Acceptance Criteria:**
* The instruction must accept a `32-byte` array (SHA-256) as an argument.
* The program must append this hash to the vector list in the Operation Account.
* Only the authorized Exporter can execute this instruction.
* The program should emit an event (or log) confirming registration.

### 3. Mint & Lock Bill of Lading (NFT)
> "As an Exporter, I want to mint an NFT representing the 'Bill of Lading' and deposit it into the program's vault, so that the title of ownership is digitized and secured within the smart contract."

**Acceptance Criteria:**
* The program must verify the Token Account is associated with the operation's specific Mint.
* The NFT must be transferred from the Exporter to a Program Owned Account (Vault).
* The operation state must update to `AssetLocked`.

### 4. Deposit Payment (Escrow Funding)
> "As an Importer, I want to deposit the agreed amount of SPL Tokens (USDC) into the program's escrow vault, so that I can prove my solvency without releasing funds directly to the seller yet."

**Acceptance Criteria:**
* The instruction must perform a CPI to transfer funds from the Importer to the Payment Vault.
* The operation state must update to `PaymentDeposited`.
* The Importer must provide SOL to cover the rent of the new Vault account if it doesn't exist.

### 5. Execute Atomic Settlement (with Fees)
> "As an Exporter or Importer, I want to execute the trade settlement once all conditions are met **and before the operation expires**, so that the payment and ownership transfer happen atomically with a protocol fee deduction."

**Acceptance Criteria:**
* **Time-Lock Check:** The instruction must fail if the current block time > `expiry_time`.
* **Protocol Fee:** The program must calculate **1%** of the total payment and transfer it to the `Admin Treasury`.
* **Net Settlement:** The remaining **99%** of funds must be transferred to the Exporter.
* **Asset Transfer:** The NFT must be transferred to the Importer.
* The operation state must update to `Swapped`.

### 6. Cancel and Refund (Trustless)
> "As a participant, I want to cancel the operation if the deal fails. The Exporter can cancel anytime, but the Importer can only cancel **if the time-lock has expired**, ensuring funds are never held hostage."

**Acceptance Criteria:**
* **Permissions Logic:**
    * The **Exporter** can call this instruction at any time (before Swap).
    * The **Importer** (or any other signer) can ONLY call this if `current_time > expiry_time`.
* **Refunds:**
    * If the NFT Vault has balance -> Refund NFT to Exporter.
    * If the Payment Vault has balance -> Refund USDC to Importer.
* The operation state must update to `Cancelled`.