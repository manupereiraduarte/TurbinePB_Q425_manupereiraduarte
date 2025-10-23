use anchor_lang::prelude::*;

declare_id!("24S72eVrXtEviKdBb5uCym4V2rirwNAfhrPDxAq2yx5s");

#[program]
pub mod rng_game {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
