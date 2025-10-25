# Solana Court Reservation Counter Program

This project implements a basic counter program on the Solana blockchain using Anchor, designed to manage the total capacity of a sports complex and prevent overbooking.

> **Note on Context:** This specific domain—a sports complex reservation system—was chosen as the practical application for this program, as it forms a core component of a larger **complex reservation application development project** I am currently undertaking as part of my **university coursework**.

---

## Setup and Execution

### Prerequisites

You need the **Solana Tool Suite**, **Anchor CLI**, and a recent version of **Node.js** installed. (mucho package installed)

### Steps to Run and Test

1.  Navigate to the program directory (where `Anchor.toml` is located):
    ```bash
    cd ../TurbinePB_Q425_manupereiraduarte/court-reservation-counter-program/court-reservations
    ```

2.  Build the program (compiles the Rust code):
    ```bash
    anchor build
    ```

3.  **Start the local Solana validator** in a separate terminal:
    ```bash
    solana-test-validator
    ```

4.  Run the tests. Anchor will automatically deploy the program to the local validator before running the TypeScript tests:
    ```bash
    anchor test
    ```

> **Troubleshooting:** If you receive a "port in use" error, stop the `solana-test-validator` process (`Ctrl + C`) and try running `anchor test` again, as it sometimes needs to restart the validator itself.