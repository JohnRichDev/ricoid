import { Message, TextChannel } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { createContext, runInContext } from 'vm';
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
	setChannelTopic,
	setAllChannelTopics,
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
	listRoles,
	createWebhook,
	listWebhooks,
	deleteWebhook,
	getBotInfo,
	getAuditLogs,
	createInvite,
	listInvites,
	deleteInvite,
	addEmoji,
	removeEmoji,
	listEmojis,
	unbanUser,
	listBans,
	updateServerSettings,
	createEvent,
	cancelEvent,
	moveVoiceUser,
	muteVoiceUser,
	createThread,
	archiveThread,
	editMessage,
	deleteMessage,
	setSlowmode,
	setNSFW,
	createForumChannel,
	createForumPost,
	setupLogging,
	createCustomCommand,
	deleteCustomCommand,
	listCustomCommands,
	executeCustomCommand,
	search,
} from '../discord/operations.js';
import {
	deleteChannel,
	deleteAllChannels,
	clearDiscordMessages,
	purgeChannel,
	moderateUser,
	manageUserRole,
	bulkCreateChannels,
	createRole,
	editRole,
	deleteRole,
	setOperationContext,
	clearOperationContext,
} from '../util/confirmedOperations.js';
import type {
	MessageData,
	MessageHistory,
	VoiceChannelData,
	TextChannelData,
	ClearMessagesData,
	PurgeChannelData,
	CategoryData,
	DeleteChannelData,
	DeleteAllChannelsData,
	ListChannelsData,
	MoveChannelData,
	ReorderChannelData,
	ReorderChannelsData,
	RenameChannelData,
	SetChannelTopicData,
	SetAllChannelTopicsData,
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
	SearchData,
	ServerStatsData,
	CreateRoleData,
	EditRoleData,
	DeleteRoleData,
	ListRolesData,
	CreateWebhookData,
	ListWebhooksData,
	DeleteWebhookData,
	GetBotInfoData,
	AuditLogData,
	InviteData,
	ListInvitesData,
	DeleteInviteData,
	EmojiData,
	RemoveEmojiData,
	ListEmojisData,
	UnbanUserData,
	ListBansData,
	UpdateServerSettingsData,
	CreateEventData,
	CancelEventData,
	MoveVoiceUserData,
	MuteVoiceUserData,
	CreateThreadData,
	ArchiveThreadData,
	EditMessageData,
	DeleteMessageData,
	SetSlowmodeData,
	SetNSFWData,
	CreateForumChannelData,
	CreateForumPostData,
	LogEventData,
	CreateCustomCommandData,
	DeleteCustomCommandData,
	ListCustomCommandsData,
} from '../types/index.js';
import { shouldShowConfirmation } from '../commands/utility/settings/confirmationModule.js';
import { createAIConfirmation } from '../util/confirmationSystem.js';

let newChannelIdFromPurge: string | null = null;

function setDefaultServer(args: any, messageGuildId: string): void {
	if (!args.server) {
		args.server = messageGuildId;
	}
}

function normalizeChannelReference(args: any, messageChannelId: string, callName?: string): void {
	if ('channel' in args) {
		const channel = args.channel;
		const isCurrentChannelRef =
			!channel || channel.toLowerCase() === 'this channel' || channel.toLowerCase() === 'current channel';

		if (isCurrentChannelRef) {
			args.channel = messageChannelId;
		}
	} else if (callName === 'clearDiscordMessages') {
		args.channel = messageChannelId;
	} else if (callName === 'purgeChannel') {
		if (!args.channel) {
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

function normalizeChannelArgs(args: any, messageChannelId: string, messageGuildId: string, callName?: string): any {
	if (!args || typeof args !== 'object') {
		return args;
	}

	setDefaultServer(args, messageGuildId);
	normalizeChannelReference(args, messageChannelId, callName);
	validateAndCleanServer(args);

	return args;
}

const functionHandlers: Record<string, (...args: any[]) => Promise<any>> = {
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
	setChannelTopic: async (args: SetChannelTopicData) => {
		return await setChannelTopic(args);
	},
	setAllChannelTopics: async (args: SetAllChannelTopicsData) => {
		return await setAllChannelTopics(args);
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
	purgeChannel: async (args: PurgeChannelData) => {
		return await purgeChannel(args);
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
	search: async (args: SearchData) => {
		return await search(args);
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
	getAuditLogs: async (args: AuditLogData) => {
		return await getAuditLogs(args);
	},
	createInvite: async (args: InviteData) => {
		return await createInvite(args);
	},
	listInvites: async (args: ListInvitesData) => {
		return await listInvites(args);
	},
	deleteInvite: async (args: DeleteInviteData) => {
		return await deleteInvite(args);
	},
	addEmoji: async (args: EmojiData) => {
		return await addEmoji(args);
	},
	removeEmoji: async (args: RemoveEmojiData) => {
		return await removeEmoji(args);
	},
	listEmojis: async (args: ListEmojisData) => {
		return await listEmojis(args);
	},
	unbanUser: async (args: UnbanUserData) => {
		return await unbanUser(args);
	},
	listBans: async (args: ListBansData) => {
		return await listBans(args);
	},
	updateServerSettings: async (args: UpdateServerSettingsData) => {
		return await updateServerSettings(args);
	},
	createEvent: async (args: CreateEventData) => {
		return await createEvent(args);
	},
	cancelEvent: async (args: CancelEventData) => {
		return await cancelEvent(args);
	},
	moveVoiceUser: async (args: MoveVoiceUserData) => {
		return await moveVoiceUser(args);
	},
	muteVoiceUser: async (args: MuteVoiceUserData) => {
		return await muteVoiceUser(args);
	},
	createThread: async (args: CreateThreadData) => {
		return await createThread(args);
	},
	archiveThread: async (args: ArchiveThreadData) => {
		return await archiveThread(args);
	},
	editMessage: async (args: EditMessageData) => {
		return await editMessage(args);
	},
	deleteMessage: async (args: DeleteMessageData) => {
		return await deleteMessage(args);
	},
	setSlowmode: async (args: SetSlowmodeData) => {
		return await setSlowmode(args);
	},
	setNSFW: async (args: SetNSFWData) => {
		return await setNSFW(args);
	},
	createForumChannel: async (args: CreateForumChannelData) => {
		return await createForumChannel(args);
	},
	createForumPost: async (args: CreateForumPostData) => {
		return await createForumPost(args);
	},
	setupLogging: async (args: LogEventData) => {
		return await setupLogging(args);
	},
	createCustomCommand: async (args: CreateCustomCommandData) => {
		return await createCustomCommand(args);
	},
	deleteCustomCommand: async (args: DeleteCustomCommandData) => {
		return await deleteCustomCommand(args);
	},
	listCustomCommands: async (args: ListCustomCommandsData) => {
		return await listCustomCommands(args);
	},
	executeCode: async (args: { code: string }, message?: Message) => {
		const confirmationResult = await handleCodeExecutionConfirmation(args.code, message);
		if (confirmationResult) {
			return confirmationResult;
		}

		return await executeCodeWithRetries(args.code, message);
	},
	reloadSettings: async () => {
		reloadSettings();
		return 'Settings reloaded successfully! The bot will now use the updated configuration.';
	},
};

async function handleCodeExecutionConfirmation(code: string, message?: Message): Promise<string | null> {
	const settings = getCachedSettings();
	if (!shouldShowConfirmation(settings, 'code-execution')) {
		return null;
	}

	if (!message) {
		return 'Cannot execute code: No message context for confirmation.';
	}

	const displayCode = code.length > 1000 ? code.substring(0, 1000) + '...' : code;
	const codeBlock = `\`\`\`javascript\n${displayCode}\n\`\`\``;

	const confirmation = await createAIConfirmation(message.channelId, message.author.id, {
		title: '⚠️ Execute Code',
		description: `Are you sure you want to execute the following JavaScript code?\n\n${codeBlock}\n\n⚠️ **This code has full access to the Discord API and could perform dangerous operations.**`,
		dangerous: true,
		timeout: 30000,
		confirmButtonLabel: 'Execute Code',
	});

	if (!confirmation.confirmed) {
		return confirmation.timedOut
			? 'Code execution timed out - code was not executed.'
			: 'Code execution cancelled - code was not executed.';
	}

	return null;
}

function createReadMessagesFunction(message?: Message) {
	return async (count: number = 50) => {
		if (!message) return 'No message context';
		const result = await readDiscordMessages({
			channel: message.channelId,
			server: message.guildId || undefined,
			messageCount: count,
		});
		try {
			const messages = JSON.parse(result);
			if (Array.isArray(messages)) {
				return messages.map((msg: any) => `${msg.author}: ${msg.content}`).join('\\n');
			}
			return result;
		} catch {
			return result;
		}
	};
}

function createExecutionContext(message?: Message) {
	return createContext({
		console: console,
		readMessages: createReadMessagesFunction(message),
		discordClient: discordClient,
		currentChannel: message?.channelId,
		currentServer: message?.guildId,
	});
}

async function executeCodeWithRetries(code: string, message?: Message): Promise<string> {
	const maxRetries = 3;
	let lastError: string = '';

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const context = createExecutionContext(message);
			const wrappedCode = `(async () => { ${code} })()`;
			const result = await runInContext(wrappedCode, context);
			return `Code executed successfully. Result: ${result}`;
		} catch (error) {
			lastError = error instanceof Error ? error.message : 'Unknown error';
			console.log(`executeCode attempt ${attempt} failed: ${lastError}`);

			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
			}
		}
	}

	return `Error executing code after ${maxRetries} attempts: ${lastError}`;
}

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
		console.error('Original message no longer exists, will send regular message:', error);
	}

	try {
		if (message.channel?.isTextBased() && 'id' in message.channel) {
			await discordClient.channels.fetch(message.channel.id);
		}
	} catch (error) {
		channelExists = false;
		console.error('Original channel no longer exists, finding suitable channel:', error);
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
		return;
	}

	if (targetChannel?.isTextBased() && 'send' in targetChannel) {
		await targetChannel.send(responseText);
	}
}

function buildConversationContext(
	contextualMessage: string,
	conversationHistory: Array<{
		role: 'user' | 'model';
		parts: Array<{ text: string }>;
		timestamp: number;
	}>,
): Array<{
	role: 'user' | 'model';
	parts: Array<{ text: string }>;
}> {
	const aiConfig = {
		maxRecentMessages: 15,
		functionCallPrefix: 'Function ',
		messages: {
			previousContext: 'PREVIOUS CONVERSATION CONTEXT (READ THIS CAREFULLY):',
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

		const recentUserMessages = recentMessages
			.filter((msg) => msg.role === 'user' && !msg.parts[0]?.text?.startsWith(aiConfig.functionCallPrefix))
			.slice(-5);

		if (recentUserMessages.length > 0) {
			contextMessage += '\n\nRecent user requests:';
			recentUserMessages.forEach((msg, index) => {
				const text = msg.parts[0]?.text || '';

				const userMessage = text.includes('User message: ') ? text.split('User message: ')[1] : text;
				contextMessage += `\n${index + 1}. "${userMessage}"`;
			});
		}

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

function extractNewChannelId(result: string): { newChannelId: string | null; cleanedResult: string } {
	const regex = /NEW_CHANNEL_ID:(\d+)/;
	const newChannelMatch = regex.exec(result);
	if (newChannelMatch) {
		return {
			newChannelId: newChannelMatch[1],
			cleanedResult: result.replace(/\s*NEW_CHANNEL_ID:\d+/, ''),
		};
	}
	return { newChannelId: null, cleanedResult: result };
}

async function executeFunctionHandler(call: any, message: Message, handler: Function): Promise<any> {
	const normalizedArgs = normalizeChannelArgs(call.args, message.channelId, message.guildId || '', call.name);
	if (call.name === 'executeCode') {
		return await handler(normalizedArgs, message);
	}
	return await handler(normalizedArgs);
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
		if (!handler) {
			console.warn(`Unknown function: ${call.name}`);
			const errorResult = { error: `Unknown function: ${call.name}` };
			functionResults.push({ name: call.name, result: errorResult });
			allFunctionResults.push({ name: call.name, result: errorResult });
			return;
		}

		setOperationContext({
			message,
			userId: message.author.id,
			channelId: message.channelId,
		});

		try {
			let result = await executeFunctionHandler(call, message, handler);

			if (call.name === 'purgeChannel' && typeof result === 'string') {
				const { newChannelId, cleanedResult } = extractNewChannelId(result);
				if (newChannelId) {
					newChannelIdFromPurge = newChannelId;
					result = cleanedResult;
				}
			}

			functionResults.push({ name: call.name, result });
			allFunctionResults.push({ name: call.name, result });
			console.log(`Function call result for ${call.name}:`, result);

			await new Promise((resolve) => setTimeout(resolve, 500));
		} finally {
			clearOperationContext();
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

function extractTextFromParts(parts: any[]): string {
	let text = '';
	for (const part of parts) {
		if (part.text && typeof part.text === 'string') {
			text += part.text;
		}
	}
	return text;
}

function extractTextFromCandidate(candidate: any): string {
	if (!candidate.content?.parts) {
		return '';
	}
	return extractTextFromParts(candidate.content.parts);
}

function extractResponseText(response: any): string {
	if (!response.candidates) {
		return '';
	}

	let responseText = '';
	for (const candidate of response.candidates) {
		responseText += extractTextFromCandidate(candidate);
	}
	return responseText;
}

async function generateAIContent(
	aiClient: GoogleGenAI,
	modelName: string,
	config: any,
	conversation: any[],
	message: Message,
	allFunctionResults: Array<{ name: string; result: any }>,
): Promise<{ hasMoreFunctionCalls: boolean; responseText: string }> {
	const maxRetries = 3;
	const retryDelay = 2000;
	let lastError;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
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

			return {
				hasMoreFunctionCalls: hasCurrentFunctionCalls,
				responseText: hasCurrentFunctionCalls ? '' : extractResponseText(response),
			};
		} catch (error) {
			lastError = error;
			const statusCode = error && typeof error === 'object' && 'status' in error ? (error as any).status : null;

			const isRetriable = statusCode === 502 || statusCode === 503 || statusCode === 504 || statusCode === 429;

			if (isRetriable && attempt < maxRetries) {
				console.log(`API call failed with status ${statusCode}. Retrying (attempt ${attempt}/${maxRetries})...`);
				await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
			} else {
				throw error;
			}
		}
	}

	throw lastError;
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

		const { hasMoreFunctionCalls, responseText: currentResponseText } = await generateAIContent(
			aiClient,
			modelName,
			config,
			conversation,
			message,
			allFunctionResults,
		);

		if (!hasMoreFunctionCalls) {
			responseText = currentResponseText;
			break;
		}
	}

	if (round >= maxRounds) {
		console.warn('Reached maximum function call rounds');
		responseText = 'I performed multiple operations but reached the maximum limit. Please check the logs for details.';
	}

	return { responseText, allFunctionResults };
}

async function sendFinalResponse(message: Message, responseText: string): Promise<void> {
	let targetChannelOverride = null;

	if (newChannelIdFromPurge) {
		try {
			targetChannelOverride = await discordClient.channels.fetch(newChannelIdFromPurge);
			console.log(`Redirecting response to purged channel: ${newChannelIdFromPurge}`);
		} catch (error) {
			console.error('Failed to fetch new channel after purge:', error);
		} finally {
			newChannelIdFromPurge = null;
		}
	}

	let messageExists = true;
	let channelExists = true;
	let targetChannel = targetChannelOverride;

	if (!targetChannelOverride) {
		const accessCheck = await checkMessageAndChannelAccess(message);
		messageExists = accessCheck.messageExists;
		channelExists = accessCheck.channelExists;
		targetChannel = accessCheck.targetChannel;
	}

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

	const customResponse = await executeCustomCommand(message.guildId || '', userMessage);
	if (customResponse) {
		try {
			await message.reply(customResponse);
		} catch (error) {
			console.error('Error sending custom command response:', error);
		}
		return;
	}

	try {
		const tools = createAITools();
		const config = createAIConfig(getCachedSettings(), [tools]);
		const modelName = 'gemini-2.5-flash-lite';

		const channelName = getChannelName(message);
		const userName = message.author.username;
		const displayName = message.member?.displayName || message.author.displayName || userName;
		const userId = message.author.id;

		const contextualMessage = `Current channel: ${channelName} (ID: ${message.channelId})
Current user: ${displayName} (@${userName}, ID: ${userId})

🎯 **CURRENT USER REQUEST (MOST IMPORTANT - ANSWER THIS):**
User @${userName} says: ${userMessage}

⚠️ CRITICAL: You are responding to @${userName}. Focus ONLY on their current request above. Previous messages from OTHER users are just context - do NOT answer their old questions unless @${userName} is asking about them.`;

		const textChannel = message.channel as TextChannel;
		const fetchedMessages = await textChannel.messages.fetch({ limit: 10, before: message.id });
		const conversationHistory = Array.from(fetchedMessages.values())
			.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
			.filter((msg) => msg.content.trim())
			.slice(-6)
			.map((msg) => {
				const author = msg.author.username;
				const isBot = msg.author.bot;
				const isCurrentUser = msg.author.id === userId;

				if (isBot) {
					return {
						role: 'model' as const,
						parts: [{ text: msg.content }],
						timestamp: msg.createdTimestamp,
					};
				} else {
					return {
						role: 'user' as const,
						parts: [{ text: `${isCurrentUser ? '[SAME USER] ' : '[DIFFERENT USER] '}@${author}: ${msg.content}` }],
						timestamp: msg.createdTimestamp,
					};
				}
			});

		const conversation = buildConversationContext(contextualMessage, conversationHistory);

		const { responseText } = await processAIResponse(aiClient, modelName, config, conversation, message);

		console.log('Final response text:', responseText);

		await sendFinalResponse(message, responseText);
	} catch (error) {
		console.error('Error:', error);
		const { messageExists, channelExists, targetChannel } = await checkMessageAndChannelAccess(message);

		if (targetChannel) {
			let errorMessage = 'Sorry, I encountered an error processing your message.';

			if (error && typeof error === 'object' && 'status' in error) {
				const statusCode = (error as any).status;
				if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
					errorMessage =
						"I'm having trouble connecting to my AI service right now (temporary server error). Please try again in a moment! 🔄";
				} else if (statusCode === 429) {
					errorMessage = "I'm receiving too many requests right now. Please wait a moment and try again! ⏳";
				} else if (statusCode >= 500) {
					errorMessage = 'My AI service is experiencing issues. Please try again shortly! 🛠️';
				} else if (statusCode === 401 || statusCode === 403) {
					errorMessage =
						"I'm having authentication issues with my AI service. Please contact the bot administrator! 🔐";
					console.error('CRITICAL: API authentication error. Check your API key configuration.');
				}
			}

			await sendResponseMessage(message, errorMessage, messageExists, channelExists, targetChannel);
		}
	}
}
