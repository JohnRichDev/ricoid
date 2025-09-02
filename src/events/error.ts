import { Events } from 'discord.js';
import type { Event } from './index.js';

export default {
	name: Events.Error,
	async execute(error) {
		console.error('Discord client error:', error);
	},
} satisfies Event<Events.Error>;
