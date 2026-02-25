use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(temp_min: f32, temp_max: f32, humidity_min: f32, humidity_max: f32, duration: i64, grace_period: i64, amount: u64, payer: Pubkey, provider: Pubkey, created_at: i64)]
pub struct InitializeAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 +  AgreementConfig::INIT_SPACE,
        seeds = [
            b"config",
            payer.as_ref(),
            provider.as_ref(),
            &created_at.to_le_bytes(),
        ],
        bump
    )]
    pub config: Account<'info, AgreementConfig>,

    #[account(
        init, 
        payer = signer,
        space = 8 + AgreementState::INIT_SPACE,
        seeds = [
            b"state",
            config.key().as_ref(),
        ],
        bump
    )]
    pub agreement_state: Account<'info, AgreementState>,

    /// CHECK: Vault is a PDA controlled by the program, no data needed.
    #[account(
        mut,
        seeds = [
            b"vault",
            config.key().as_ref(),
        ],
        bump
    )]
    pub vault: SystemAccount<'info>,


    pub system_program: Program<'info, System>,
}

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
    // validations first
    require!(temp_min < temp_max, ErrorCode::InvalidTempRange);
    require!(humidity_min < humidity_max, ErrorCode::InvalidHumidityRange);
    require!(duration > 0, ErrorCode::InvalidDuration);
    require!(grace_period > 0, ErrorCode::InvalidGracePeriod);
    require!(amount > 0, ErrorCode::InvalidAmount);

    // calculate fee
    let protocol_fee = amount
        .checked_mul(100)
        .unwrap()
        .checked_div(10_000)
        .unwrap(); // 1% fee

    // initialize config account
    let config = &mut ctx.accounts.config;
    config.payer = payer;
    config.provider = provider;
    config.temp_min = temp_min;
    config.temp_max = temp_max;
    config.humidity_min = humidity_min;
    config.humidity_max = humidity_max;
    config.duration = duration;
    config.grace_period = grace_period;
    config.amount = amount;
    config.protocol_fee = protocol_fee;
    config.fee_recipient = ctx.accounts.signer.key(); // For simplicity, fee goes to initializer
    config.created_at = created_at;
    config.bump = ctx.bumps.config;
    config.vault_bump = ctx.bumps.vault;

    // initialize agreement state
    let agreement_state = &mut ctx.accounts.agreement_state;
    agreement_state.config = config.key();
    agreement_state.status = AgreementStatus::Active;
    agreement_state.breach_reason = BreachReason::None;
    agreement_state.start_time = 0;
    agreement_state.last_heartbeat = 0;
    agreement_state.last_temperature = 0.0;
    agreement_state.last_humidity = 0.0;
    agreement_state.measurement_count = 0;
    agreement_state.resolved_at = 0;
    agreement_state.is_funded = false;
    agreement_state.bump = ctx.bumps.agreement_state;

    emit!(AgreementCreated {
        config: config.key(),
        payer,
        provider,
        amount, 
        protocol_fee,
        duration,
        created_at,
    });

    Ok(())
}

#[event]
pub struct AgreementCreated {
    pub config: Pubkey,
    pub payer: Pubkey,
    pub provider: Pubkey,
    pub amount: u64,
    pub protocol_fee: u64,
    pub duration: i64,
    pub created_at: i64,
}