import { Message, TextChannel } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { Script, createContext } from 'vm';
import { getCachedSettings, reloadSettings } from '../config/index.js';
import { createAIConfig, createAITools } from '../ai/index.js';
import { discordClient } from '../discord/client.js';
import {
	sendDiscordMessage,
	createEmbed,
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
	dfint,
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

function validateAndCleanServer(_args: any): void {}

function normalizeChannelArgs(args: any, messageChannelId: string, messageGuildId: string, callName?: string): any {
	if (!args || typeof args !== 'object') {
		return args;
	}

	setDefaultServer(args, messageGuildId);
	normalizeChannelReference(args, messageChannelId, callName);
	validateAndCleanServer(args);

	return args;
}

const createSimpleHandler = (fn: Function) => async (args: any) => await fn(args);

const functionHandlers: Record<string, (...args: any[]) => Promise<any>> = {
	sendDiscordMessage: createSimpleHandler(sendDiscordMessage),
	createEmbed: createSimpleHandler(createEmbed),
	readDiscordMessages: createSimpleHandler(readDiscordMessages),
	createVoiceChannel: createSimpleHandler(createVoiceChannel),
	createTextChannel: createSimpleHandler(createTextChannel),
	createCategory: createSimpleHandler(createCategory),
	deleteChannel: createSimpleHandler(deleteChannel),
	deleteAllChannels: createSimpleHandler(deleteAllChannels),
	listChannels: createSimpleHandler(listChannels),
	moveChannel: createSimpleHandler(moveChannel),
	reorderChannel: createSimpleHandler(reorderChannel),
	reorderChannels: createSimpleHandler(reorderChannels),
	renameChannel: createSimpleHandler(renameChannel),
	setChannelTopic: createSimpleHandler(setChannelTopic),
	setAllChannelTopics: createSimpleHandler(setAllChannelTopics),
	bulkCreateChannels: createSimpleHandler(bulkCreateChannels),
	getServerInfo: createSimpleHandler(getServerInfo),
	setChannelPermissions: createSimpleHandler(setChannelPermissions),
	clearDiscordMessages: createSimpleHandler(clearDiscordMessages),
	purgeChannel: createSimpleHandler(purgeChannel),
	getUserInfo: createSimpleHandler(getUserInfo),
	manageUserRole: createSimpleHandler(manageUserRole),
	moderateUser: createSimpleHandler(moderateUser),
	manageReaction: createSimpleHandler(manageReaction),
	managePin: createSimpleHandler(managePin),
	createPoll: createSimpleHandler(createPoll),
	setReminder: createSimpleHandler(setReminder),
	playGame: createSimpleHandler(playGame),
	calculate: createSimpleHandler(calculate),
	search: createSimpleHandler(search),
	DFINT: createSimpleHandler(dfint),
	getServerStats: createSimpleHandler(getServerStats),
	createRole: createSimpleHandler(createRole),
	editRole: createSimpleHandler(editRole),
	deleteRole: createSimpleHandler(deleteRole),
	listRoles: createSimpleHandler(listRoles),
	createWebhook: createSimpleHandler(createWebhook),
	listWebhooks: createSimpleHandler(listWebhooks),
	deleteWebhook: createSimpleHandler(deleteWebhook),
	getBotInfo: createSimpleHandler(getBotInfo),
	getAuditLogs: createSimpleHandler(getAuditLogs),
	createInvite: createSimpleHandler(createInvite),
	listInvites: createSimpleHandler(listInvites),
	deleteInvite: createSimpleHandler(deleteInvite),
	addEmoji: createSimpleHandler(addEmoji),
	removeEmoji: createSimpleHandler(removeEmoji),
	listEmojis: createSimpleHandler(listEmojis),
	unbanUser: createSimpleHandler(unbanUser),
	listBans: createSimpleHandler(listBans),
	updateServerSettings: createSimpleHandler(updateServerSettings),
	createEvent: createSimpleHandler(createEvent),
	cancelEvent: createSimpleHandler(cancelEvent),
	moveVoiceUser: createSimpleHandler(moveVoiceUser),
	muteVoiceUser: createSimpleHandler(muteVoiceUser),
	createThread: createSimpleHandler(createThread),
	archiveThread: createSimpleHandler(archiveThread),
	editMessage: createSimpleHandler(editMessage),
	deleteMessage: createSimpleHandler(deleteMessage),
	setSlowmode: createSimpleHandler(setSlowmode),
	setNSFW: createSimpleHandler(setNSFW),
	createForumChannel: createSimpleHandler(createForumChannel),
	createForumPost: createSimpleHandler(createForumPost),
	setupLogging: createSimpleHandler(setupLogging),
	createCustomCommand: createSimpleHandler(createCustomCommand),
	deleteCustomCommand: createSimpleHandler(deleteCustomCommand),
	listCustomCommands: createSimpleHandler(listCustomCommands),
	findSuitableChannel: createSimpleHandler(findSuitableChannel),
	executeCode: async (args: { code: string; risky?: boolean }, message?: Message) => {
		if (args.risky) {
			const confirmationResult = await handleCodeExecutionConfirmation(args.code, message);
			if (confirmationResult) {
				return confirmationResult;
			}
		}

		return await executeCodeWithRetries(args.code, message);
	},
	fetchAPI: async (args: { url: string; description: string }) => {
		try {
			let url = args.url.trim();
			if (!url.startsWith('http://') && !url.startsWith('https://')) {
				url = 'https://' + url;
			}

			const response = await fetch(url);
			if (!response.ok) {
				return `API request failed with status ${response.status}: ${response.statusText}`;
			}
			const data = await response.json();

			return `API Response Data (${args.description}):
${JSON.stringify(data, null, 2)}

IMPORTANT: The above is RAW API data. You MUST:
1. Parse and interpret this data carefully
2. ONLY state information that is ACTUALLY present in the response
3. Do NOT make up or hallucinate additional details
4. If you cannot find specific information in the response, say so
5. Verify any claims you make against the actual data above`;
		} catch (error) {
			return `Error fetching API: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}
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

function createExecutionContext(message?: Message, capturedOutput?: string[]) {
	const customConsole = {
		...console,
		log: (...args: any[]) => {
			if (capturedOutput) {
				capturedOutput.push(args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '));
			}
			console.log(...args);
		},
	};

	const context = {
		console: customConsole,
		Date: Date,
		Math: Math,
		JSON: JSON,
		String: String,
		Number: Number,
		Array: Array,
		Object: Object,
		Promise: Promise,
		setTimeout: setTimeout,
		setInterval: setInterval,
		clearTimeout: clearTimeout,
		clearInterval: clearInterval,
		print: (...args: any[]) => customConsole.log(...args),
		readMessages: createReadMessagesFunction(message),
		discordClient: discordClient,
		currentChannel: message?.channelId,
		currentServer: message?.guildId,
	};
	return createContext(context);
}

async function executeCodeWithRetries(code: string, message?: Message): Promise<string> {
	const maxRetries = 3;
	let lastError: string = '';

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const capturedOutput: string[] = [];
			const context = createExecutionContext(message, capturedOutput);

			const trimmedCode = code.trim();
			let wrappedCode: string;

			const hasMultipleStatements =
				trimmedCode.includes('\n') ||
				trimmedCode.includes(';') ||
				trimmedCode.includes('return') ||
				/^(const|let|var|if|for|while|function|class)\s/.test(trimmedCode);

			if (hasMultipleStatements) {
				wrappedCode = `(async () => { ${code} })()`;
			} else {
				wrappedCode = `(async () => { return ${code} })()`;
			}

			console.log('Executing code:', trimmedCode);
			console.log('Wrapped code:', wrappedCode);

			const script = new Script(wrappedCode);
			const result = script.runInContext(context);

			console.log('Raw result:', result);
			console.log('Result type:', typeof result);

			const isThenable =
				result &&
				(typeof result === 'object' || typeof result === 'function') &&
				typeof (result as any).then === 'function';
			console.log('Is thenable:', isThenable);

			let finalResult: any;
			if (isThenable) {
				try {
					finalResult = await (result as any);
				} catch (err) {
					throw err;
				}
			} else {
				finalResult = result;
			}

			console.log('Final result:', finalResult);
			console.log('Final result type:', typeof finalResult);
			console.log('Captured output:', capturedOutput);

			if (finalResult === undefined && capturedOutput.length > 0) {
				finalResult = capturedOutput.join('\n');
			}

			let resultStr: string;
			if (finalResult === undefined) {
				resultStr = 'undefined';
			} else if (finalResult === null) {
				resultStr = 'null';
			} else if (typeof finalResult === 'object') {
				resultStr = JSON.stringify(finalResult, null, 2);
			} else {
				resultStr = String(finalResult);
			}

			return `Code executed successfully. Result: ${resultStr}`;
		} catch (error) {
			if (error instanceof Error) {
				lastError = `${error.name}: ${error.message}`;
			} else if (typeof error === 'string') {
				lastError = error;
			} else if (error && typeof error === 'object') {
				lastError = JSON.stringify(error);
			} else {
				lastError = String(error);
			}
			console.log(`executeCode attempt ${attempt} failed:`, error);

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
	const cleanedResponse = responseText.replace(/^\[Responding to @\w+\]\s*/i, '');

	const messageOptions = {
		content: cleanedResponse,
		allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
	};

	if (messageExists && channelExists && targetChannel === message.channel) {
		try {
			await message.reply(messageOptions);
		} catch (error) {
			console.log('Failed to reply to message, sending regular message instead:', error);
			if (targetChannel?.isTextBased() && 'send' in targetChannel) {
				await targetChannel.send(messageOptions);
			}
		}
		return;
	}

	if (targetChannel?.isTextBased() && 'send' in targetChannel) {
		await targetChannel.send(messageOptions);
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

			const availableFunctions = Object.keys(functionHandlers);
			const normalizedCallName = call.name.toLowerCase().replace(/_/g, '');
			const suggestion = availableFunctions.find((fn) => fn.toLowerCase().replace(/_/g, '') === normalizedCallName);

			let errorMessage = `Unknown function: ${call.name}`;
			if (suggestion) {
				errorMessage += `. Did you mean '${suggestion}'? Use exact function names from your tools.`;
			}

			const errorResult = { error: errorMessage };
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
		try {
			const maxRoundsResponse = await aiClient.models.generateContent({
				model: 'gemini-flash-lite-latest',
				contents: [
					{
						role: 'user',
						parts: [
							{
								text: `Generate a unique, friendly message explaining that you performed multiple operations but hit a processing limit. Keep it 1-2 sentences, casual tone, suggest checking logs. Include a relevant emoji. Make it different each time.`,
							},
						],
					},
				],
			});

			const generatedMaxRounds = maxRoundsResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
			if (generatedMaxRounds) {
				responseText = generatedMaxRounds;
			} else {
				responseText =
					'I performed multiple operations but reached the maximum limit. Please check the logs for details.';
			}
		} catch (error) {
			console.error('Failed to generate max rounds message:', error);
			responseText =
				'I performed multiple operations but reached the maximum limit. Please check the logs for details.';
		}
	}

	return { responseText, allFunctionResults };
}

async function sendFinalResponse(
	message: Message,
	responseText: string,
	reactionAdded: boolean = false,
): Promise<void> {
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

	if (reactionAdded) {
		try {
			await message.reactions.cache.get('🤔')?.users.remove(discordClient.user!.id);
		} catch (error) {
			console.error('Error removing thinking reaction:', error);
		}
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

	let userMessage = message.content;
	if (message.mentions.has(message.client.user!.id)) {
		userMessage = userMessage.replace(new RegExp(`<@!?${message.client.user!.id}>`, 'g'), '').trim();
	}

	const customResponse = await executeCustomCommand(message.guildId || '', userMessage);
	if (customResponse) {
		try {
			await message.reply(customResponse);
		} catch (error) {
			console.error('Error sending custom command response:', error);
		}
		return;
	}

	let reactionAdded = false;
	try {
		await message.react('🤔');
		reactionAdded = true;
	} catch (error) {
		console.error('Error adding thinking reaction:', error);
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

⚠️ CRITICAL INSTRUCTIONS:
- You are responding to @${userName}'s NEW request above
- DO NOT repeat your previous responses - each message needs a FRESH answer
- If user asks to try differently or use different method, DO IT - don't repeat old answers
- Previous messages are ONLY for context - focus on the CURRENT request
- If you failed before, try a DIFFERENT approach this time

🔍 ACCURACY REQUIREMENTS:
- VERIFY all facts against actual data from API responses or code execution
- NEVER state information that isn't in the actual response data
- If uncertain, say "according to [source]" or acknowledge limitations
- Double-check dates, numbers, and specific claims before stating them as fact`;

		const textChannel = message.channel as TextChannel;
		const fetchedMessages = await textChannel.messages.fetch({ limit: 10, before: message.id });
		const messagesArray = Array.from(fetchedMessages.values())
			.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
			.filter((msg) => msg.content.trim())
			.slice(-6);

		const conversationHistory = messagesArray.map((msg) => {
			const author = msg.author.username;
			const isBot = msg.author.bot;
			const isCurrentUser = msg.author.id === userId;

			if (isBot) {
				const cleanContent = msg.content.replace(/^\[Responding to @\w+\]\s*/i, '');

				return {
					role: 'model' as const,
					parts: [{ text: cleanContent }],
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

		await sendFinalResponse(message, responseText, reactionAdded);
	} catch (error) {
		console.error('Error:', error);
		const { messageExists, channelExists, targetChannel } = await checkMessageAndChannelAccess(message);

		if (targetChannel) {
			let errorContext = 'general error';
			let errorDetails = '';

			if (error && typeof error === 'object' && 'status' in error) {
				const statusCode = (error as any).status;
				if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
					errorContext = 'temporary server error';
					errorDetails = 'AI service connection issue';
				} else if (statusCode === 429) {
					errorContext = 'rate limit';
					errorDetails = 'too many requests';
				} else if (statusCode >= 500) {
					errorContext = 'server error';
					errorDetails = 'AI service experiencing issues';
				} else if (statusCode === 401 || statusCode === 403) {
					errorContext = 'authentication error';
					errorDetails = 'API key configuration issue';
					console.error('CRITICAL: API authentication error. Check your API key configuration.');
				}
			}

			let errorMessage = 'Sorry, I encountered an error processing your message.';
			try {
				const errorResponse = await aiClient.models.generateContent({
					model: 'gemini-flash-lite-latest',
					contents: [
						{
							role: 'user',
							parts: [
								{
									text: `Generate a unique, friendly error message for: ${errorContext}. Context: ${errorDetails}. Keep it 1-2 sentences, casual tone, include a relevant emoji. Make it different each time.`,
								},
							],
						},
					],
				});

				const generatedError = errorResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
				if (generatedError) {
					errorMessage = generatedError;
				}
			} catch (aiError) {
				console.error('Failed to generate error message with AI:', aiError);
			}

			await sendResponseMessage(message, errorMessage, messageExists, channelExists, targetChannel);
		}

		if (reactionAdded) {
			try {
				await message.reactions.cache.get('🤔')?.users.remove(discordClient.user!.id);
			} catch (err) {
				console.error('Error removing thinking reaction on error:', err);
			}
		}
	}
}
