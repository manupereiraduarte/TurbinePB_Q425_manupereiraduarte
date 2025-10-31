use anchor_lang::prelude::*;

declare_id!("G4YMh4ythxj3nNpjGMpoaAHQQLcebxRo84CduUPLhzJn");

#[program]
pub mod mint_vault_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
