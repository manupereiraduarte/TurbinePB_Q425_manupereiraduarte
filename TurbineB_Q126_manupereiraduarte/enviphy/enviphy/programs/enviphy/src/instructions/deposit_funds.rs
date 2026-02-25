use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

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

    /// CHECK: Vault PDA is verified by seeds constraint
    #[account(
        mut,
        seeds = [
            b"vault",
            config.key().as_ref(),
        ],
        bump = config.vault_bump,
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: Fee recipient from config
    #[account(mut)]
    pub fee_recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn deposit_funds(ctx: Context<DepositFunds>) -> Result<()> {
    let config = &ctx.accounts.config;
    let agreement_state = &mut ctx.accounts.agreement_state;
    let clock = &ctx.accounts.clock;

    // validaciones
    require!(!agreement_state.is_funded, ErrorCode::AlreadyFunded);
    require!(
        ctx.accounts.payer.key() == config.payer,
        ErrorCode::UnauthorizedPayer
    );
    require!(
        ctx.accounts.fee_recipient.key() == config.fee_recipient,
        ErrorCode::InvalidFeeRecipient
    );

    // transferir fondos al vault
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        config.amount,
    )?;

    // transferir protocol fee al fee recipient
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.fee_recipient.to_account_info(),
            },
        ),
        config.protocol_fee,
    )?;

    // actualizar estado
    agreement_state.is_funded = true;
    agreement_state.start_time = clock.unix_timestamp;
    agreement_state.last_heartbeat = clock.unix_timestamp;

    emit!(FundsDeposited {
        config: config.key(),
        payer: config.payer,
        amount: config.amount,
        protocol_fee: config.protocol_fee,
        start_time: clock.unix_timestamp,
    });

    Ok(())
}


#[event]
pub struct FundsDeposited {
    pub config: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub protocol_fee: u64,
    pub start_time: i64,
}