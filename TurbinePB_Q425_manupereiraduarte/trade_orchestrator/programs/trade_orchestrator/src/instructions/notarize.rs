use anchor_lang::prelude::*;
use crate::state::operation::*;


#[derive(Accounts)]
pub struct NotarizeDocument<'info> {
    #[account(
        mut,
        seeds = [
            b"operation",
            operation_account.exporter.as_ref(),
            operation_account.operation_id.as_bytes()
        ],
        bump = operation_account.bump,
        has_one = exporter,
    )]
    pub operation_account: Account<'info, OperationState>,
    // Este signer debe coincidir con operation_account.exporter gracias a "has_one"
    pub exporter: Signer<'info>,
}

pub fn notarize(
    ctx: Context<NotarizeDocument>,
    hash: [u8; 32],
) -> Result<()> {
    let operation_account = &mut ctx.accounts.operation_account;
    // agrego hash a la lista
    operation_account.documents.push(hash);

    msg!("📝 Document notarized. Total docs: {}", operation_account.documents.len());
    Ok(())
}