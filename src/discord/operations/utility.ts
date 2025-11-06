import type { GameData, CalculatorData } from '../../types/index.js';

function playRockPaperScissors(userChoice?: string): string {
	const choices = ['rock', 'paper', 'scissors'];
	const botChoice = choices[Math.floor(Math.random() * choices.length)];

	if (!userChoice || !choices.includes(userChoice.toLowerCase())) {
		return `Invalid choice! Please choose: ${choices.join(', ')}`;
	}

	const user = userChoice.toLowerCase();
	let result = `You chose: ${user}\nBot chose: ${botChoice}\n\n`;

	if (user === botChoice) {
		result += "It's a tie!";
	} else if (
		(user === 'rock' && botChoice === 'scissors') ||
		(user === 'paper' && botChoice === 'rock') ||
		(user === 'scissors' && botChoice === 'paper')
	) {
		result += 'You win!';
	} else {
		result += 'Bot wins!';
	}

	return result;
}

function playCoinFlip(): string {
	const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
	return `Coin flip result: **${coinResult.toUpperCase()}**`;
}

function playDice(): string {
	const diceRoll = Math.floor(Math.random() * 6) + 1;
	return `Dice roll result: **${diceRoll}**`;
}

function playNumberGuess(userChoice?: string): string {
	const targetNumber = Math.floor(Math.random() * 100) + 1;
	const guess = parseInt(userChoice || '0');

	if (isNaN(guess)) {
		return 'Please provide a valid number to guess!';
	}

	if (guess === targetNumber) {
		return `Correct! The number was ${targetNumber}`;
	} else if (guess < targetNumber) {
		return `Too low! Try a higher number.`;
	} else {
		return `Too high! Try a lower number.`;
	}
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
			return 'Please provide a mathematical expression to evaluate.';
		}

		const sanitizedExpression = expression.replace(/[^0-9+\-*/().,^\s]/g, '');
		if (sanitizedExpression.trim() === '') {
			return 'Invalid expression provided.';
		}

		const result = Function(`"use strict"; return (${sanitizedExpression})`)();

		if (typeof result === 'number' && Number.isFinite(result)) {
			return `Result: ${result}`;
		}

		return 'Unable to evaluate the expression.';
	} catch (error) {
		return `Error: ${error instanceof Error ? error.message : 'Invalid expression'}`;
	}
}
