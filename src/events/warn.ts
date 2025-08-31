import { Events } from 'discord.js';
import type { Event } from './index.js';

export default {
	name: Events.Warn,
	async execute(warning) {
		console.warn('Discord client warning:', warning);
	},
} satisfies Event<Events.Warn>;
