import type { ChatInputCommandInteraction } from 'discord.js';

export interface SettingsAction {
	name: string;
	value: string;
}

export interface SettingsCategoryModule {
	name: string;

	value: string;

	actions: SettingsAction[];

	execute(
		interaction: ChatInputCommandInteraction,
		action: string,
		target: string | null,
		settings: any,
	): Promise<{ settings: any; reply: string }>;

	isActionAllowed(action: string): boolean;
}

export interface SettingsModuleRegistry {
	[key: string]: SettingsCategoryModule;
}
