use anchor_lang::prelude::*;

declare_id!("2dF1MZUAvR8uF8YorNKyKg8Dn7nzGqvSkAMF5ZzDfmye");

#[program]
pub mod enviphy {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
