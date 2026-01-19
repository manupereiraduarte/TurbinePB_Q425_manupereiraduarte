use anchor_lang::prelude::*;

declare_id!("24S72eVrXtEviKdBb5uCym4V2rirwNAfhrPDxAq2yx5s");

#[program]
pub mod rng_game {
    use super::*;

    pub fn hello_world(ctx: Context<HelloWorld>) -> Result<()> {
        msg!("Hello Solana World!");
        msg!("ID de programa: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn initialize_counter(ctx: Context<InitializeCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Contador inicializado en 0");
        Ok(())
    }

    pub fn increment(ctx: Context<UpdateCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        msg!("Contador incrementado a {}", counter.count);
        Ok(())
    }

    pub fn decrement(ctx: Context<UpdateCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count -= 1;
        msg!("Contador decrementado a {}", counter.count);
        Ok(())
    }

    pub fn initialize_game(ctx: Context<InitializeGame>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let timestamp = Clock::get()?.unix_timestamp as u64;
        let secret = (timestamp % 100) + 1;
        game.secret_number = secret;
        game.is_active = true;
        msg!("Juego inicializado con el número secreto {}", game.secret_number);
        Ok(())
    }

    pub fn guess(ctx: Context<Guess>, user_guess: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.is_active, GameError::GameNotActive);

        msg!("El jugador adivino: {}", user_guess);

        if user_guess < game.secret_number {
            msg!("Muy bajo");
        } else if user_guess > game.secret_number {
            msg!("Muy alto");
        } else {
            msg!("Ganaste, El número era {}", game.secret_number);
            game.is_active = false;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct HelloWorld {}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCounter<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
}   

#[account]
pub struct Counter {
    pub count: i64,
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(init, payer = user, space = 8 + 8 + 1)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}       

#[derive(Accounts)]
pub struct Guess<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
}

#[account]
pub struct Game {
    pub secret_number: u64,
    pub is_active: bool,
}

#[error_code]
pub enum GameError {
    #[msg("El juego no está activo.")]
    GameNotActive,
}