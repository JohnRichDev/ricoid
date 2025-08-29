import { Message } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { settings } from '../config/index.js';
import { createAIConfig, createAITools } from '../ai/index.js';
import {
	sendDiscordMessage,
	readDiscordMessages,
	createVoiceChannel,
	createTextChannel,
} from '../discord/operations.js';

export async function handleMessage(message: Message, aiClient: GoogleGenAI): Promise<void> {
	if (message.author.bot) return;

	const channelId = settings.channel;
	if (channelId && message.channelId !== channelId) {
		return;
	}

	const userMessage = message.content;
	if (!userMessage.trim()) return;

	try {
		const tools = createAITools();
		const config = createAIConfig(settings, [tools]);

		const modelName = 'gemini-2.5-flash-lite';

		const channelName =
			message.channel.isTextBased() && 'name' in message.channel ? message.channel.name : message.channelId;

		const contextualMessage = `Current channel: ${channelName} (ID: ${message.channelId})\nUser message: ${userMessage}`;

		const conversation = [
			{
				role: 'user',
				parts: [
					{
						text: contextualMessage,
					},
				],
			},
		];

		const response = await aiClient.models.generateContent({
			model: modelName,
			config,
			contents: conversation,
		});

		let responseText = '';
		let hasFunctionCalls = false;
		let functionResults: Array<{ name: string; result: any }> = [];

		if (response.functionCalls && response.functionCalls.length > 0) {
			hasFunctionCalls = true;
			for (const call of response.functionCalls) {
				try {
					if (!call.args) continue;
					let result;
					if (call.name === 'sendDiscordMessage') {
						const args = call.args as { server?: string; channel: string; message: string };
						if (
							!args.channel ||
							args.channel.toLowerCase() === 'this channel' ||
							args.channel.toLowerCase() === 'current channel'
						) {
							args.channel = message.channelId;
						}
						result = await sendDiscordMessage(args);
					} else if (call.name === 'readDiscordMessages') {
						const args = call.args as { server?: string; channel: string; messageCount?: number };
						if (
							!args.channel ||
							args.channel.toLowerCase() === 'this channel' ||
							args.channel.toLowerCase() === 'current channel'
						) {
							args.channel = message.channelId;
						}
						result = await readDiscordMessages(args);
					} else if (call.name === 'createVoiceChannel') {
						const args = call.args as { server?: string; channelName: string; category?: string; userLimit?: number };
						result = await createVoiceChannel(args);
					} else if (call.name === 'createTextChannel') {
						const args = call.args as { server?: string; channelName: string; category?: string; topic?: string };
						result = await createTextChannel(args);
					}

					if (call.name) {
						functionResults.push({ name: call.name, result });
					}
					console.log('Function call result:', result);
				} catch (error) {
					console.error('Call error:', error);
					if (call.name) {
						functionResults.push({
							name: call.name,
							result: {
								error: error instanceof Error ? error.message : 'Unknown error',
							},
						});
					}
				}
			}
		}

		if (hasFunctionCalls && functionResults.length > 0) {
			const followUpConversation = [
				{
					role: 'user',
					parts: [
						{
							text: contextualMessage,
						},
					],
				},
				{
					role: 'model',
					parts: [
						{
							text: 'I need to use tools to help with this request.',
						},
					],
				},
			];

			for (const funcResult of functionResults) {
				followUpConversation.push({
					role: 'user',
					parts: [
						{
							text: `Function ${funcResult.name} returned: ${JSON.stringify(funcResult.result)}`,
						},
					],
				});
			}

			const followUpResponse = await aiClient.models.generateContent({
				model: modelName,
				config: {
					...config,
					tools: [],
				},
				contents: followUpConversation,
			});

			if (followUpResponse.candidates) {
				for (const candidate of followUpResponse.candidates) {
					if (candidate.content && candidate.content.parts) {
						for (const part of candidate.content.parts) {
							if (part.text && typeof part.text === 'string' && !part.thoughtSignature) {
								responseText += part.text;
							}
						}
					}
				}
			}
		} else {
			if (response.candidates) {
				for (const candidate of response.candidates) {
					if (candidate.content && candidate.content.parts) {
						for (const part of candidate.content.parts) {
							if (part.text && typeof part.text === 'string' && !part.thoughtSignature) {
								responseText += part.text;
							} else if (part.thoughtSignature) {
								console.log('Ignoring thought signature part (this is normal)');
							}
						}
					}
				}
			}
		}

		console.log('Final response text:', responseText);
		console.log('Has function calls:', hasFunctionCalls);

		if (responseText.trim()) {
			await message.reply(responseText);
		}
	} catch (error) {
		console.error('Error:', error);
		await message.reply('Sorry, I encountered an error processing your message.');
	}
}
