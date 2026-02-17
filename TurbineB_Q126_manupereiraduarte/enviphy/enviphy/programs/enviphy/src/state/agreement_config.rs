use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AgreementConfig {
    pub payer: Pubkey,
    pub provider: Pubkey,
    pub temp_min: f32,
    pub temp_max: f32,
    pub humidity_min: f32,
    pub humidity_max: f32,
    pub duration: i64,
    pub grace_period: i64,
    pub amount: u64,
    pub protocol_fee: u64,
    pub fee_recipient: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
}
