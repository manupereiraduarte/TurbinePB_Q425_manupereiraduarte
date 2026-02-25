use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct ResolveAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

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

    /// CHECK: Vault PDA verified by seeds    
    #[account(
        mut,
        seeds = [
            b"vault",
            config.key().as_ref(),
        ],
        bump = config.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: recipient determined by agreement status
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn resolve_agreement(ctx: Context<ResolveAgreement>) -> Result<()> {
    let config = &ctx.accounts.config;
    let agreement_state = &mut ctx.accounts.agreement_state;
    let clock = &ctx.accounts.clock;

    // ensure is funded
    require!(agreement_state.is_funded, ErrorCode::NotFunded);

    // ensure is expired
    let has_expired = clock.unix_timestamp >= agreement_state.start_time + config.duration;
    require!(has_expired, ErrorCode::AgreementNotExpired);

    // ensure not already resolved
    require!(
        agreement_state.status != AgreementStatus::Completed &&
        agreement_state.status != AgreementStatus::Refunded,
        ErrorCode::AlreadyResolved
    );

    // determine recipient and update agreement status
    let (recipient_key, final_status) = match agreement_state.status {
        AgreementStatus::Active => {
            (config.provider, AgreementStatus::Completed)
        },
        AgreementStatus::Breached => {
            (config.payer, AgreementStatus::Refunded)
        },
        _ => {
            return err!(ErrorCode::AlreadyResolved);
        }
    };

    let binding = config.key();

    let vault_seeds = &[
        b"vault",
        binding.as_ref(),
        &[config.vault_bump],
    ];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
             Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            &[vault_seeds],
        ),
        config.amount,
    )?;

    // update agreement state
    agreement_state.status = final_status.clone();
    agreement_state.resolved_at = clock.unix_timestamp;

    emit!(AgreementResolved {
        config: config.key(),
        recipient: recipient_key,
        amount: config.amount,
        status: final_status,
        resolved_at: agreement_state.resolved_at,
    });

    Ok(())
}

#[event]
pub struct AgreementResolved {
    pub config: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub status: AgreementStatus,
    pub resolved_at: i64,
}