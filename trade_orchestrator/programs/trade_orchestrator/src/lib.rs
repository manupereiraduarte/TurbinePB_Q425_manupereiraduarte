use anchor_lang::prelude::*;

declare_id!("JB8Q7ay8oNnZZhTFcNnSPbMvnJc6HECXTcxgS7vRfgyw");

#[program]
pub mod trade_orchestrator {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        operation_id: String,
        importer: Pubkey,
    ) -> Result<()> {
        let operation_account = &mut ctx.accounts.operation_account;
        // guardamos los datos
        operation_account.operation_id = operation_id;
        operation_account.exporter = ctx.accounts.signer.key();
        operation_account.importer = importer;
        operation_account.state = 0;
        operation_account.bump = ctx.bumps.operation_account;
        // inicializo vector vacio
        operation_account.documents = Vec::new();

        msg!("Operation initialized: {}", operation_account.operation_id);
        Ok(())
    }

    pub fn notarize_document(
        ctx: Context<NotarizeDocument>,
        hash: [u8; 32],
    ) -> Result<()> {
        let operation_account = &mut ctx.accounts.operation_account;
        // agrego hash a la lista
        operation_account.documents.push(hash);

        msg!("📝 Document notarized. Total docs: {}", operation_account.documents.len());
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(operation_id: String, importer: Pubkey)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"operation", signer.key().as_ref(), operation_id.as_bytes()],
        bump,
        payer = signer,
        space = 8 + 30 + 32 + 32 + 1 + 1 + 4 + (32 * 100) // espacio para hasta 100 documentos
    )]
    pub operation_account: Account<'info, OperationState>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct NotarizeDocument<'info> {
    #[account(
        mut,
        seeds = [
            b"operation",
            operation_account.exporter.as_ref(),
            operation_account.operation_id.as_bytes()
        ],
        bump = operation_account.bump,
        has_one = exporter,
    )]
    pub operation_account: Account<'info, OperationState>,
    // Este signer debe coincidir con operation_account.exporter gracias a "has_one"
    pub exporter: Signer<'info>,
}

#[account]
pub struct OperationState {
    pub operation_id: String, // max 30 bytes
    pub exporter: Pubkey,
    pub importer: Pubkey,
    pub state: u8, // 0: initialized, 1: in transit, 2: delivered
    pub bump: u8,
    pub documents: Vec<[u8; 32]>, // lista de hashes de documentos
}