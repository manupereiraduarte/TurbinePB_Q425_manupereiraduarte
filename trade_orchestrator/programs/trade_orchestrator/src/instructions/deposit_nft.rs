use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Mint, TokenAccount, Transfer};
use crate::state::operation::*;

#[derive(Accounts)]
#[instruction(operation_id: String)]
pub struct DepositNft<'info> {
    // operacion dond actualizamos el estado
    #[account(
        mut,
        seeds = [
            b"operation",
            exporter.key().as_ref(),
            operation_id.as_bytes()
        ],
        bump = operation_account.bump,
        has_one = exporter,
    )]
    pub operation_account: Box<Account<'info, OperationState>>,

    // exporter, dueño del nft
    #[account(mut)]
    pub exporter: Signer<'info>,

    // mint del nft a depositar
    pub nft_mint: Account<'info, Mint>,

    // cuenta token del exporter que contiene el nft a depositar
    #[account(
        mut,
        token::mint = nft_mint,
        token::authority = exporter,
    )]
    pub exporter_token_account: Box<Account<'info, TokenAccount>>,
    
    // cuenta token vault donde se depositara el nft
    #[account(
        init_if_needed,
        payer = exporter,
        // seeds unicas para esta operacion y tipo de activo
        seeds = [
            b"vault_nft",
            operation_id.as_bytes()
        ],
        bump,
        token::mint = nft_mint,
        token::authority = operation_account,
    )]
    pub vault_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn deposit_nft (ctx: Context<DepositNft>, operation_id: String) -> Result<()> {
    // exportador a vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.exporter_token_account.to_account_info(),
        to: ctx.accounts.vault_account.to_account_info(),
        authority: ctx.accounts.exporter.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    // ejecuto transferencia
    token::transfer(cpi_ctx, 1)?;

    // actualizo estado de operacion
    let operation_account = &mut ctx.accounts.operation_account;
    operation_account.state = 1;
    msg!("NFT deposited to vault. Operation state updated.");
    Ok(())
}