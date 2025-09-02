import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { writeSettings } from '../../../util/settingsStore.js';

const ACTIONS: SettingsAction[] = [
	{ name: 'View', value: 'view' },
	{ name: 'Set', value: 'set' },
	{ name: 'Reset', value: 'reset' },
];

const ALLOWED_ACTIONS = ['view', 'set', 'reset'];

function createResult(settings: any, reply: string): { settings: any; reply: string } {
	return { settings, reply };
}

async function handleSetAction(target: string | null, updatedSettings: any): Promise<{ settings: any; reply: string }> {
	if (!target) {
		return createResult(updatedSettings, 'Value is required when setting the prompt.');
	}

	updatedSettings.prompt = target;
	await writeSettings(updatedSettings);
	return createResult(updatedSettings, `Bot prompt set to: "${target}"`);
}

async function handleResetAction(updatedSettings: any): Promise<{ settings: any; reply: string }> {
	delete updatedSettings.prompt;
	await writeSettings(updatedSettings);
	return createResult(updatedSettings, 'Bot prompt reset to default.');
}

function handleViewAction(settings: any): { settings: any; reply: string } {
	const promptValue = settings.prompt ?? '*not set*';
	return createResult(settings, `Current prompt: ${promptValue}`);
}

export const promptModule: SettingsCategoryModule = {
	name: 'Bot Prompt',
	value: 'prompt',
	actions: ACTIONS,

	isActionAllowed(action: string): boolean {
		return ALLOWED_ACTIONS.includes(action);
	},

	async execute(
		_interaction: ChatInputCommandInteraction,
		action: string,
		target: string | null,
		settings: any,
	): Promise<{ settings: any; reply: string }> {
		if (!this.isActionAllowed(action)) {
			return createResult(settings, 'Bot prompt only supports **set**, **reset**, and **view** actions.');
		}

		const updatedSettings = { ...settings };

		switch (action) {
			case 'set':
				return handleSetAction(target, updatedSettings);
			case 'reset':
				return handleResetAction(updatedSettings);
			case 'view':
				return handleViewAction(settings);
			default:
				return createResult(settings, 'Unknown action.');
		}
	},
};
