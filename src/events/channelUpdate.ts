import { Events } from 'discord.js';
import type { GuildChannel, DMChannel } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.ChannelUpdate,
	once: false,
	async execute(oldChannel: GuildChannel | DMChannel, newChannel: GuildChannel | DMChannel) {
		try {
			if (!('guild' in newChannel)) return;

			const config = getLoggingConfig(newChannel.guild.id, 'channelUpdate');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const oldName = 'name' in oldChannel ? oldChannel.name : 'Unknown';
			const newName = 'name' in newChannel ? newChannel.name : 'Unknown';

			if (oldName !== newName) {
				await logChannel.send({
					content: `📝 **Channel Updated**\n**Old Name:** ${oldName}\n**New Name:** ${newName}\n**Time:** ${new Date().toISOString()}`,
					allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
				});
			}
		} catch (error) {
			console.error('Error logging channel update:', error);
		}
	},
} satisfies Event<Events.ChannelUpdate>;
