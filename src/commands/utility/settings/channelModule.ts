import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction, Channel } from 'discord.js';
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

function extractChannelId(target: string): string {
	return target.replace(/[<#>]/g, '');
}

async function validateAndFetchChannel(
	interaction: ChatInputCommandInteraction,
	channelId: string,
): Promise<{ channel: Channel | null; error: string | null }> {
	try {
		const channel = await interaction.client.channels.fetch(channelId);

		if (!channel) {
			return { channel: null, error: 'Channel not found or the bot cannot access it.' };
		}

		if (!channel.isTextBased()) {
			return { channel: null, error: 'The specified channel must be a text channel.' };
		}

		return { channel, error: null };
	} catch (error) {
		return { channel: null, error: 'Invalid channel ID or the bot cannot access that channel.' };
	}
}

async function handleSetAction(
	interaction: ChatInputCommandInteraction,
	target: string | null,
	updatedSettings: any,
): Promise<{ settings: any; reply: string }> {
	if (!target) {
		return createResult(updatedSettings, 'Channel ID or mention is required when setting the channel.');
	}

	const channelId = extractChannelId(target);
	const { error } = await validateAndFetchChannel(interaction, channelId);

	if (error) {
		return createResult(updatedSettings, error);
	}

	updatedSettings.channel = channelId;
	await writeSettings(updatedSettings);
	return createResult(updatedSettings, `Channel set to <#${channelId}>`);
}

async function handleResetAction(updatedSettings: any): Promise<{ settings: any; reply: string }> {
	delete updatedSettings.channel;
	await writeSettings(updatedSettings);
	return createResult(updatedSettings, 'Channel reset. Bot will now listen to all channels where it has access.');
}

async function handleViewAction(
	interaction: ChatInputCommandInteraction,
	settings: any,
): Promise<{ settings: any; reply: string }> {
	const channelId = settings.channel;

	if (!channelId) {
		return createResult(settings, 'Channel: *not set* (listening to all accessible channels)');
	}

	try {
		const channel = await interaction.client.channels.fetch(channelId);
		if (channel) {
			return createResult(settings, `Current channel: <#${channelId}>`);
		}
	} catch (error) {
		return createResult(settings, `Channel is set to \`${channelId}\` but the channel is no longer accessible.`);
	}

	return createResult(settings, `Channel: \`${channelId}\` (channel may no longer exist)`);
}

export const channelModule: SettingsCategoryModule = {
	name: 'Channel',
	value: 'channel',
	actions: ACTIONS,

	isActionAllowed(action: string): boolean {
		return ALLOWED_ACTIONS.includes(action);
	},

	async execute(
		interaction: ChatInputCommandInteraction,
		action: string,
		target: string | null,
		settings: any,
	): Promise<{ settings: any; reply: string }> {
		if (!this.isActionAllowed(action)) {
			return createResult(settings, 'Channel only supports **set**, **reset**, and **view** actions.');
		}

		const updatedSettings = { ...settings };

		switch (action) {
			case 'set':
				return handleSetAction(interaction, target, updatedSettings);
			case 'reset':
				return handleResetAction(updatedSettings);
			case 'view':
				return handleViewAction(interaction, settings);
			default:
				return createResult(settings, 'Unknown action.');
		}
	},
};
