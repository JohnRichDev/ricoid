import { Events } from 'discord.js';
import type { Event } from './index.js';
import { readSettings } from '../util/settingsStore.js';
import { handleMessage } from '../handlers/index.js';
import { createAIClient } from '../ai/index.js';
import process from 'node:process';

export default {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot) return;

		const settings = await readSettings();
		if (settings.channel && message.channelId !== settings.channel) {
			return;
		}

		console.log(`Message received from ${message.author.tag}: ${message.content}`);

		const aiClient = createAIClient(process.env.GEMINI_API_KEY!);
		await handleMessage(message, aiClient);
	},
} satisfies Event<Events.MessageCreate>;
