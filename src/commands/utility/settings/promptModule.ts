import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { writeSettings } from '../../../util/settingsStore.js';

const ACTIONS: SettingsAction[] = [
	{ name: 'View', value: 'view' },
	{ name: 'Set', value: 'set' },
	{ name: 'Reset', value: 'reset' },
];

const ALLOWED_ACTIONS = ['view', 'set', 'reset'];

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
			return {
				settings,
				reply: 'Bot prompt only supports **set**, **reset**, and **view** actions.',
			};
		}

		const updatedSettings = { ...settings };

		if (action === 'set') {
			if (!target) {
				return {
					settings,
					reply: 'Value is required when setting the prompt.',
				};
			}
			updatedSettings.prompt = target;
			await writeSettings(updatedSettings);
			return {
				settings: updatedSettings,
				reply: `Bot prompt set to: "${target}"`,
			};
		} else if (action === 'reset') {
			delete updatedSettings.prompt;
			await writeSettings(updatedSettings);
			return {
				settings: updatedSettings,
				reply: 'Bot prompt reset to default.',
			};
		} else if (action === 'view') {
			return {
				settings,
				reply: `Current prompt: ${settings.prompt ?? '*not set*'}`,
			};
		}

		return { settings, reply: 'Unknown action.' };
	},
};
