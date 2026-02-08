# Enviphy - User Journey (End-to-End)

This diagram describes the complete logical flow and user experience, from contract creation to final resolution. It maps the interactions between the **Payer**, the **Enviphy Program**, the **ESP32 device**, and the **Provider**.

![alt text](<../img/User_Journey.png>)


### Key Journey Highlights:
* **SLA Configuration**: The Payer initiates the process by defining critical parameters such as temperature and humidity ranges and the agreement duration.
* **Automated Escrow**: The program acts as a neutral arbiter, creating necessary accounts (PDAs) and securely locking the funds in escrow.
* **Monitoring Cycle**: It illustrates the continuous loop where the ESP32 measures and signs data, while the program constantly validates compliance at the source.
* **Bifurcated Resolution**: The flow concludes clearly: an automatic payout to the Provider if the service is fulfilled, or a refund to the Payer if a physical breach is detected.