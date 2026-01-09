use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::operation::*;

#[derive(Accounts)]
#[instruction(operation_id: String)]
pub struct DepositPayment<'info> {
    #[account(
        mut,
        seeds = [b"operation", operation_account.exporter.as_ref(), operation_id.as_bytes()],
        bump = operation_account.bump,
        has_one = importer,
    )]
    pub operation_account: Box<Account<'info, OperationState>>,

    #[account(mut)]
    pub importer: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = importer,
    )]
    pub importer_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = importer,
        seeds = [b"vault_payment", operation_id.as_bytes()],
        bump,
        token::mint = token_mint,
        token::authority = operation_account,
    )]
    pub vault_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn deposit_payment(
    ctx: Context<DepositPayment>,
    operation_id: String,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.importer_token_account.to_account_info(),
        to: ctx.accounts.vault_account.to_account_info(),
        authority: ctx.accounts.importer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let operation_account = &mut ctx.accounts.operation_account;
    operation_account.state = 2; // Payment Deposited

    msg!("Payment deposited into vault");
    Ok(())
}
