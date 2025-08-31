import { Events } from 'discord.js';
import type { Event } from './index.js';

export default {
	name: Events.Debug,
	async execute(info) {
		if (process.env.NODE_ENV === 'development') {
			console.debug('Discord debug:', info);
		}
	},
} satisfies Event<Events.Debug>;
