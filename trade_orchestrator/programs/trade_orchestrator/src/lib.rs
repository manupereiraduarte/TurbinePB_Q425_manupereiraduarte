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

    pub fn deposit_nft(ctx: Context<DepositNft>, operation_id: String) -> Result<()> {
        instructions::deposit_nft::deposit_nft(ctx, operation_id)
    }

    pub fn deposit_payment(
        ctx: Context<DepositPayment>,
        operation_id: String,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit_payment::deposit_payment(ctx, operation_id, amount)
    }

    pub fn execute_swap(
        ctx: Context<ExecuteSwap>, 
        operation_id: String
    ) -> Result<()> {
        instructions::execute_swap::execute_swap(ctx, operation_id)
    }

    pub fn cancel_operation(
        ctx: Context<CancelOperation>, 
        operation_id: String
    ) -> Result<()> {
        instructions::cancel::cancel_swap(ctx, operation_id)
    }
    
}

