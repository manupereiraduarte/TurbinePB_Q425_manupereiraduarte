use anchor_lang::prelude::*;
use crate::state::operation::*;

#[derive(Accounts)]
#[instruction(operation_id: String, importer: Pubkey)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"operation", signer.key().as_ref(), operation_id.as_bytes()],
        bump,
        payer = signer,
        space = 8 + 30 + 32 + 32 + 1 + 1 + 4 + (32 * 100) // espacio para hasta 100 documentos
    )]
    pub operation_account: Account<'info, OperationState>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(
    ctx: Context<Initialize>,
    operation_id: String,
    importer: Pubkey,
) -> Result<()> {
    let operation_account = &mut ctx.accounts.operation_account;
    // guardamos los datos
    operation_account.operation_id = operation_id;
    operation_account.exporter = ctx.accounts.signer.key();
    operation_account.importer = importer;
    operation_account.state = 0;
    operation_account.bump = ctx.bumps.operation_account;
    // inicializo vector vacio
    operation_account.documents = Vec::new();

    msg!("Operation initialized: {}", operation_account.operation_id);
    Ok(())
}