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
	createCategory,
	listChannels,
	moveChannel,
	reorderChannel,
	reorderChannels,
	renameChannel,
	getServerInfo,
	setChannelPermissions,
	getUserInfo,
	manageReaction,
	managePin,
	createPoll,
	setReminder,
	playGame,
	calculate,
	getServerStats,
	findSuitableChannel,
	createRole,
	editRole,
	deleteRole,
	listRoles,
	createWebhook,
	listWebhooks,
	deleteWebhook,
	getBotInfo,
} from '../discord/operations.js';
import {
	deleteChannel,
	deleteAllChannels,
	clearDiscordMessages,
	moderateUser,
	manageUserRole,
	bulkCreateChannels,
	setOperationContext,
	clearOperationContext,
} from '../util/confirmedOperations.js';
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
	ReorderChannelData,
	ReorderChannelsData,
	RenameChannelData,
	BulkCreateChannelsData,
	ServerInfoData,
	SetChannelPermissionsData,
	UserInfoData,
	RoleManagementData,
	ModerationData,
	ReactionData,
	PinData,
	PollData,
	ReminderData,
	GameData,
	CalculatorData,
	ServerStatsData,
	CreateRoleData,
	EditRoleData,
	DeleteRoleData,
	ListRolesData,
	CreateWebhookData,
	ListWebhooksData,
	DeleteWebhookData,
	GetBotInfoData,
} from '../types/index.js';
import { getConversationHistory, addMessageToConversation, type ConversationMessage } from '../util/settingsStore.js';

function setDefaultServer(args: any, messageGuildId: string): void {
	if (!args.server) {
		args.server = messageGuildId;
	}
}

function normalizeChannelReference(args: any, messageChannelId: string): void {
	if ('channel' in args) {
		const channel = args.channel;
		const isCurrentChannelRef =
			!channel || channel.toLowerCase() === 'this channel' || channel.toLowerCase() === 'current channel';

		if (isCurrentChannelRef) {
			args.channel = messageChannelId;
		}
	}
}

function validateAndCleanServer(args: any): void {
	if ('server' in args && args.server) {
		const isSnowflakeId = /^\d{17,19}$/.test(args.server);
		if (isSnowflakeId) {
			const isValidServer = discordClient.guilds.cache.has(args.server);
			if (!isValidServer) {
				delete args.server;
			}
		}
	}
}

function normalizeChannelArgs(args: any, messageChannelId: string, messageGuildId: string): any {
	if (!args || typeof args !== 'object') {
		return args;
	}

	setDefaultServer(args, messageGuildId);
	normalizeChannelReference(args, messageChannelId);
	validateAndCleanServer(args);

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
	reorderChannel: async (args: ReorderChannelData) => {
		return await reorderChannel(args);
	},
	reorderChannels: async (args: ReorderChannelsData) => {
		return await reorderChannels(args);
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
	getUserInfo: async (args: UserInfoData) => {
		return await getUserInfo(args);
	},
	manageUserRole: async (args: RoleManagementData) => {
		return await manageUserRole(args);
	},
	moderateUser: async (args: ModerationData) => {
		return await moderateUser(args);
	},
	manageReaction: async (args: ReactionData) => {
		return await manageReaction(args);
	},
	managePin: async (args: PinData) => {
		return await managePin(args);
	},
	createPoll: async (args: PollData) => {
		return await createPoll(args);
	},
	setReminder: async (args: ReminderData) => {
		return await setReminder(args);
	},
	playGame: async (args: GameData) => {
		return await playGame(args);
	},
	calculate: async (args: CalculatorData) => {
		return await calculate(args);
	},
	getServerStats: async (args: ServerStatsData) => {
		return await getServerStats(args);
	},
	createRole: async (args: CreateRoleData) => {
		return await createRole(args);
	},
	editRole: async (args: EditRoleData) => {
		return await editRole(args);
	},
	deleteRole: async (args: DeleteRoleData) => {
		return await deleteRole(args);
	},
	listRoles: async (args: ListRolesData) => {
		return await listRoles(args);
	},
	createWebhook: async (args: CreateWebhookData) => {
		return await createWebhook(args);
	},
	listWebhooks: async (args: ListWebhooksData) => {
		return await listWebhooks(args);
	},
	deleteWebhook: async (args: DeleteWebhookData) => {
		return await deleteWebhook(args);
	},
	getBotInfo: async (args: GetBotInfoData) => {
		return await getBotInfo(args);
	},
	reloadSettings: async () => {
		reloadSettings();
		return 'Settings reloaded successfully! The bot will now use the updated configuration.';
	},
};

function getChannelName(message: Message): string {
	return message.channel?.isTextBased() && 'name' in message.channel && message.channel.name
		? message.channel.name
		: message.channelId;
}

async function checkMessageAndChannelAccess(message: Message): Promise<{
	messageExists: boolean;
	channelExists: boolean;
	targetChannel: any;
}> {
	let messageExists = true;
	let channelExists = true;
	let targetChannel = message.channel;

	try {
		await message.fetch();
	} catch (error) {
		messageExists = false;
		console.log('Original message no longer exists, will send regular message');
	}

	try {
		if (message.channel?.isTextBased() && 'id' in message.channel) {
			await discordClient.channels.fetch(message.channel.id);
		}
	} catch (error) {
		channelExists = false;
		console.log('Original channel no longer exists, finding suitable channel');
		if (message.guildId) {
			const suitableChannel = await findSuitableChannel(message.guildId);
			if (suitableChannel) {
				targetChannel = suitableChannel;
			} else {
				console.log('No suitable channel found for response');
				return { messageExists, channelExists, targetChannel: null };
			}
		}
	}

	return { messageExists, channelExists, targetChannel };
}

async function sendResponseMessage(
	message: Message,
	responseText: string,
	messageExists: boolean,
	channelExists: boolean,
	targetChannel: any,
): Promise<void> {
	if (messageExists && channelExists && targetChannel === message.channel) {
		try {
			await message.reply(responseText);
		} catch (error) {
			console.log('Failed to reply to message, sending regular message instead:', error);
			if (targetChannel?.isTextBased() && 'send' in targetChannel) {
				await targetChannel.send(responseText);
			}
		}
	} else {
		if (targetChannel?.isTextBased() && 'send' in targetChannel) {
			await targetChannel.send(responseText);
		}
	}
}

function buildConversationContext(
	contextualMessage: string,
	conversationHistory: ConversationMessage[],
): Array<{
	role: 'user' | 'model';
	parts: Array<{ text: string }>;
}> {
	const aiConfig = {
		maxRecentMessages: 10,
		functionCallPrefix: 'Function ',
		messages: {
			previousContext: 'Previous conversation context:',
			functionResults: 'Recent function call results (you can reference this data in your responses):',
			functionResultItem: '{index}. {text}',
		},
	};

	let conversation: Array<{
		role: 'user' | 'model';
		parts: Array<{ text: string }>;
	}> = [
		{
			role: 'user',
			parts: [{ text: contextualMessage }],
		},
	];

	const recentMessages = conversationHistory.slice(-aiConfig.maxRecentMessages);
	if (recentMessages.length > 0) {
		const functionResultsInHistory = recentMessages.filter(
			(msg) => msg.role === 'user' && msg.parts[0]?.text?.startsWith(aiConfig.functionCallPrefix),
		);

		let contextMessage = aiConfig.messages.previousContext;
		if (functionResultsInHistory.length > 0) {
			contextMessage += '\n\n' + aiConfig.messages.functionResults;
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

	return conversation;
}

async function processFunctionCall(
	call: any,
	message: Message,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
): Promise<void> {
	try {
		if (!call.args || !call.name) return;

		const handler = functionHandlers[call.name];
		if (handler) {
			setOperationContext({
				message,
				userId: message.author.id,
				channelId: message.channelId,
			});

			try {
				const normalizedArgs = normalizeChannelArgs(call.args, message.channelId, message.guildId || '');
				const result = await handler(normalizedArgs);
				functionResults.push({ name: call.name, result });
				allFunctionResults.push({ name: call.name, result });
				console.log(`Function call result for ${call.name}:`, result);

				await new Promise((resolve) => setTimeout(resolve, 500));
			} finally {
				clearOperationContext();
			}
		} else {
			console.warn(`Unknown function: ${call.name}`);
			const errorResult = { error: `Unknown function: ${call.name}` };
			functionResults.push({ name: call.name, result: errorResult });
			allFunctionResults.push({ name: call.name, result: errorResult });
		}
	} catch (error) {
		console.error('Call error:', error);
		if (call.name) {
			const errorResult = {
				error: error instanceof Error ? error.message : 'Unknown error',
			};
			functionResults.push({ name: call.name, result: errorResult });
			allFunctionResults.push({ name: call.name, result: errorResult });
		}
	}
}

async function processFunctionCalls(
	response: any,
	message: Message,
	conversation: any[],
	allFunctionResults: Array<{ name: string; result: any }>,
): Promise<{ hasFunctionCalls: boolean; functionResults: Array<{ name: string; result: any }> }> {
	if (!response.functionCalls?.length) {
		return { hasFunctionCalls: false, functionResults: [] };
	}

	const functionResults: Array<{ name: string; result: any }> = [];

	for (const call of response.functionCalls) {
		await processFunctionCall(call, message, functionResults, allFunctionResults);
	}

	for (const funcResult of functionResults) {
		conversation.push({
			role: 'user',
			parts: [{ text: `Function ${funcResult.name} returned: ${JSON.stringify(funcResult.result)}` }],
		});
	}

	return { hasFunctionCalls: true, functionResults };
}

function extractResponseText(response: any): string {
	let responseText = '';
	if (response.candidates) {
		for (const candidate of response.candidates) {
			if (candidate.content?.parts) {
				for (const part of candidate.content.parts) {
					if (part.text && typeof part.text === 'string') {
						responseText += part.text;
					}
				}
			}
		}
	}
	return responseText;
}

async function processAIResponse(
	aiClient: GoogleGenAI,
	modelName: string,
	config: any,
	conversation: any[],
	message: Message,
): Promise<{ responseText: string; allFunctionResults: Array<{ name: string; result: any }> }> {
	let responseText = '';
	const maxRounds = 5;
	let round = 0;
	const allFunctionResults: Array<{ name: string; result: any }> = [];

	while (round < maxRounds) {
		round++;

		const response = await aiClient.models.generateContent({
			model: modelName,
			config,
			contents: conversation,
		});

		const { hasFunctionCalls: hasCurrentFunctionCalls } = await processFunctionCalls(
			response,
			message,
			conversation,
			allFunctionResults,
		);

		if (!hasCurrentFunctionCalls) {
			responseText = extractResponseText(response);
			break;
		}
	}

	if (round >= maxRounds) {
		console.warn('Reached maximum function call rounds');
		responseText = 'I performed multiple operations but reached the maximum limit. Please check the logs for details.';
	}

	return { responseText, allFunctionResults };
}

async function saveConversationHistory(
	channelId: string,
	contextualMessage: string,
	responseText: string,
	allFunctionResults: Array<{ name: string; result: any }>,
): Promise<void> {
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

	const functionResultEntries: ConversationMessage[] = allFunctionResults.map((funcResult) => ({
		role: 'user' as const,
		parts: [{ text: `Function ${funcResult.name} returned: ${JSON.stringify(funcResult.result)}` }],
		timestamp: Date.now(),
	}));

	await addMessageToConversation(channelId, userMessageEntry);

	for (const funcEntry of functionResultEntries) {
		await addMessageToConversation(channelId, funcEntry);
	}

	await addMessageToConversation(channelId, botResponseEntry);
}

async function sendFinalResponse(message: Message, responseText: string): Promise<void> {
	const { messageExists, channelExists, targetChannel } = await checkMessageAndChannelAccess(message);

	if (!targetChannel) return;

	if (responseText.trim()) {
		await sendResponseMessage(message, responseText, messageExists, channelExists, targetChannel);
	} else {
		console.log('No response text found, sending debug info');
		const debugMessage = "I received your message but couldn't generate a response. Please check the logs for details.";
		await sendResponseMessage(message, debugMessage, messageExists, channelExists, targetChannel);
	}
}

function shouldProcessMessage(message: Message): boolean {
	if (message.author.bot) return false;

	const channelId = getCachedSettings().channel;
	if (channelId && message.channelId !== channelId) {
		return false;
	}

	const userMessage = message.content;
	return userMessage.trim().length > 0;
}

export async function handleMessage(message: Message, aiClient: GoogleGenAI): Promise<void> {
	if (!shouldProcessMessage(message)) return;

	const userMessage = message.content;

	try {
		const tools = createAITools();
		const config = createAIConfig(getCachedSettings(), [tools]);
		const modelName = 'gemini-2.5-flash-lite';

		const channelName = getChannelName(message);
		const contextualMessage = `Current channel: ${channelName} (ID: ${message.channelId})\nUser message: ${userMessage}`;

		const previousHistory = await getConversationHistory(message.channelId);
		const conversationHistory = previousHistory?.messages || [];

		const conversation = buildConversationContext(contextualMessage, conversationHistory);

		const { responseText, allFunctionResults } = await processAIResponse(
			aiClient,
			modelName,
			config,
			conversation,
			message,
		);

		console.log('Final response text:', responseText);

		await saveConversationHistory(message.channelId, contextualMessage, responseText, allFunctionResults);
		await sendFinalResponse(message, responseText);
	} catch (error) {
		console.error('Error:', error);
		const { messageExists, channelExists, targetChannel } = await checkMessageAndChannelAccess(message);

		if (targetChannel) {
			const errorMessage = 'Sorry, I encountered an error processing your message.';
			await sendResponseMessage(message, errorMessage, messageExists, channelExists, targetChannel);
		}
	}
}
