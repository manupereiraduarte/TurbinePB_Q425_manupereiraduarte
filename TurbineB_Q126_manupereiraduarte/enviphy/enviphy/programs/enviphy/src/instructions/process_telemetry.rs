use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;


#[derive(Accounts)]
pub struct ProcessTelemetry<'info> {

    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
        seeds = [
            b"config",
            config.payer.as_ref(),
            config.provider.as_ref(),
            &config.created_at.to_le_bytes(),
        ],
        bump = config.bump,
    )]
    pub config: Account<'info, AgreementConfig>,

    #[account(
        mut,
        seeds = [
            b"state",
            config.key().as_ref(),
        ],
        bump = agreement_state.bump,
    )]
    pub agreement_state: Account<'info, AgreementState>,

    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(
    ctx: Context<ProcessTelemetry>,
    temperature: f32,
    humidity: f32,
    timestamp: i64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let agreement_state = &mut ctx.accounts.agreement_state;
    let clock = &ctx.accounts.clock;

    // 1. Verificaciones de seguridad (Guard Clauses)
    require!(agreement_state.is_funded, ErrorCode::NotFunded);
    require!(ctx.accounts.provider.key() == config.provider, ErrorCode::UnauthorizedProvider);
    require!(agreement_state.status == AgreementStatus::Active, ErrorCode::AgreementNotActive);
    require!(timestamp > agreement_state.last_heartbeat, ErrorCode::InvalidTimestamp);

    // 2. Lógica de negocio: Verificación de Brechas
    let time_since_last_heartbeat = clock.unix_timestamp - agreement_state.last_heartbeat;
    
    if time_since_last_heartbeat > config.grace_period {
        // Brecha por conectividad
        agreement_state.status = AgreementStatus::Breached;
        agreement_state.breach_reason = BreachReason::ConnectivityLoss;

        agreement_state.last_heartbeat = timestamp;
        agreement_state.last_temperature = temperature;
        agreement_state.last_humidity = humidity;
        agreement_state.measurement_count += 1;

        emit!(ConnectivityBreach {
            config: config.key(),
            last_heartbeat: agreement_state.last_heartbeat,
            current_time: clock.unix_timestamp,
            grace_period: config.grace_period,
        });

        emit!(TelemetryProcessed {
            config: config.key(),
            temperature,
            humidity,
            timestamp,
            status: agreement_state.status.clone(),
            measurement_count: agreement_state.measurement_count,
        });
        
        return Ok(());
    }
        // Si la conexión es buena, verificamos umbrales
    let out_of_range = 
        temperature < config.temp_min ||
        temperature > config.temp_max ||
        humidity < config.humidity_min ||
        humidity > config.humidity_max;

    if out_of_range {
        agreement_state.status = AgreementStatus::Breached;
        agreement_state.breach_reason = BreachReason::ThresholdViolation;
        
        emit!(ThresholdBreach {
            config: config.key(),
            temperature,
            humidity,
            temp_min: config.temp_min,
            temp_max: config.temp_max,
            humidity_min: config.humidity_min,
            humidity_max: config.humidity_max,
        });
    }

    // 7. Actualizar estado (SIEMPRE, incluso si hubo breach)
    agreement_state.last_temperature = temperature;
    agreement_state.last_humidity = humidity;
    agreement_state.last_heartbeat = timestamp;
    agreement_state.measurement_count += 1;

    emit!(TelemetryProcessed {
        config: config.key(),
        temperature,
        humidity,
        timestamp,
        status: agreement_state.status.clone(),
        measurement_count: agreement_state.measurement_count,
    });

    Ok(())
}

#[event]
pub struct TelemetryProcessed {
    pub config: Pubkey,
    pub temperature: f32,
    pub humidity: f32,
    pub timestamp: i64,
    pub status: AgreementStatus,
    pub measurement_count: u64,
}

#[event]
pub struct ThresholdBreach {
    pub config: Pubkey,
    pub temperature: f32,
    pub humidity: f32,
    pub temp_min: f32,
    pub temp_max: f32,
    pub humidity_min: f32,
    pub humidity_max: f32,
}

#[event]
pub struct ConnectivityBreach {
    pub config: Pubkey,
    pub last_heartbeat: i64,
    pub current_time: i64,
    pub grace_period: i64,
}