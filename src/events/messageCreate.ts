import { Events } from 'discord.js';
import type { Event } from './index.js';
import { readSettings } from '../util/settingsStore.js';

export default {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot) return;

		const settings = await readSettings();
		if (settings.channel && message.channelId !== settings.channel) {
			return;
		}

		console.log(`Message received from ${message.author.tag}: ${message.content}`);
		// do something
	},
} satisfies Event<Events.MessageCreate>;
