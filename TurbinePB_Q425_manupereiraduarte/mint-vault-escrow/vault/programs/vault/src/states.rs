use anchor_lang::prelude::*;

#[account]
pub struct VaultState {
    pub is_locked: bool,
    pub amount: u64,
    pub vault_bump: u8,
    pub state_bump: u8,
}

impl Space for VaultState {
    const INIT_SPACE: usize = 8 + 8 + 1 + 1 + 1;
}