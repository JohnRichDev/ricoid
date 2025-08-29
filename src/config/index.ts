import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BotSettings {
	prompt: string;
	channel?: string;
}

let cachedSettings: BotSettings | null = null;

export function loadSettings(): BotSettings {
	const settingsPath = join(process.cwd(), 'data', 'settings.json');
	cachedSettings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as BotSettings;
	return cachedSettings;
}

export function reloadSettings(): BotSettings {
	cachedSettings = null;
	return loadSettings();
}

export function getCachedSettings(): BotSettings {
	if (!cachedSettings) {
		cachedSettings = loadSettings();
	}
	return cachedSettings!;
}

export const settings = loadSettings();
