use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    errors::StakeError,
    state::{StakeConfig, UserAccount}, // Ya no necesitamos StakeAccount aquí
};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user".as_ref(), user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        seeds = [b"config".as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StakeConfig>,

    #[account(
        mut,
        seeds = [b"rewards".as_ref(), config.key().as_ref()],
        bump = config.rewards_bump,
    )]
    pub reward_mint: Account<'info, Mint>, // El test lo llama 'rewardMint'

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = reward_mint,
        associated_token::authority = user,
    )]
    pub rewards_ata: Account<'info, TokenAccount>, // El test lo llama 'rewardsAta'

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Claim<'info> {
    pub fn claim(&mut self) -> Result<()> {
        let user_account = &mut self.user_account;
        let config = &self.config;

        // 1. Verificar si hay puntos para reclamar
        let points = user_account.points;
        require!(points > 0, StakeError::NoRewardsToClaim); // Asegúrate de tener este error o usa otro

        // 2. Calcular la cantidad de tokens
        // 1 Punto = 1 Token (ajustado por decimales)
        let decimals = self.reward_mint.decimals;
        let amount = (points as u64)
            .checked_mul(10u64.pow(decimals as u32))
            .unwrap();

        // 3. Acuñar Tokens (Mint To)
        let seeds = &[
            b"config".as_ref(), 
            &[config.bump]
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            MintTo {
                mint: self.reward_mint.to_account_info(),
                to: self.rewards_ata.to_account_info(),
                authority: self.config.to_account_info(),
            },
            signer_seeds
        );

        mint_to(cpi_ctx, amount)?;

        // 4. Resetear puntos
        user_account.points = 0;

        msg!("Reclamados {} tokens por {} puntos.", amount, points);
        Ok(())
    }
}