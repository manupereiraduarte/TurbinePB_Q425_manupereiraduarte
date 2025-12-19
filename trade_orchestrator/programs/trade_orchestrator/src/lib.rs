use anchor_lang::prelude::*;

declare_id!("JB8Q7ay8oNnZZhTFcNnSPbMvnJc6HECXTcxgS7vRfgyw");

#[program]
pub mod trade_orchestrator {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
