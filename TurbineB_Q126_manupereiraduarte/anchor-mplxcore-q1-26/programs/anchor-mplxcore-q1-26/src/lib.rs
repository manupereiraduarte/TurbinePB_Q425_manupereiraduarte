use anchor_lang::prelude::*;

declare_id!("HS2T4CFfcCRowQTYEFHNRtSqbP6tAGvaNjLwGE2zfik6");

#[program]
pub mod anchor_mplxcore_q1_26 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
