use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

pub mod states;
pub use states::*;

declare_id!("GGN5AFAtJd5ogpdAz83Nk1tCNgz3u9NwwXhbqFH4nUZs");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        ctx.accounts.initialize(amount, &ctx.bumps)?;
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn deposit(ctx: Context<Operations>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Operations>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;
        Ok(())
    }

    pub fn lock(ctx: Context<Operations>) -> Result<()>{
        ctx.accounts.lock_vault()?;
        Ok(())
    }

    pub fn unlock(ctx: Context<Operations>) -> Result<()>{
        ctx.accounts.unlock_vault()?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = vault_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"state",user.key().as_ref()],
        bump,
        space = VaultState::INIT_SPACE
    )]
    pub state: Account<'info, VaultState>,
    /// CHECK:
    #[account(
        seeds = [b"vault",user.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    pub vault_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = vault_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, amount: u64, bumps: &InitializeBumps) -> Result<()> {
        self.state.amount = amount;
        self.state.state_bump = bumps.state;
        self.state.vault_bump = bumps.vault;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Operations<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = vault_mint,
        associated_token::authority  =user,
        associated_token::token_program = token_program,
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = VaultState::INIT_SPACE,
        seeds = [b"state",user.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, VaultState>,
    pub vault_mint: InterfaceAccount<'info, Mint>,
    #[account(
       init_if_needed,
       payer = user,
       associated_token::mint = vault_mint,
       associated_token::authority = vault,
       associated_token::token_program  = token_program,
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,
    /// CHECK:
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> Operations<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        require!(self.state.is_locked == false, Errors::VaultLocked);
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: self.user_ata.to_account_info(),
            to: self.vault_ata.to_account_info(),
            mint: self.vault_mint.to_account_info(),
            authority: self.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer_checked(cpi_ctx, amount, self.vault_mint.decimals)?;
        Ok(())
    }

    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        require!(self.state.is_locked == false, Errors::VaultLocked);
        let cpi_program = self.token_program.to_account_info();

        let binding = self.user.key();
        let seeds = &[
            b"vault".as_ref(),
            binding.as_ref(),
            &[self.state.vault_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = TransferChecked {
            from: self.vault_ata.to_account_info(),
            mint: self.vault_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        transfer_checked(cpi_ctx, amount, self.vault_mint.decimals)?;
        Ok(())
    }

    pub fn lock_vault(&mut self) -> Result<()> {
        self.state.is_locked = true;
        Ok(())
    }

    pub fn unlock_vault(&mut self) -> Result<()> {
        self.state.is_locked = false;
        Ok(())
    }
}

#[error_code]
pub enum Errors {
    #[msg("The vault is locked")]
    VaultLocked,
}
