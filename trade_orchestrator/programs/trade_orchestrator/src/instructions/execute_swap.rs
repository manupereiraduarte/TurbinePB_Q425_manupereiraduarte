use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::operation::*;

#[derive(Accounts)]
#[instruction(operation_id: String)]
pub struct ExecuteSwap<'info> {
    #[account(
        mut,
        seeds = [b"operation", exporter.key().as_ref(), operation_id.as_bytes()],
        bump = operation_account.bump,
        has_one = exporter,
        has_one = importer,
        constraint = operation_account.state == 2,
    )]
    pub operation_account: Box<Account<'info, OperationState>>,

    /// CHECK: Solo usamos la dirección (key) para validar las seeds del PDA. No leemos ni escribimos datos en esta cuenta.
    pub exporter: AccountInfo<'info>,

    /// CHECK: Solo usamos la dirección (key) para validar las seeds del PDA. No leemos ni escribimos datos en esta cuenta.
    pub importer: AccountInfo<'info>,

    /// CHECK: Cuenta del administrador que recibe el fee, en producción se debe validar que sea un pubkey especifica.
    #[account(mut)]
    pub admin_treasury_token_account: Box<Account<'info, TokenAccount>>,

    // destinos
    #[account(mut)]
    pub exporter_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub importer_token_account: Box<Account<'info, TokenAccount>>,

    // origenes
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

pub fn execute_swap(ctx: Context<ExecuteSwap>, operation_id: String) -> Result<()> {
    // verifico expiracion
    let clock = Clock::get()?;
    let operation_account = &ctx.accounts.operation_account;
    if clock.unix_timestamp > operation_account.expiry_time {
        return err!(crate::ErrorCode::OperationExpired);
    }
    
    // preparo las semillas para firmar, signed cpi
    let operation_id_bytes = operation_id.as_bytes();
    let exporter_key = ctx.accounts.exporter.key();
    let bump = ctx.accounts.operation_account.bump;

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"operation",
        exporter_key.as_ref(),
        operation_id_bytes,
        &[bump],
    ]];

    // transferir NFT de vault a importador
    let transfer_nft_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_nft_account.to_account_info(),
            to: ctx.accounts.importer_token_account.to_account_info(),
            authority: ctx.accounts.operation_account.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_nft_ctx, 1)?;

    // transferir fee
    let total_amount = ctx.accounts.vault_payment_account.amount;
    let fee_amount = total_amount / 100; // 1% fee
    let net_amount = total_amount - fee_amount;

    let transfer_fee_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_payment_account.to_account_info(),
            to: ctx.accounts.admin_treasury_token_account.to_account_info(),
            authority: ctx.accounts.operation_account.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_fee_ctx, fee_amount)?;

    // transferir pago de vault a exportador
    let transfer_payment_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_payment_account.to_account_info(),
            to: ctx.accounts.exporter_token_account.to_account_info(),
            authority: ctx.accounts.operation_account.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_payment_ctx, net_amount)?;

    // actualizar estado y cerrar 
    let operation_account = &mut ctx.accounts.operation_account;
    operation_account.state = 3; // completed

    msg!("Swap executed successfully for operation_id: {}", operation_id);
    Ok(())
}