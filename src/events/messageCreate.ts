import { Events, Message } from 'discord.js';
import type { Event } from './index.js';
import { readSettings } from '../util/settingsStore.js';
import { handleMessage } from '../handlers/index.js';
import { createAIClient } from '../ai/index.js';
import { GoogleGenAI } from '@google/genai';
import { getCachedSettings } from '../config/index.js';
import process from 'node:process';

async function isMessageForBot(message: Message, aiClient: GoogleGenAI): Promise<boolean> {
	const botMentioned = message.mentions.has(message.client.user!.id);
	const isReplyToBot = message.reference?.messageId
		? (await message.channel.messages.fetch(message.reference.messageId).catch(() => null))?.author.id ===
			message.client.user!.id
		: false;

	if (botMentioned || isReplyToBot) {
		console.log('Message directed at bot (mention or reply)');
		return true;
	}

	const recentMessages = await message.channel.messages.fetch({ limit: 10 });
	const messages = Array.from(recentMessages.values()).reverse();

	const lastBotMessageIndex = messages.findIndex((msg) => msg.author.id === message.client.user!.id);
	const timeSinceLastBotMessage =
		lastBotMessageIndex !== -1 ? Date.now() - messages[lastBotMessageIndex].createdTimestamp : Infinity;

	const settings = getCachedSettings();
	const botJustReplied = timeSinceLastBotMessage < settings.messageDetection.conversationTimeout;

	console.log(
		`AI deciding: "${message.content.substring(0, 50)}..." (bot replied ${Math.floor(timeSinceLastBotMessage / 1000)}s ago)`,
	);

	try {
		const conversationContext = messages
			.slice(0, 10)
			.map((msg: Message) => `${msg.author.bot ? 'Bot' : msg.author.username}: ${msg.content}`)
			.join('\n');

		const botName = message.client.user!.username;
		const botRecentlyActive = botJustReplied ? ' The bot just responded recently.' : '';
		const prompt = `You are "${botName}", a Discord bot. Determine if this message is directed at YOU.

Conversation:
${conversationContext}

New message: "${message.content}"${botRecentlyActive}

Reply "yes" if:
- Message explicitly asks YOU to do something
- Message is a follow-up/continuation after you just replied
- Clear question or command directed at the bot
- User responding to something you just said

Reply "no" if:
- Random conversation between users
- Not asking the bot anything
- Just a statement with no request

Reply ONLY "yes" or "no".`;

		const result = await aiClient.models.generateContent({
			model: 'gemini-flash-latest',
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
		});

		if (!result.candidates || result.candidates.length === 0) {
			return false;
		}

		const candidate = result.candidates[0];
		if (!candidate.content?.parts) {
			return false;
		}

		const responseText = candidate.content.parts
			.filter((part: any) => part.text)
			.map((part: any) => part.text)
			.join('')
			.trim()
			.toLowerCase();

		const isForBot = responseText.includes('yes');
		console.log(`AI result: ${isForBot ? 'FOR bot' : 'NOT for bot'} (response: "${responseText}")`);
		return isForBot;
	} catch (error) {
		console.error('Error determining message intent:', error);
		return false;
	}
}

export default {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot) return;

		const settings = await readSettings();
		if (settings.channel && message.channelId !== settings.channel) {
			return;
		}

		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) {
			console.error('GEMINI_API_KEY environment variable is not set');
			return;
		}

		const aiClient = createAIClient(apiKey);

		const shouldRespond = await isMessageForBot(message, aiClient);
		if (!shouldRespond) {
			return;
		}

		console.log(`Message received from ${message.author.tag}: ${message.content}`);

		await handleMessage(message, aiClient);
	},
} satisfies Event<Events.MessageCreate>;
