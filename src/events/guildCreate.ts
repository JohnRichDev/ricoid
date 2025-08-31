import { Events } from 'discord.js';
import type { Event } from './index.js';

export default {
	name: Events.GuildCreate,
	async execute(guild) {
		console.log(`Joined new guild: ${guild.name} (ID: ${guild.id})`);
		console.log(`Guild member count: ${guild.memberCount}`);
	},
} satisfies Event<Events.GuildCreate>;
