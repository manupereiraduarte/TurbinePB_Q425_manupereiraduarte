use anchor_lang::prelude::*;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2dF1MZUAvR8uF8YorNKyKg8Dn7nzGqvSkAMF5ZzDfmye");

#[program]
pub mod enviphy {
    use super::*;

    pub fn initialize_agreement(
        ctx: Context<InitializeAgreement>,
        temp_min: f32,
        temp_max: f32,
        humidity_min: f32,
        humidity_max: f32,
        duration: i64,
        grace_period: i64,
        amount: u64,
        payer: Pubkey,
        provider: Pubkey,
        created_at: i64,
    ) -> Result<()> {
        initialize_agreement::initialize_agreement(
            ctx, 
            temp_min, 
            temp_max, 
            humidity_min, 
            humidity_max, 
            duration, 
            grace_period, 
            amount,
            payer, 
            provider,
            created_at,
        )
    }

    pub fn deposit_funds(ctx: Context<DepositFunds>) -> Result<()> {
        deposit_funds::deposit_funds(ctx)
    }

    pub fn process_telemetry(
        ctx: Context<ProcessTelemetry>,
        temperature: f32,
        humidity: f32,
        timestamp: i64,
    ) -> Result<()> {
        process_telemetry::process_telemetry(ctx, temperature, humidity, timestamp)
    }

    pub fn resolve_agreement(ctx: Context<ResolveAgreement>) -> Result<()> {
        resolve_agreement::resolve_agreement(ctx)
    }

    pub fn close_agreement(ctx: Context<CloseAgreement>) -> Result<()> {
        close_agreement::close_agreement(ctx)
    }

}
