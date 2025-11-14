import type { GameData, CalculatorData } from '../../types/index.js';

function playRockPaperScissors(userChoice?: string): string {
	const choices = ['rock', 'paper', 'scissors'];
	const botChoice = choices[Math.floor(Math.random() * choices.length)];

	if (!userChoice || !choices.includes(userChoice.toLowerCase())) {
		return JSON.stringify({ error: 'invalid_choice', choices });
	}

	const user = userChoice.toLowerCase();
	const isTie = user === botChoice;
	const userWins =
		(user === 'rock' && botChoice === 'scissors') ||
		(user === 'paper' && botChoice === 'rock') ||
		(user === 'scissors' && botChoice === 'paper');

	return JSON.stringify({ userChoice: user, botChoice, tie: isTie, userWins: !isTie && userWins });
}

function playCoinFlip(): string {
	const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
	return JSON.stringify({ result: coinResult });
}

function playDice(): string {
	const diceRoll = Math.floor(Math.random() * 6) + 1;
	return JSON.stringify({ roll: diceRoll });
}

function playNumberGuess(userChoice?: string): string {
	const targetNumber = Math.floor(Math.random() * 100) + 1;
	const guess = parseInt(userChoice || '0');

	if (isNaN(guess)) {
		return JSON.stringify({ error: 'invalid_number' });
	}

	const correct = guess === targetNumber;
	const hint = guess < targetNumber ? 'too_low' : guess > targetNumber ? 'too_high' : null;

	return JSON.stringify({ guess, target: targetNumber, correct, hint });
}

export async function playGame({ type, userChoice }: GameData): Promise<string> {
	try {
		switch (type) {
			case 'rps':
				return playRockPaperScissors(userChoice);
			case 'coinflip':
				return playCoinFlip();
			case 'dice':
				return playDice();
			case 'number_guess':
				return playNumberGuess(userChoice);
			default:
				return `Unknown game type. Available games: rps, coinflip, dice, number_guess`;
		}
	} catch (error) {
		throw new Error(`Failed to play game: ${error}`);
	}
}

export async function calculate({ expression }: CalculatorData): Promise<string> {
	try {
		if (!expression || expression.trim() === '') {
			return JSON.stringify({ error: 'empty_expression' });
		}

		const sanitizedExpression = expression.replace(/[^0-9+\-*/().,^\s]/g, '');
		if (sanitizedExpression.trim() === '') {
			return JSON.stringify({ error: 'invalid_expression' });
		}

		const result = Function(`"use strict"; return (${sanitizedExpression})`)();

		if (typeof result === 'number' && Number.isFinite(result)) {
			return JSON.stringify({ expression, result });
		}

		return JSON.stringify({ error: 'evaluation_failed' });
	} catch (error) {
		return JSON.stringify({
			error: 'evaluation_error',
			message: error instanceof Error ? error.message : 'Invalid expression',
		});
	}
}
