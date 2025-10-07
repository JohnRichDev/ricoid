import { Events } from 'discord.js';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member: GuildMember | PartialGuildMember) {
		try {
			const config = getLoggingConfig(member.guild.id, 'guildMemberRemove');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const user = member.user.tag;
			const joinedAt = member.joinedAt?.toISOString() || 'Unknown';

			await logChannel.send({
				content: `👋 **Member Left**\n**User:** ${user}\n**Joined:** ${joinedAt}\n**Left:** ${new Date().toISOString()}`,
			});
		} catch (error) {
			console.error('Error logging member removal:', error);
		}
	},
} satisfies Event<Events.GuildMemberRemove>;
