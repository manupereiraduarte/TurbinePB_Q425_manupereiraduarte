use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AgreementState {
    pub config: Pubkey,
    pub status: AgreementStatus,
    pub breach_reason: BreachReason,
    pub start_time: i64,
    pub last_heartbeat: i64,
    pub last_temperature: f32,
    pub last_humidity: f32,
    pub measurement_count: u64,
    pub resolved_at: i64,
    pub is_funded: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum AgreementStatus {
    Active,
    Breached,
    Completed,
    Refunded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum BreachReason {
    None,
    ThresholdViolation,
    ConnectivityLoss,
}