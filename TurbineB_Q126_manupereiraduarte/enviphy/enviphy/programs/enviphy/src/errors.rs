use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Initialize errors
    #[msg("temp_min must be less than temp_max")]
    InvalidTempRange,

    #[msg("humidity_min must be less than humidity_max")]
    InvalidHumidityRange,

    #[msg("Duration must be greater than zero")]
    InvalidDuration,

    #[msg("Grace period must be greater than zero")]
    InvalidGracePeriod,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    // Deposit errors
    #[msg("Agreement is already funded")]
    AlreadyFunded,

    #[msg("Only the payer can deposit funds")]
    UnauthorizedPayer,

    #[msg("Invalid fee recipient")]
    InvalidFeeRecipient,

    // Telemetry errors
    #[msg("Agreement is not funded yet")]
    NotFunded,

    #[msg("Only the provider can submit telemetry")]
    UnauthorizedProvider,

    #[msg("Timestamp is invalid or older than last heartbeat")]
    InvalidTimestamp,

    #[msg("Agreement is not active")]
    AgreementNotActive,

    // Resolve errors
    #[msg("Agreement has not yet expired")]
    AgreementNotExpired,

    #[msg("Agreement has already been resolved")]
    AlreadyResolved,
}