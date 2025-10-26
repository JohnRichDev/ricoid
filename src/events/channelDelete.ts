import { Events } from 'discord.js';
import type { GuildChannel, DMChannel } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.ChannelDelete,
	once: false,
	async execute(channel: GuildChannel | DMChannel) {
		try {
			if (!('guild' in channel)) return;

			const config = getLoggingConfig(channel.guild.id, 'channelDelete');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const channelName = 'name' in channel ? channel.name : 'Unknown';
			const channelType = channel.type;

			await logChannel.send({
				content: `🗑️ **Channel Deleted**\n**Name:** ${channelName}\n**Type:** ${channelType}\n**Time:** ${new Date().toISOString()}`,
				allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
			});
		} catch (error) {
			console.error('Error logging channel deletion:', error);
		}
	},
} satisfies Event<Events.ChannelDelete>;
