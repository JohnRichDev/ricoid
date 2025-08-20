import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction, Channel } from 'discord.js';
import { writeSettings } from '../../../util/settingsStore.js';

const ACTIONS: SettingsAction[] = [
	{ name: 'View', value: 'view' },
	{ name: 'Set', value: 'set' },
	{ name: 'Reset', value: 'reset' },
];

const ALLOWED_ACTIONS = ['view', 'set', 'reset'];

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
			return {
				settings,
				reply: 'Channel only supports **set**, **reset**, and **view** actions.',
			};
		}

		const updatedSettings = { ...settings };

		if (action === 'set') {
			if (!target) {
				return {
					settings,
					reply: 'Channel ID or mention is required when setting the channel.',
				};
			}

			const channelId = target.replace(/[<#>]/g, '');

			let channel: Channel | null = null;
			try {
				channel = await interaction.client.channels.fetch(channelId);
			} catch (error) {
				return {
					settings,
					reply: 'Invalid channel ID or the bot cannot access that channel.',
				};
			}

			if (!channel) {
				return {
					settings,
					reply: 'Channel not found or the bot cannot access it.',
				};
			}

			if (!channel.isTextBased()) {
				return {
					settings,
					reply: 'The specified channel must be a text channel.',
				};
			}

			updatedSettings.channel = channelId;
			await writeSettings(updatedSettings);
			return {
				settings: updatedSettings,
				reply: `Channel set to <#${channelId}>`,
			};
		} else if (action === 'reset') {
			delete updatedSettings.channel;
			await writeSettings(updatedSettings);
			return {
				settings: updatedSettings,
				reply: 'Channel reset. Bot will now listen to all channels where it has access.',
			};
		} else if (action === 'view') {
			const channelId = settings.channel;
			if (!channelId) {
				return {
					settings,
					reply: 'Channel: *not set* (listening to all accessible channels)',
				};
			}

			try {
				const channel = await interaction.client.channels.fetch(channelId);
				if (channel) {
					return {
						settings,
						reply: `Current channel: <#${channelId}>`,
					};
				}
			} catch (error) {
				return {
					settings,
					reply: `Channel is set to \`${channelId}\` but the channel is no longer accessible.`,
				};
			}

			return {
				settings,
				reply: `Channel: \`${channelId}\` (channel may no longer exist)`,
			};
		}

		return { settings, reply: 'Unknown action.' };
	},
};
