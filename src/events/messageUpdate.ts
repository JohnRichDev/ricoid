import { Events } from 'discord.js';
import type { Message, PartialMessage } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.MessageUpdate,
	once: false,
	async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
		try {
			if (!newMessage.guild) return;
			if (oldMessage.content === newMessage.content) return;

			const config = getLoggingConfig(newMessage.guild.id, 'messageUpdate');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const oldContent = oldMessage.content || '(Content not cached)';
			const newContent = newMessage.content || '(Content not cached)';
			const author = newMessage.author?.tag || 'Unknown';
			const channel = newMessage.channel && 'name' in newMessage.channel ? newMessage.channel.name : 'Unknown';

			await logChannel.send({
				content: `📝 **Message Edited**\n**Author:** ${author}\n**Channel:** #${channel}\n**Before:** ${oldContent}\n**After:** ${newContent}\n**Time:** ${new Date().toISOString()}`,
				allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
			});
		} catch (error) {
			console.error('Error logging message edit:', error);
		}
	},
} satisfies Event<Events.MessageUpdate>;
