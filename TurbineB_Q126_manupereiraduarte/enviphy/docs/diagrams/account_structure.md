# Enviphy - On-Chain Account Structure

This diagram details the technical data organization within the Solana blockchain, illustrating how Program Derived Addresses (PDAs) manage agreement rules and escrowed funds based on physical data.

![alt text](<../img/Account_Structure.png>)


### Key Architectural Components:
* **Agreement Account (PDA)**: A unique storage space on the blockchain that holds the specific SLA parameters (temperature/humidity), participant identities, and real-time monitoring states such as the last heartbeat and measurement count.
* **Vault Account (PDA)**: A secure account controlled exclusively by the smart contract that holds the deposited funds in escrow, ensuring they are only released or refunded based on verified environmental conditions.
* **Status & Breach Logic**: A set of on-chain Enums that track the lifecycle of the agreement (Active, Completed, Breached) and categorize specific reasons for contract violations, such as threshold breaches or connectivity loss.