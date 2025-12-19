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
> "As an Exporter, I want to initialize a new trade operation on the blockchain using a unique ID, so that I can create a secure, immutable space to store documents and payment states for a specific shipment."

**Acceptance Criteria:**
* The program must derive a PDA (Program Derived Address) using the `operation_id` and the creator's Pubkey as seeds.
* The initialized account must store the Exporter and Importer public keys.
* The initial state of the operation account must be set to `Created`.
* The transaction must fail if an operation with the same ID already exists.

### 2. Notarize Document
> "As a Broker or Exporter, I want to upload the cryptographic hash (SHA-256) of a critical document (e.g., Invoice) to the operation account, So that all parties can mathematically verify that the document hasn't been altered off-chain."

**Acceptance Criteria:**
* The instruction must accept a `32-byte` array (the SHA-256 hash) as an argument.
* The program must append this hash to a vector list stored within the Operation Account.
* Only the authorized Signer (defined in the account structure) can execute this instruction.
* The program should emit an event confirming the document was registered.

### 3. Mint & Lock Bill of Lading (NFT)
> "As an Exporter, I want to mint an NFT representing the 'Bill of Lading' and deposit it into the program's vault, so that the title of ownership is digitized and secured within the smart contract."

**Acceptance Criteria:**
* The program must accept an SPL Token (NFT) transfer from the Exporter to a Program Owned Account (Vault).
* The program must verify that the token represents the correct asset for this operation.
* The operation state must update to `AssetLocked` (or `NftDeposited`).
* The Exporter must lose control of the NFT until the swap or a cancellation occurs.

### 4. Deposit Payment (Escrow Funding)
> "As an importer, I want to deposit the agreed amount of SPL Tokens (e.g., USDC) into the program's escrow vault, so that I can prove my solvency and commitment to the deal without releasing funds directly to the seller yet."

**Acceptance Criteria:**
* The instruction must perform a CPI (Cross-Program Invocation) to the Token Program to transfer funds from the Importer to the Vault.
* The program must verify that the deposited amount matches the `agreed_amount` defined in the operation.
* The operation state must update to `PaymentDeposited` (or `FullyFunded` if the NFT is also there).

### 5. Execute Atomic Settlement
> "As an Exporter (or System Admin), I want to execute the trade settlement once all conditions (documents approved) are met, so that I receive the payment instantly while the Importer simultaneously receives the Bill of Lading NFT in a single transaction."

**Acceptance Criteria:**
* The instruction must verify that the required document hashes exist in the account state.
* The instruction must perform two atomic transfers via CPI:
    * **NFT:** From Vault to Importer.
    * **Funds:** From Vault to Exporter.
* The operation state must update to `Completed`.
* The account should either close or lock permanently to prevent re-execution.

### 6. Cancel and Refund
> "As an Exporter or Importer, I want to cancel the operation if the deal falls through before the final swap, so that both parties can recover their deposited assets (NFT and Funds)."

**Acceptance Criteria:**
* Both parties must sign (multisig) OR a timeout period must pass to execute this instruction.
* The program must return the NFT to the Exporter.
* The program must return the Funds to the Importer.
* The operation account closes.