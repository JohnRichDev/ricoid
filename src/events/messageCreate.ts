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

		const botMentioned = message.mentions.has(message.client.user!.id);
		const isReplyToBot = message.reference?.messageId
			? (await message.channel.messages.fetch(message.reference.messageId).catch(() => null))?.author.id ===
				message.client.user!.id
			: false;

		if (!botMentioned && !isReplyToBot) {
			return;
		}

		console.log(`Message received from ${message.author.tag}: ${message.content}`);

		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			console.error('GEMINI_API_KEY environment variable is not set');
			return;
		}

		const aiClient = createAIClient(apiKey);
		await handleMessage(message, aiClient);
	},
} satisfies Event<Events.MessageCreate>;
