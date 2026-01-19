use anchor_lang::prelude::*;

declare_id!("949YPZb1QgW6suEqxRVRRNDCay8chBBH62xddzpBUqx1");

#[program]
pub mod sports_complex {
    use super::*;

    pub fn initialize_complex(ctx: Context<InitializeComplex>, max_courts: u64) -> Result<()> {
        let complex = &mut ctx.accounts.complex;
        complex.max_courts = max_courts;
        complex.total_reservations = 0;
        complex.authority = ctx.accounts.authority.key();

        msg!("Sports Complex initialized, max courts: {}", max_courts);
        Ok(())   
    }

    // Reserve a slot if available
    pub fn reserve_court(ctx: Context<ReserveCourt>) -> Result<()> {
        let complex = &mut ctx.accounts.complex;

        require!(
            complex.total_reservations < complex.max_courts,
            ComplexError::NoCourtsAvailable
        );

        complex.total_reservations = complex.total_reservations.checked_add(1).unwrap();
        
        msg!("Court Reserved. Total Reservations: {}/{}", complex.total_reservations, complex.max_courts);
        Ok(())
    }
    pub fn cancel_reservation(ctx: Context<ReserveCourt>) -> Result<()> {
        let complex = &mut ctx.accounts.complex;

        require!(
            complex.total_reservations > 0,
            ComplexError::NoActiveReservations
        );

        complex.total_reservations = complex.total_reservations.checked_sub(1).unwrap();
        
        msg!("Reservation Canceled. Total Reservations: {}/{}", complex.total_reservations, complex.max_courts);
        Ok(())
    }


    pub fn reset_reservations(ctx: Context<ResetReservations>) -> Result<()> {
        let complex = &mut ctx.accounts.complex; 

        require_keys_eq!(
            complex.authority, 
            ctx.accounts.authority.key(), 
            ComplexError::Unauthorized
        );
        
        complex.total_reservations = 0;
        
        msg!("All Reservations Reset by Authority.");
        Ok(())
    }
}

#[account]
pub struct Complex {
    pub total_reservations: u64,
    pub max_courts: u64,
    pub authority: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeComplex<'info> {
    #[account(init, payer = authority, space = 8 + 8 + 8 + 32)]
    pub complex: Account<'info, Complex>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReserveCourt<'info> {
    #[account(mut)]
    pub complex: Account<'info, Complex>,
}

#[derive(Accounts)]
pub struct ResetReservations<'info> {
    #[account(mut)]
    pub complex: Account<'info, Complex>,
    pub authority: Signer<'info>,
}

#[error_code]
pub enum ComplexError {
    #[msg("There are no courts available for reservation at this time.")]
    NoCourtsAvailable,
    #[msg("Only the complex authority can perform this action.")]
    Unauthorized,
    #[msg("There are no active reservations to cancel.")]
    NoActiveReservations,
}
