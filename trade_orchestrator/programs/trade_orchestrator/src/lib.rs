use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;

use instructions::*;

declare_id!("JB8Q7ay8oNnZZhTFcNnSPbMvnJc6HECXTcxgS7vRfgyw");

#[program]
pub mod trade_orchestrator {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        operation_id: String,
        importer: Pubkey,
    ) -> Result<()> {
        instructions::initialize::initialize(ctx, operation_id, importer)
    }

    pub fn notarize_document(
        ctx: Context<NotarizeDocument>,
        hash: [u8; 32],
    ) -> Result<()> {
        instructions::notarize::notarize(ctx, hash)
    }
    
}

