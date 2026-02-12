use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use crate::state::*;

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    pub dao_account: Account<'info, Dao>,

    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = 8 + 32 + 1 + 8 + 1,
        seeds = [b"vote", voter.key().as_ref(), proposal.key().as_ref()],
        bump
    )]
    pub vote_account: Account<'info, Vote>,

    pub creator_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn cast_vote(ctx: Context<CastVote>, vote_type: u8) -> Result<()> {
    require!(vote_type == 0 || vote_type == 1, ErrorCode::InvalidVoteType);
    
    let vote_account = &mut ctx.accounts.vote_account;
    let proposal_account = &mut ctx.accounts.proposal;
    

    let token_decimals = 9; 
    let token_amount = ctx.accounts.creator_token_account.amount / 10u64.pow(token_decimals);
    
    let voting_credits = (token_amount as f64).sqrt() as u64;

    vote_account.authority = ctx.accounts.voter.key();
    vote_account.vote_type = vote_type;
    vote_account.vote_credits = voting_credits;
    vote_account.bump = ctx.bumps.vote_account;

    if vote_type == 1 {
        proposal_account.yes_vote_count += voting_credits;
    } else {
        proposal_account.no_vote_count += voting_credits;
    }

    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Tipo de voto inválido. Usa 0 para NO, 1 para SÍ")]
    InvalidVoteType,
}