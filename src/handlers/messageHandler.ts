import { Message, TextChannel } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { getCachedSettings } from '../config/index.js';
import { createAIConfig, createAITools } from '../ai/index.js';
import { discordClient } from '../discord/client.js';
import { findSuitableChannel, executeCustomCommand } from '../discord/operations.js';
import { processAIResponse } from './message/aiProcessing.js';
import { buildConversationContext, createConversationEntryFromMessage } from './message/conversation.js';
import type { ConversationHistoryEntry, ConversationPart } from './message/types.js';

let newChannelIdFromPurge: string | null = null;
const tools = createAITools();

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

	let responsePayload = responseText.trim();
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

		const checklistMessageRef = { current: null as Message | null };

		const newChannelIdRef = { current: null as string | null };
		const { responseText } = await processAIResponse(
			aiClient,
			modelName,
			config,
			conversation,
			message,
			userMessage,
			checklistMessageRef,
			newChannelIdRef,
		);
		newChannelIdFromPurge = newChannelIdRef.current;

		console.log('Final response text:', responseText);

		if (checklistMessageRef.current) {
			try {
				await checklistMessageRef.current.delete();
			} catch (error) {
				console.error('Failed to delete checklist message:', error);
			}
		}

		await sendFinalResponse(message, responseText, reactionAdded);
	} catch (error) {
		console.error('Error:', error);
		const { messageExists, channelExists, targetChannel } = await checkMessageAndChannelAccess(message);

		if (targetChannel) {
			let errorContext = 'general error';
			let errorDetails = '';
			let statusCode: number | null = null;

			if (error && typeof error === 'object' && 'status' in error) {
				statusCode = (error as any).status;
				if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
					errorContext = 'temporary server error';
					errorDetails = 'AI service connection issue';
				} else if (statusCode === 429) {
					errorContext = 'rate limit';
					errorDetails = 'too many requests';
				} else if (statusCode && statusCode >= 500) {
					errorContext = 'server error';
					errorDetails = 'AI service experiencing issues';
				} else if (statusCode === 401 || statusCode === 403) {
					errorContext = 'authentication error';
					errorDetails = 'API key configuration issue';
					console.error('CRITICAL: API authentication error. Check your API key configuration.');
				}
			}

			let errorMessage = 'Sorry, I encountered an error processing your message.';

			if (statusCode === 503) {
				errorMessage =
					"🔥 The AI service is currently overloaded. I've tried multiple times but couldn't get through. Please try again in a few moments!";
			} else if (statusCode === 429) {
				errorMessage = "⏱️ Slow down there! I'm hitting rate limits. Give me a moment and try again.";
			} else if (statusCode === 502 || statusCode === 504) {
				errorMessage = '🌐 Connection timeout. The AI service is having a moment. Try again shortly!';
			} else if (statusCode === 401 || statusCode === 403) {
				errorMessage = '🔒 Authentication issue detected. This is a configuration problem on my end.';
			} else {
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
