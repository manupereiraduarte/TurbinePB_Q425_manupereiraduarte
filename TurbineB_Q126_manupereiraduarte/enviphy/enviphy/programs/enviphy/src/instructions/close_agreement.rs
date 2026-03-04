use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct CloseAgreement<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut, 
        seeds = [
            b"config",
            config.payer.as_ref(),
            config.provider.as_ref(),
            &config.created_at.to_le_bytes(),
        ],
        bump = config.bump,
        close = signer,
    )]
    pub config: Account<'info, AgreementConfig>,

    #[account(
        mut,
        seeds = [
            b"state",
            config.key().as_ref(),
        ],
        bump = agreement_state.bump,
        close = signer,
    )]
    pub agreement_state: Account<'info, AgreementState>,

    /// CHECK: Vault PDA is verified by seeds
    #[account(
        mut,
        seeds = [
            b"vault",
            config.key().as_ref(),
        ],
        bump = config.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn close_agreement(ctx: Context<CloseAgreement>) -> Result<()> {
    let config = &ctx.accounts.config;
    let agreement_state = &ctx.accounts.agreement_state;
    let signer = &ctx.accounts.signer;

    require!(
        signer.key() == config.payer || signer.key() == config.provider,
        ErrorCode::UnauthorizedSigner
    );

    let is_resolved = agreement_state.status == AgreementStatus::Completed
        || agreement_state.status == AgreementStatus::Refunded;
    let is_unfunded = !agreement_state.is_funded;

    require!(
        is_resolved || is_unfunded,
        ErrorCode::CannotCloseActiveAgreement
    );

    // Vaciar el vault si tiene fondos (caso edge: unfunded con rent)
    let vault_balance = ctx.accounts.vault.lamports();
    if vault_balance > 0 {
        let binding = config.key();
        let vault_seeds = &[
            b"vault",
            binding.as_ref(),
            &[config.vault_bump],
        ];
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: signer.to_account_info(),
                },
                &[vault_seeds],
            ),
            vault_balance,
        )?;
    }

    Ok(())
}