import { GoogleGenAI, Type } from '@google/genai';
import type { BotSettings } from '../config/index.js';

export interface AITool {
	functionDeclarations: Array<{
		name: string;
		description: string;
		parameters: {
			type: any;
			properties: Record<string, any>;
			required: string[];
		};
	}>;
}

export function createAITools() {
	return {
		functionDeclarations: [
			{
				name: 'sendDiscordMessage',
				description: 'Send a message to a Discord channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name (e.g., "general") or ID',
						},
						message: {
							type: Type.STRING,
							description: 'Message content to send',
						},
					},
					required: ['channel', 'message'],
				},
			},
			{
				name: 'readDiscordMessages',
				description:
					'Read messages from a Discord channel. Can fetch recent messages or find the first/oldest messages in chronological order.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name (e.g., "general") or ID',
						},
						messageCount: {
							type: Type.NUMBER,
							description: 'Number of messages to fetch (max 100). For finding the first message, use a larger number.',
						},
					},
					required: ['channel'],
				},
			},
			{
				name: 'createVoiceChannel',
				description: 'Create a new voice channel in a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name for the new voice channel',
						},
						category: {
							type: Type.STRING,
							description: 'Category name to place the channel in (optional)',
						},
						userLimit: {
							type: Type.NUMBER,
							description: 'Maximum number of users allowed in the channel (0 = unlimited)',
						},
					},
					required: ['channelName'],
				},
			},
			{
				name: 'createTextChannel',
				description: 'Create a new text channel in a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name for the new text channel',
						},
						category: {
							type: Type.STRING,
							description: 'Category name to place the channel in (optional)',
						},
						topic: {
							type: Type.STRING,
							description: 'Channel topic/description (optional)',
						},
					},
					required: ['channelName'],
				},
			},
		],
	};
}

export function createAIConfig(settings: BotSettings, tools: any[]) {
	return {
		thinkingConfig: {
			thinkingBudget: 8192,
		},
		tools,
		systemInstruction: [
			{
				text: settings.prompt,
			},
		],
	};
}

export function createAIClient(apiKey: string): GoogleGenAI {
	return new GoogleGenAI({ apiKey });
}
