import { Events } from 'discord.js';
import type { Event } from './index.js';

export default {
	name: Events.GuildDelete,
	async execute(guild) {
		console.log(`Left guild: ${guild.name} (ID: ${guild.id})`);
	},
} satisfies Event<Events.GuildDelete>;
