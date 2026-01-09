use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::operation::*;

#[derive(Accounts)]
#[instruction(operation_id: String)]
pub struct CancelOperation<'info> {
    #[account(
        mut,
        seeds = [b"operation", exporter.key().as_ref(), operation_id.as_bytes()],
        bump = operation_account.bump,
        has_one = exporter,
        has_one = importer,
        // Restricción: No se puede cancelar si ya se completó 
        constraint = operation_account.state != 3 
    )]
    pub operation_account: Box<Account<'info, OperationState>>,

    #[account(mut)]
    pub exporter: Signer<'info>, // El Exportador inicia la cancelación

    /// CHECK: Dirección necesaria para devolverle los fondos
    #[account(mut)]
    pub importer: AccountInfo<'info>,

    // ---- Destinos de Devolución ----
    #[account(mut)]
    pub exporter_token_account: Box<Account<'info, TokenAccount>>,
    
    #[account(mut)]
    pub importer_token_account: Box<Account<'info, TokenAccount>>,

    // ---- Bóvedas (Orígenes) ----
    #[account(
        mut,
        seeds = [b"vault_nft", operation_id.as_bytes()],
        bump,
        token::authority = operation_account
    )]
    pub vault_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"vault_payment", operation_id.as_bytes()],
        bump,
        token::authority = operation_account
    )]
    pub vault_payment_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn cancel_swap(ctx: Context<CancelOperation>, operation_id: String) -> Result<()> {
    // Preparar semillas para firmar la devolución
    let operation_id_bytes = operation_id.as_bytes();
    let exporter_key = ctx.accounts.exporter.key();
    let bump = ctx.accounts.operation_account.bump;
    
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"operation",
        exporter_key.as_ref(),
        operation_id_bytes,
        &[bump],
    ]];

    // 1. Devolver NFT (Si existe)
    if ctx.accounts.vault_nft_account.amount > 0 {
        let transfer_nft_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_nft_account.to_account_info(),
                to: ctx.accounts.exporter_token_account.to_account_info(), // Vuelve al dueño original
                authority: ctx.accounts.operation_account.to_account_info(),
            },
            signer_seeds, 
        );
        token::transfer(transfer_nft_ctx, ctx.accounts.vault_nft_account.amount)?;
        msg!("NFT devuelto al Exportador.");
    }

    // 2. Devolver Pago (Si existe)
    if ctx.accounts.vault_payment_account.amount > 0 {
        let transfer_payment_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_payment_account.to_account_info(),
                to: ctx.accounts.importer_token_account.to_account_info(), // Vuelve al dueño original
                authority: ctx.accounts.operation_account.to_account_info(),
            },
            signer_seeds, 
        );
        token::transfer(transfer_payment_ctx, ctx.accounts.vault_payment_account.amount)?;
        msg!("Pago devuelto al Importador.");
    }

    // 3. Marcar como Cancelado
    let operation_account = &mut ctx.accounts.operation_account;
    operation_account.state = 4; // 4 = Cancelled

    msg!("Operación Cancelada y fondos reembolsados.");
    Ok(())
}