import type { Message } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { addAttachmentParts } from './attachments.js';
import type { ConversationHistoryEntry, ConversationPart } from './types.js';

function getTextFromPart(part: ConversationPart | undefined): string | null {
	if (!part) {
		return null;
	}
	if ('text' in part && typeof part.text === 'string') {
		return part.text;
	}
	return null;
}

export async function createConversationEntryFromMessage(
	message: Message,
	aiClient: GoogleGenAI,
	currentUserId: string,
): Promise<ConversationHistoryEntry | null> {
	const parts: ConversationPart[] = [];
	if (message.author.bot) {
		const cleanContent = message.content.replace(/^\[Responding to @\w+\]\s*/i, '').trim();
		if (cleanContent) {
			parts.push({ text: cleanContent });
		} else if (message.attachments.size > 0) {
			parts.push({ text: `${message.author.username} shared attachments.` });
		}
		await addAttachmentParts(parts, message.attachments, aiClient);
		return parts.length > 0 ? { role: 'model', parts, timestamp: message.createdTimestamp } : null;
	}
	const isCurrentUser = message.author.id === currentUserId;
	const author = message.author.username;
	const trimmed = message.content.trim();
	const prefix = isCurrentUser ? '[SAME USER] ' : '[DIFFERENT USER] ';
	if (trimmed) {
		parts.push({ text: `${prefix}@${author}: ${trimmed}` });
	} else if (message.attachments.size > 0) {
		parts.push({ text: `${prefix}@${author} shared attachments.` });
	} else {
		return null;
	}
	await addAttachmentParts(parts, message.attachments, aiClient);
	return {
		role: 'user',
		parts,
		timestamp: message.createdTimestamp,
	};
}

export function buildConversationContext(
	contextualParts: ConversationPart[],
	conversationHistory: ConversationHistoryEntry[],
): Array<{ role: 'user' | 'model'; parts: ConversationPart[] }> {
	const aiConfig = {
		maxRecentMessages: 15,
		functionCallPrefix: 'Function ',
		messages: {
			previousContext: 'PREVIOUS CONVERSATION CONTEXT (READ THIS CAREFULLY):',
			functionResults: 'Recent function call results (you can reference this data in your responses):',
			functionResultItem: '{index}. {text}',
		},
	};

	let conversation: Array<{ role: 'user' | 'model'; parts: ConversationPart[] }> = [
		{
			role: 'user',
			parts: contextualParts,
		},
	];

	const recentMessages = conversationHistory.slice(-aiConfig.maxRecentMessages);
	if (recentMessages.length > 0) {
		const functionResultsInHistory = recentMessages.filter((msg) => {
			const firstPartText = getTextFromPart(msg.parts[0]);
			return msg.role === 'user' && firstPartText !== null && firstPartText.startsWith(aiConfig.functionCallPrefix);
		});

		let contextMessage = aiConfig.messages.previousContext;

		const recentUserMessages = recentMessages
			.filter((msg) => {
				const firstPartText = getTextFromPart(msg.parts[0]);
				return msg.role === 'user' && firstPartText !== null && !firstPartText.startsWith(aiConfig.functionCallPrefix);
			})
			.slice(-5);

		if (recentUserMessages.length > 0) {
			contextMessage += '\n\nRecent user requests:';
			recentUserMessages.forEach((msg, index) => {
				const text = getTextFromPart(msg.parts[0]) || '';
				const userMessage = text.includes('User message: ') ? text.split('User message: ')[1] : text;
				contextMessage += `\n${index + 1}. "${userMessage}"`;
			});
		}

		if (functionResultsInHistory.length > 0) {
			contextMessage += '\n\n' + aiConfig.messages.functionResults;
			functionResultsInHistory.forEach((result, index) => {
				const text = getTextFromPart(result.parts[0]) || '';
				contextMessage += `\n${index + 1}. ${text}`;
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

export function extractTextFromParts(parts: ConversationPart[]): string {
	let text = '';
	for (const part of parts) {
		if ('text' in part && typeof part.text === 'string') {
			text += part.text;
		}
	}
	return text;
}

export function extractTextFromCandidate(candidate: any): string {
	if (!candidate.content?.parts) {
		return '';
	}
	return extractTextFromParts(candidate.content.parts);
}

export function extractResponseText(response: any): string {
	if (!response.candidates) {
		return '';
	}

	let responseText = '';
	for (const candidate of response.candidates) {
		responseText += extractTextFromCandidate(candidate);
	}
	return responseText;
}
