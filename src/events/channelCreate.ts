import { Events } from 'discord.js';
import type { GuildChannel, DMChannel } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.ChannelCreate,
	once: false,
	async execute(channel: GuildChannel | DMChannel) {
		try {
			if (!('guild' in channel)) return;

			const config = getLoggingConfig(channel.guild.id, 'channelCreate');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const channelName = 'name' in channel ? channel.name : 'Unknown';
			const channelType = channel.type;

			await logChannel.send({
				content: `➕ **Channel Created**\n**Name:** ${channelName}\n**Type:** ${channelType}\n**Time:** ${new Date().toISOString()}`,
			});
		} catch (error) {
			console.error('Error logging channel creation:', error);
		}
	},
} satisfies Event<Events.ChannelCreate>;
