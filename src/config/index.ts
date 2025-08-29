import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BotSettings {
	prompt: string;
	channel?: string;
}

export function loadSettings(): BotSettings {
	const settingsPath = join(process.cwd(), 'data', 'settings.json');
	return JSON.parse(readFileSync(settingsPath, 'utf-8'));
}

export const settings = loadSettings();
