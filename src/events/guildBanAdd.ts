import { Events } from 'discord.js';
import type { GuildBan } from 'discord.js';
import type { Event } from './index.js';
import { getLoggingConfig } from '../discord/operations.js';
import { discordClient } from '../discord/client.js';

export default {
	name: Events.GuildBanAdd,
	once: false,
	async execute(ban: GuildBan) {
		try {
			const config = getLoggingConfig(ban.guild.id, 'guildBanAdd');
			if (!config) return;

			const logChannel = await discordClient.channels.fetch(config.channelId);
			if (!logChannel || !('send' in logChannel)) return;

			const user = ban.user.tag;
			const reason = ban.reason || 'No reason provided';

			await logChannel.send({
				content: `🔨 **User Banned**\n**User:** ${user}\n**Reason:** ${reason}\n**Time:** ${new Date().toISOString()}`,
				allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
			});
		} catch (error) {
			console.error('Error logging ban:', error);
		}
	},
} satisfies Event<Events.GuildBanAdd>;
