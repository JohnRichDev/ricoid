import { Events } from 'discord.js';
import type { Event } from './index.js';

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Bot ready! Logged in as ${client.user.tag}`);
		console.log(`Connected to ${client.guilds.cache.size} guilds`);
		console.log(`Serving ${client.users.cache.size} users`);
		console.log(`WebSocket ping: ${client.ws.ping}ms`);
	},
} satisfies Event<Events.ClientReady>;
