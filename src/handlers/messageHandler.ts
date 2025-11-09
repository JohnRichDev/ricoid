import { Message, TextChannel } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { getCachedSettings } from '../config/index.js';
import { createAIConfig, createAITools } from '../ai/index.js';
import { discordClient } from '../discord/client.js';
import { findSuitableChannel, executeCustomCommand } from '../discord/operations.js';
import { setOperationContext, clearOperationContext } from '../util/confirmedOperations.js';
import { normalizeChannelArgs } from './message/normalize.js';
import { functionHandlers } from './message/functionHandlers.js';
import {
	buildConversationContext,
	extractResponseText,
	createConversationEntryFromMessage,
} from './message/conversation.js';
import type { ConversationHistoryEntry, ConversationPart } from './message/types.js';

let newChannelIdFromPurge: string | null = null;
const tools = createAITools();

type FunctionExecutionStatus = 'success' | 'error' | 'skipped';
type FunctionExecutionLogEntry = {
	name: string;
	args: any;
	status: FunctionExecutionStatus;
	result: any;
};

function stableStringify(value: any): string {
	if (value === undefined) {
		return 'undefined';
	}
	if (value === null) {
		return 'null';
	}
	if (typeof value === 'string') {
		return JSON.stringify(value);
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(',')}]`;
	}
	if (typeof value === 'object') {
		const keys = Object.keys(value).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
	}
	return JSON.stringify(String(value));
}

function createCallSignature(name: string, args: any): string {
	return `${name}:${stableStringify(args)}`;
}

function formatDuplicateMessage(name: string, previousResult: any): string {
	let formattedResult: string;
	if (typeof previousResult === 'string') {
		formattedResult = previousResult;
	} else {
		try {
			formattedResult = JSON.stringify(previousResult);
		} catch {
			formattedResult = String(previousResult);
		}
	}
	return `Duplicate call for ${name} skipped. Previous result: ${formattedResult}`;
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

function normalizeSummaryText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function truncateSummary(value: string, maxLength: number = 160): string {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatResultSummary(result: any): string {
	if (result === undefined || result === null) {
		return '';
	}
	if (typeof result === 'string') {
		return truncateSummary(normalizeSummaryText(result));
	}
	if (typeof result === 'object') {
		if ('error' in result && typeof (result as any).error === 'string') {
			return truncateSummary(normalizeSummaryText((result as any).error));
		}
		try {
			return truncateSummary(JSON.stringify(result));
		} catch {
			return '';
		}
	}
	return truncateSummary(normalizeSummaryText(String(result)));
}

function getStatusEmoji(status: FunctionExecutionStatus): string {
	if (status === 'success') {
		return '✅';
	}
	if (status === 'error') {
		return '❌';
	}
	return '⚠️';
}

function formatExecutionSummary(executionLog: FunctionExecutionLogEntry[]): string {
	if (!executionLog.length) {
		return '';
	}
	const lines = executionLog.map((entry, index) => {
		const emoji = getStatusEmoji(entry.status);
		const summary = formatResultSummary(entry.result);
		return summary ? `${index + 1}. ${emoji} ${entry.name} — ${summary}` : `${index + 1}. ${emoji} ${entry.name}`;
	});
	return `📋 Action Checklist\n${lines.join('\n')}`;
}

async function executeFunctionHandler(
	call: any,
	message: Message,
	handler: Function,
	normalizedArgs?: any,
): Promise<any> {
	const argsToUse =
		normalizedArgs ?? normalizeChannelArgs(call.args, message.channelId, message.guildId || '', call.name);
	if (call.name === 'executeCode') {
		return await handler(argsToUse, message);
	}
	return await handler(argsToUse);
}

async function processFunctionCall(
	call: any,
	message: Message,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	executedCallCache: Map<string, any>,
	functionAttemptCounts: Map<string, number>,
): Promise<void> {
	let callSignature: string | null = null;
	let logEntry: FunctionExecutionLogEntry | null = null;
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
			executionLog.push({
				name: call.name,
				args: call.args ?? null,
				status: 'error',
				result: errorResult,
			});
			return;
		}

		const attemptCount = (functionAttemptCounts.get(call.name) ?? 0) + 1;
		functionAttemptCounts.set(call.name, attemptCount);
		if (call.name === 'screenshotWebsite' && attemptCount > 1) {
			const info =
				'Screenshot already captured for this request. Ask for another screenshot explicitly in a new message if you need a fresh capture.';
			functionResults.push({ name: call.name, result: info });
			allFunctionResults.push({ name: call.name, result: info });
			executionLog.push({
				name: call.name,
				args: call.args ?? null,
				status: 'skipped',
				result: info,
			});
			console.log(info);
			return;
		}

		const clonedArgs =
			typeof call.args === 'object' && call.args !== null && !Array.isArray(call.args) ? { ...call.args } : call.args;
		const normalizedArgs = normalizeChannelArgs(clonedArgs, message.channelId, message.guildId || '', call.name);
		callSignature = createCallSignature(call.name, normalizedArgs);
		logEntry = {
			name: call.name,
			args: normalizedArgs,
			status: 'success',
			result: null,
		};

		if (executedCallCache.has(callSignature)) {
			const previousResult = executedCallCache.get(callSignature);
			const duplicateMessage = formatDuplicateMessage(call.name, previousResult);
			functionResults.push({ name: call.name, result: duplicateMessage });
			allFunctionResults.push({ name: call.name, result: duplicateMessage });
			if (logEntry) {
				logEntry.status = 'skipped';
				logEntry.result = duplicateMessage;
				executionLog.push(logEntry);
				logEntry = null;
			}
			console.log(duplicateMessage);
			return;
		}

		setOperationContext({
			message,
			userId: message.author.id,
			channelId: message.channelId,
		});

		try {
			let result = await executeFunctionHandler(call, message, handler, normalizedArgs);

			if (call.name === 'purgeChannel' && typeof result === 'string') {
				const { newChannelId, cleanedResult } = extractNewChannelId(result);
				if (newChannelId) {
					newChannelIdFromPurge = newChannelId;
					result = cleanedResult;
				}
			}

			functionResults.push({ name: call.name, result });
			allFunctionResults.push({ name: call.name, result });
			executedCallCache.set(callSignature, result);
			if (logEntry) {
				logEntry.result = result;
				executionLog.push(logEntry);
				logEntry = null;
			}
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
			if (callSignature) {
				executedCallCache.set(callSignature, errorResult);
			}
			if (logEntry) {
				logEntry.status = 'error';
				logEntry.result = errorResult;
				executionLog.push(logEntry);
				logEntry = null;
			} else {
				executionLog.push({
					name: call.name,
					args: call.args ?? null,
					status: 'error',
					result: errorResult,
				});
			}
		}
	}
}

async function processFunctionCalls(
	response: any,
	message: Message,
	conversation: any[],
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	executedCallCache: Map<string, any>,
): Promise<{ hasFunctionCalls: boolean; functionResults: Array<{ name: string; result: any }> }> {
	if (!response.functionCalls?.length) {
		return { hasFunctionCalls: false, functionResults: [] };
	}

	const functionResults: Array<{ name: string; result: any }> = [];
	const functionAttemptCounts = new Map<string, number>();

	for (const call of response.functionCalls) {
		await processFunctionCall(
			call,
			message,
			functionResults,
			allFunctionResults,
			executionLog,
			executedCallCache,
			functionAttemptCounts,
		);
	}

	for (const funcResult of functionResults) {
		conversation.push({
			role: 'user',
			parts: [{ text: `Function ${funcResult.name} returned: ${JSON.stringify(funcResult.result)}` }],
		});
	}

	return { hasFunctionCalls: true, functionResults };
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
async function generateAIContent(
	aiClient: GoogleGenAI,
	modelName: string,
	config: any,
	conversation: any[],
	message: Message,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	executedCallCache: Map<string, any>,
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
				executionLog,
				executedCallCache,
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

async function generateFallbackResponse(aiClient: GoogleGenAI, latestUserMessage: string): Promise<string> {
	try {
		const fallback = await aiClient.models.generateContent({
			model: 'gemini-flash-lite-latest',
			contents: [
				{
					role: 'user',
					parts: [
						{
							text: `The previous response was empty. Provide a concise, helpful reply (max two sentences) to this request: ${latestUserMessage}`,
						},
					],
				},
			],
		});

		const text = fallback.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
		if (text) {
			return text;
		}
	} catch (error) {
		console.error('Failed to generate fallback response:', error);
	}
	return `I received your request: ${latestUserMessage}. I could not retrieve additional context, but I am ready to help if you can clarify or provide more details.`;
}

async function processAIResponse(
	aiClient: GoogleGenAI,
	modelName: string,
	config: any,
	conversation: any[],
	message: Message,
	latestUserMessage: string,
): Promise<{
	responseText: string;
	allFunctionResults: Array<{ name: string; result: any }>;
	executionLog: FunctionExecutionLogEntry[];
}> {
	let responseText = '';
	const maxRounds = 5;
	let round = 0;
	const allFunctionResults: Array<{ name: string; result: any }> = [];
	const executedCallCache = new Map<string, any>();
	const executionLog: FunctionExecutionLogEntry[] = [];

	while (round < maxRounds) {
		round++;

		const { hasMoreFunctionCalls, responseText: currentResponseText } = await generateAIContent(
			aiClient,
			modelName,
			config,
			conversation,
			message,
			allFunctionResults,
			executionLog,
			executedCallCache,
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
				model: 'gemini-flash-latest',
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

	if (!responseText.trim()) {
		responseText = await generateFallbackResponse(aiClient, latestUserMessage);
	}

	return { responseText, allFunctionResults, executionLog };
}

async function sendFinalResponse(
	message: Message,
	responseText: string,
	executionLog: FunctionExecutionLogEntry[] = [],
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

	let responsePayload = responseText.trim();
	const checklist = formatExecutionSummary(executionLog);
	if (checklist) {
		responsePayload = responsePayload ? `${responsePayload}\n\n${checklist}` : checklist;
	}
	if (!responsePayload.trim()) {
		console.log('No response text found, sending debug info');
		responsePayload = "I received your message but couldn't generate a response. Please check the logs for details.";
	}
	await sendResponseMessage(message, responsePayload, messageExists, channelExists, targetChannel);

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

	if (!userMessage.trim()) {
		if (message.attachments.size > 0) {
			userMessage = 'shared attachments without any text. Describe them briefly and respond naturally.';
		} else {
			userMessage = 'pinged you without adding any text. Continue the conversation based on their recent messages.';
		}
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
		const config = createAIConfig(getCachedSettings(), [tools]);
		const modelName = 'gemini-flash-latest';

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
- If the user greets you or makes casual small talk, respond naturally, share how you're doing, and keep the conversation going without demanding extra context or refusing the message
- If the user throws an insult or vents, stay upbeat, answer with playful confidence, and pivot toward helping them without sounding offended

🔍 ACCURACY REQUIREMENTS:
- VERIFY all facts against actual data from API responses or code execution
- NEVER state information that isn't in the actual response data
- If uncertain, say "according to [source]" or acknowledge limitations
- Double-check dates, numbers, and specific claims before stating them as fact`;

		const textChannel = message.channel as TextChannel;
		const fetchedMessages = await textChannel.messages.fetch({ limit: 10, before: message.id });
		const messagesArray = Array.from(fetchedMessages.values())
			.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
			.slice(-6);

		const historyEntries = await Promise.all(
			messagesArray.map((msg) => createConversationEntryFromMessage(msg, aiClient, userId)),
		);
		const conversationHistory = historyEntries.filter((entry): entry is ConversationHistoryEntry => entry !== null);
		const contextualParts: ConversationPart[] = [{ text: contextualMessage }];
		const conversation = buildConversationContext(contextualParts, conversationHistory);

		const { responseText, executionLog } = await processAIResponse(
			aiClient,
			modelName,
			config,
			conversation,
			message,
			userMessage,
		);

		console.log('Final response text:', responseText);

		await sendFinalResponse(message, responseText, executionLog, reactionAdded);
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
					model: 'gemini-flash-latest',
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
