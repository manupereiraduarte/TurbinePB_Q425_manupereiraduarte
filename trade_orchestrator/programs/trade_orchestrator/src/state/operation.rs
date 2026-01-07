use anchor_lang::prelude::*;

#[account]
pub struct OperationState {
    pub operation_id: String, // max 30 bytes
    pub exporter: Pubkey,
    pub importer: Pubkey,
    pub state: u8, // 0: initialized, 1: in transit, 2: delivered
    pub bump: u8,
    pub documents: Vec<[u8; 32]>, // lista de hashes de documentos
}