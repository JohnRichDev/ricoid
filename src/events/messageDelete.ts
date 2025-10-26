import { Events } from 'discord.js';
import type { Message, PartialMessage } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.MessageDelete,
	once: false,
	async execute(message: Message | PartialMessage) {
		try {
			if (!message.guild) return;

			const config = getLoggingConfig(message.guild.id, 'messageDelete');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const content = message.content || '(Content not cached)';
			const author = message.author?.tag || 'Unknown';
			const channel = message.channel && 'name' in message.channel ? message.channel.name : 'Unknown';

			await logChannel.send({
				content: `🗑️ **Message Deleted**\n**Author:** ${author}\n**Channel:** #${channel}\n**Content:** ${content}\n**Time:** ${new Date().toISOString()}`,
				allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
			});
		} catch (error) {
			console.error('Error logging message deletion:', error);
		}
	},
} satisfies Event<Events.MessageDelete>;
