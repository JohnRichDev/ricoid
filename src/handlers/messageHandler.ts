import { Message } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { getCachedSettings, reloadSettings } from '../config/index.js';
import { createAIConfig, createAITools } from '../ai/index.js';
import { discordClient } from '../discord/client.js';
import {
	sendDiscordMessage,
	readDiscordMessages,
	createVoiceChannel,
	createTextChannel,
	clearDiscordMessages,
	createCategory,
	deleteChannel,
	deleteAllChannels,
	listChannels,
	moveChannel,
	renameChannel,
	bulkCreateChannels,
	getServerInfo,
	setChannelPermissions,
} from '../discord/operations.js';
import type {
	MessageData,
	MessageHistory,
	VoiceChannelData,
	TextChannelData,
	ClearMessagesData,
	CategoryData,
	DeleteChannelData,
	DeleteAllChannelsData,
	ListChannelsData,
	MoveChannelData,
	RenameChannelData,
	BulkCreateChannelsData,
	ServerInfoData,
	SetChannelPermissionsData,
} from '../types/index.js';
import { getConversationHistory, addMessageToConversation, type ConversationMessage } from '../util/settingsStore.js';

function normalizeChannelArgs(args: any, messageChannelId: string): any {
	if (args && typeof args === 'object') {
		if ('channel' in args) {
			const channel = args.channel;
			if (!channel || channel.toLowerCase() === 'this channel' || channel.toLowerCase() === 'current channel') {
				args.channel = messageChannelId;
			}
		}

		if ('server' in args && args.server) {
			if (/^\d{17,19}$/.test(args.server)) {
				const isValidServer = discordClient.guilds.cache.has(args.server);
				if (!isValidServer) {
					delete args.server;
				}
			}
		}
	}
	return args;
}

const functionHandlers: Record<string, (args: any) => Promise<any>> = {
	sendDiscordMessage: async (args: MessageData) => {
		return await sendDiscordMessage(args);
	},
	readDiscordMessages: async (args: MessageHistory) => {
		return await readDiscordMessages(args);
	},
	createVoiceChannel: async (args: VoiceChannelData) => {
		return await createVoiceChannel(args);
	},
	createTextChannel: async (args: TextChannelData) => {
		return await createTextChannel(args);
	},
	createCategory: async (args: CategoryData) => {
		return await createCategory(args);
	},
	deleteChannel: async (args: DeleteChannelData) => {
		return await deleteChannel(args);
	},
	deleteAllChannels: async (args: DeleteAllChannelsData) => {
		return await deleteAllChannels(args);
	},
	listChannels: async (args: ListChannelsData) => {
		return await listChannels(args);
	},
	moveChannel: async (args: MoveChannelData) => {
		return await moveChannel(args);
	},
	renameChannel: async (args: RenameChannelData) => {
		return await renameChannel(args);
	},
	bulkCreateChannels: async (args: BulkCreateChannelsData) => {
		return await bulkCreateChannels(args);
	},
	getServerInfo: async (args: ServerInfoData) => {
		return await getServerInfo(args);
	},
	setChannelPermissions: async (args: SetChannelPermissionsData) => {
		return await setChannelPermissions(args);
	},
	clearDiscordMessages: async (args: ClearMessagesData) => {
		return await clearDiscordMessages(args);
	},
	reloadSettings: async () => {
		reloadSettings();
		return 'Settings reloaded successfully! The bot will now use the updated configuration.';
	},
};

export async function handleMessage(message: Message, aiClient: GoogleGenAI): Promise<void> {
	if (message.author.bot) return;

	const channelId = getCachedSettings().channel;
	if (channelId && message.channelId !== channelId) {
		return;
	}

	const userMessage = message.content;
	if (!userMessage.trim()) return;

	try {
		const tools = createAITools();
		const config = createAIConfig(getCachedSettings(), [tools]);

		const modelName = 'gemini-2.5-flash-lite';

		const channelName =
			message.channel && message.channel.isTextBased() && 'name' in message.channel
				? message.channel.name
				: message.channelId;

		const contextualMessage = `Current channel: ${channelName} (ID: ${message.channelId})\nUser message: ${userMessage}`;

		const previousHistory = await getConversationHistory(message.channelId);
		const conversationHistory = previousHistory?.messages || [];

		let conversation: Array<{
			role: 'user' | 'model';
			parts: Array<{ text: string }>;
		}> = [
			{
				role: 'user',
				parts: [{ text: contextualMessage }],
			},
		];

		const recentMessages = conversationHistory.slice(-10);
		if (recentMessages.length > 0) {
			const functionResultsInHistory = recentMessages.filter(
				(msg) => msg.role === 'user' && msg.parts[0]?.text?.startsWith('Function '),
			);

			let contextMessage = 'Previous conversation context:';
			if (functionResultsInHistory.length > 0) {
				contextMessage += '\n\nRecent function call results (you can reference this data in your responses):';
				functionResultsInHistory.forEach((result, index) => {
					contextMessage += `\n${index + 1}. ${result.parts[0].text}`;
				});
			}

			conversation.unshift(
				{
					role: 'user',
					parts: [{ text: contextMessage }],
				},
				...recentMessages.map((msg) => ({
					role: msg.role,
					parts: msg.parts,
				})),
			);
		}

		let responseText = '';
		let hasFunctionCalls = false;
		let maxRounds = 5;
		let round = 0;
		let allFunctionResults: Array<{ name: string; result: any }> = [];

		while (round < maxRounds) {
			round++;

			const response = await aiClient.models.generateContent({
				model: modelName,
				config,
				contents: conversation,
			});

			let functionResults: Array<{ name: string; result: any }> = [];

			if (response.functionCalls && response.functionCalls.length > 0) {
				hasFunctionCalls = true;
				for (const call of response.functionCalls) {
					try {
						if (!call.args || !call.name) continue;

						const handler = functionHandlers[call.name];
						if (handler) {
							const normalizedArgs = normalizeChannelArgs(call.args, message.channelId);
							const result = await handler(normalizedArgs);
							functionResults.push({ name: call.name, result });
							allFunctionResults.push({ name: call.name, result });
							console.log('Function call result:', result);
						} else {
							console.warn(`Unknown function: ${call.name}`);
							functionResults.push({
								name: call.name,
								result: { error: `Unknown function: ${call.name}` },
							});
							allFunctionResults.push({
								name: call.name,
								result: { error: `Unknown function: ${call.name}` },
							});
						}
					} catch (error) {
						console.error('Call error:', error);
						if (call.name) {
							functionResults.push({
								name: call.name,
								result: {
									error: error instanceof Error ? error.message : 'Unknown error',
								},
							});
							allFunctionResults.push({
								name: call.name,
								result: {
									error: error instanceof Error ? error.message : 'Unknown error',
								},
							});
						}
					}
				}

				conversation.push({
					role: 'model',
					parts: [
						{
							text: 'I executed the requested functions.',
						},
					],
				});

				for (const funcResult of functionResults) {
					conversation.push({
						role: 'user',
						parts: [
							{
								text: `Function ${funcResult.name} returned: ${JSON.stringify(funcResult.result)}`,
							},
						],
					});
				}
			} else {
				if (response.candidates) {
					for (const candidate of response.candidates) {
						if (candidate.content && candidate.content.parts) {
							for (const part of candidate.content.parts) {
								if (part.text && typeof part.text === 'string') {
									responseText += part.text;
								}
							}
						}
					}
				}
				break;
			}
		}

		if (round >= maxRounds) {
			console.warn('Reached maximum function call rounds');
			responseText =
				'I performed multiple operations but reached the maximum limit. Please check the logs for details.';
		}

		console.log('Final response text:', responseText);
		console.log('Has function calls:', hasFunctionCalls);

		const userMessageEntry: ConversationMessage = {
			role: 'user',
			parts: [{ text: contextualMessage }],
			timestamp: Date.now(),
		};

		const botResponseEntry: ConversationMessage = {
			role: 'model',
			parts: [{ text: responseText }],
			timestamp: Date.now(),
		};

		const functionResultEntries: ConversationMessage[] = [];
		if (allFunctionResults.length > 0) {
			for (const funcResult of allFunctionResults) {
				functionResultEntries.push({
					role: 'user',
					parts: [
						{
							text: `Function ${funcResult.name} returned: ${JSON.stringify(funcResult.result)}`,
						},
					],
					timestamp: Date.now(),
				});
			}
		}

		await addMessageToConversation(message.channelId, userMessageEntry);

		for (const funcEntry of functionResultEntries) {
			await addMessageToConversation(message.channelId, funcEntry);
		}

		await addMessageToConversation(message.channelId, botResponseEntry);

		if (responseText.trim()) {
			let messageExists = true;
			try {
				await message.fetch();
			} catch (error) {
				messageExists = false;
				console.log('Original message no longer exists, will send regular message');
			}

			if (messageExists) {
				try {
					await message.reply(responseText);
				} catch (error) {
					console.log('Failed to reply to message, sending regular message instead:', error);
					if (message.channel && message.channel.isTextBased() && 'send' in message.channel) {
						await message.channel.send(responseText);
					}
				}
			} else {
				if (message.channel && message.channel.isTextBased() && 'send' in message.channel) {
					await message.channel.send(responseText);
				}
			}
		} else {
			console.log('No response text found, sending debug info');
			let messageExists = true;
			try {
				await message.fetch();
			} catch (error) {
				messageExists = false;
				console.log('Original message no longer exists, will send regular message');
			}

			if (messageExists) {
				try {
					await message.reply(
						"I received your message but couldn't generate a response. Please check the logs for details.",
					);
				} catch (error) {
					console.log('Failed to reply to message, sending regular message instead:', error);
					if (message.channel && message.channel.isTextBased() && 'send' in message.channel) {
						await message.channel.send(
							"I received your message but couldn't generate a response. Please check the logs for details.",
						);
					}
				}
			} else {
				if (message.channel && message.channel.isTextBased() && 'send' in message.channel) {
					await message.channel.send(
						"I received your message but couldn't generate a response. Please check the logs for details.",
					);
				}
			}
		}
	} catch (error) {
		console.error('Error:', error);
		let messageExists = true;
		try {
			await message.fetch();
		} catch (fetchError) {
			messageExists = false;
			console.log('Original message no longer exists during error handling');
		}

		if (messageExists) {
			try {
				await message.reply('Sorry, I encountered an error processing your message.');
			} catch (replyError) {
				console.log('Failed to reply to message during error handling:', replyError);
				if (message.channel && message.channel.isTextBased() && 'send' in message.channel) {
					await message.channel.send('Sorry, I encountered an error processing your message.');
				}
			}
		} else {
			if (message.channel && message.channel.isTextBased() && 'send' in message.channel) {
				await message.channel.send('Sorry, I encountered an error processing your message.');
			}
		}
	}
}
