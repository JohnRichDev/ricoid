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
							description: 'Server name or ID (defaults to current server)',
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
							description: 'Server name or ID (defaults to current server)',
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
				name: 'createCategory',
				description: 'Create a new category in a Discord server to organize channels',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						categoryName: {
							type: Type.STRING,
							description: 'Name for the new category',
						},
					},
					required: ['categoryName'],
				},
			},
			{
				name: 'deleteChannel',
				description: 'Delete a channel from a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name of the channel to delete',
						},
						channelType: {
							type: Type.STRING,
							description: 'Type of channel to delete (text, voice, or category)',
							enum: ['text', 'voice', 'category'],
						},
					},
					required: ['channelName'],
				},
			},
			{
				name: 'deleteAllChannels',
				description: 'Delete all channels from a Discord server, with optional exclusions',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						excludeCategories: {
							type: Type.ARRAY,
							description: 'Array of category names to exclude from deletion',
							items: {
								type: Type.STRING,
							},
						},
						excludeChannels: {
							type: Type.ARRAY,
							description: 'Array of channel names to exclude from deletion',
							items: {
								type: Type.STRING,
							},
						},
					},
					required: [],
				},
			},
			{
				name: 'listChannels',
				description:
					'List all channels and categories in a Discord server in their current hierarchical order with positions. Shows the exact structure as users see it, including category → channel relationships and position numbers.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						category: {
							type: Type.STRING,
							description: 'Optional category name to show only channels within that category',
						},
					},
					required: [],
				},
			},
			{
				name: 'moveChannel',
				description: 'Move a channel to a different category',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name of the channel to move',
						},
						newCategory: {
							type: Type.STRING,
							description: 'Name of the category to move the channel to',
						},
						channelType: {
							type: Type.STRING,
							description: 'Type of channel to move (text or voice)',
							enum: ['text', 'voice'],
						},
					},
					required: ['channelName', 'newCategory'],
				},
			},
			{
				name: 'renameChannel',
				description: 'Rename a channel or category',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						oldName: {
							type: Type.STRING,
							description: 'Current name of the channel or category',
						},
						newName: {
							type: Type.STRING,
							description: 'New name for the channel or category',
						},
						channelType: {
							type: Type.STRING,
							description: 'Type of channel to rename (text, voice, or category)',
							enum: ['text', 'voice', 'category'],
						},
					},
					required: ['oldName', 'newName'],
				},
			},
			{
				name: 'reorderChannel',
				description:
					'Move a single channel or category to a different position in the server (e.g., move to top, bottom, or specific order)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name of the channel or category to reorder',
						},
						position: {
							type: Type.NUMBER,
							description: 'New position for the channel (0 = top, higher numbers = lower position)',
						},
						channelType: {
							type: Type.STRING,
							description: 'Type of channel to reorder (text, voice, or category)',
							enum: ['text', 'voice', 'category'],
						},
					},
					required: ['channelName', 'position'],
				},
			},
			{
				name: 'reorderChannels',
				description: 'Reorganize multiple channels or categories at once to create a better server structure',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channels: {
							type: Type.ARRAY,
							description: 'Array of channel objects with name, position, and optional type',
							items: {
								type: Type.OBJECT,
								properties: {
									name: {
										type: Type.STRING,
										description: 'Channel or category name',
									},
									position: {
										type: Type.NUMBER,
										description: 'New position for this channel (0 = top)',
									},
									type: {
										type: Type.STRING,
										description: 'Type of channel (text, voice, or category)',
										enum: ['text', 'voice', 'category'],
									},
								},
								required: ['name', 'position'],
							},
						},
					},
					required: ['channels'],
				},
			},
			{
				name: 'setChannelTopic',
				description: 'Set the topic/description for a text channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name of the text channel to set the topic for',
						},
						topic: {
							type: Type.STRING,
							description: 'The topic/description to set for the channel',
						},
						channelType: {
							type: Type.STRING,
							description: 'Type of channel (defaults to text)',
							enum: ['text', 'voice'],
						},
					},
					required: ['channelName', 'topic'],
				},
			},
			{
				name: 'setAllChannelTopics',
				description: 'Set topics/descriptions for multiple text channels at once',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelTopics: {
							type: Type.OBJECT,
							description:
								'An object mapping channel names to their topics (e.g., {"general": "General discussion", "announcements": "Important updates"})',
						},
					},
					required: ['channelTopics'],
				},
			},
			{
				name: 'bulkCreateChannels',
				description:
					'Create multiple channels at once under a specific category. Text channels will automatically get appropriate topics based on their names.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						category: {
							type: Type.STRING,
							description: "Category name to place all channels in (will be created if it doesn't exist)",
						},
						textChannels: {
							type: Type.ARRAY,
							description: 'Array of text channel names to create',
							items: {
								type: Type.STRING,
							},
						},
						voiceChannels: {
							type: Type.ARRAY,
							description: 'Array of voice channel names to create',
							items: {
								type: Type.STRING,
							},
						},
					},
					required: ['category'],
				},
			},
			{
				name: 'getServerInfo',
				description: 'Get detailed information about a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
					},
					required: [],
				},
			},
			{
				name: 'setChannelPermissions',
				description: 'Set permissions for a role on a specific channel (currently informational only)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name of the channel',
						},
						roleName: {
							type: Type.STRING,
							description: 'Name of the role to modify permissions for',
						},
						allow: {
							type: Type.ARRAY,
							description: 'Array of permissions to allow',
							items: {
								type: Type.STRING,
							},
						},
						deny: {
							type: Type.ARRAY,
							description: 'Array of permissions to deny',
							items: {
								type: Type.STRING,
							},
						},
						channelType: {
							type: Type.STRING,
							description: 'Type of channel (text, voice, or category)',
							enum: ['text', 'voice', 'category'],
						},
					},
					required: ['channelName', 'roleName'],
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
							description: "Category name to place the channel in (will be created if it doesn't exist)",
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
				description:
					'Create a new text channel in a Discord server. If no topic is provided, an appropriate topic will be automatically generated based on the channel name.',
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
							description: "Category name to place the channel in (will be created if it doesn't exist)",
						},
						topic: {
							type: Type.STRING,
							description: 'Channel topic/description (optional - will be auto-generated if not provided)',
						},
					},
					required: ['channelName'],
				},
			},
			{
				name: 'clearDiscordMessages',
				description:
					'Clear messages from a Discord channel. Can clear a specific number of messages or all messages in the channel.',
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
							description: 'Number of messages to clear (max 100). If not specified, clears up to 100 messages.',
						},
					},
					required: ['channel'],
				},
			},
			{
				name: 'reloadSettings',
				description: 'Reload the bot settings from the configuration file',
				parameters: {
					type: Type.OBJECT,
					properties: {},
					required: [],
				},
			},

			{
				name: 'getUserInfo',
				description: 'Get detailed information about a server member',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						user: {
							type: Type.STRING,
							description: 'Username, nickname, or user ID to look up',
						},
					},
					required: ['user'],
				},
			},
			{
				name: 'manageUserRole',
				description: 'Add or remove a role from a user',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						user: {
							type: Type.STRING,
							description: 'Username, nickname, or user ID',
						},
						roleName: {
							type: Type.STRING,
							description: 'Name of the role to add or remove',
						},
						action: {
							type: Type.STRING,
							description: 'Action to perform',
							enum: ['add', 'remove'],
						},
					},
					required: ['user', 'roleName', 'action'],
				},
			},
			{
				name: 'moderateUser',
				description: 'Perform moderation actions on a user (kick, ban, timeout)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						user: {
							type: Type.STRING,
							description: 'Username, nickname, or user ID',
						},
						action: {
							type: Type.STRING,
							description: 'Moderation action to perform',
							enum: ['kick', 'ban', 'timeout', 'untimeout'],
						},
						reason: {
							type: Type.STRING,
							description: 'Reason for the moderation action',
						},
						duration: {
							type: Type.NUMBER,
							description: 'Duration in minutes (for timeout only)',
						},
					},
					required: ['user', 'action'],
				},
			},

			{
				name: 'manageReaction',
				description: 'Add or remove reactions to messages',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name or ID',
						},
						messageId: {
							type: Type.STRING,
							description: 'ID of the message to react to',
						},
						emoji: {
							type: Type.STRING,
							description: 'Emoji to add/remove (e.g., 👍, 😀, :thumbsup:)',
						},
						action: {
							type: Type.STRING,
							description: 'Action to perform',
							enum: ['add', 'remove'],
						},
					},
					required: ['channel', 'messageId', 'emoji', 'action'],
				},
			},
			{
				name: 'managePin',
				description: 'Pin or unpin messages in a channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name or ID',
						},
						messageId: {
							type: Type.STRING,
							description: 'ID of the message to pin/unpin',
						},
						action: {
							type: Type.STRING,
							description: 'Action to perform',
							enum: ['pin', 'unpin'],
						},
					},
					required: ['channel', 'messageId', 'action'],
				},
			},
			{
				name: 'createPoll',
				description: 'Create a poll for server members to vote on',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel to post the poll in',
						},
						question: {
							type: Type.STRING,
							description: 'Poll question',
						},
						options: {
							type: Type.ARRAY,
							description: 'Array of poll options',
							items: {
								type: Type.STRING,
							},
						},
						duration: {
							type: Type.NUMBER,
							description: 'Poll duration in minutes (optional)',
						},
					},
					required: ['channel', 'question', 'options'],
				},
			},

			{
				name: 'playGame',
				description: 'Play simple games with the bot',
				parameters: {
					type: Type.OBJECT,
					properties: {
						type: {
							type: Type.STRING,
							description: 'Type of game to play',
							enum: ['rps', 'coinflip', 'dice', 'number_guess'],
						},
						userChoice: {
							type: Type.STRING,
							description: "User's choice (for rock-paper-scissors, number for guessing)",
						},
					},
					required: ['type'],
				},
			},

			{
				name: 'setReminder',
				description: 'Set a reminder for yourself or others',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						user: {
							type: Type.STRING,
							description: 'User to remind (optional, defaults to message author)',
						},
						message: {
							type: Type.STRING,
							description: 'Reminder message',
						},
						delay: {
							type: Type.NUMBER,
							description: 'Delay in minutes before sending reminder',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel to send reminder to (optional, defaults to current channel)',
						},
					},
					required: ['message', 'delay'],
				},
			},
			{
				name: 'calculate',
				description: 'Perform mathematical calculations',
				parameters: {
					type: Type.OBJECT,
					properties: {
						expression: {
							type: Type.STRING,
							description: 'Mathematical expression to evaluate (e.g., "2 + 2 * 3", "sin(45)", "sqrt(16)")',
						},
					},
					required: ['expression'],
				},
			},

			{
				name: 'getServerStats',
				description: 'Get detailed statistics about the server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
					},
					required: [],
				},
			},
			{
				name: 'createRole',
				description: 'Create a new role in a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						name: {
							type: Type.STRING,
							description: 'Name for the new role',
						},
						color: {
							type: Type.STRING,
							description: 'Hex color code for the role (e.g., #FF0000 for red)',
						},
						permissions: {
							type: Type.ARRAY,
							description: 'Array of permission names to grant to this role',
							items: {
								type: Type.STRING,
							},
						},
					},
					required: ['name'],
				},
			},
			{
				name: 'editRole',
				description: 'Edit an existing role in a Discord server (change name or color)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						roleName: {
							type: Type.STRING,
							description: 'Current name of the role to edit',
						},
						newName: {
							type: Type.STRING,
							description: 'New name for the role (optional)',
						},
						newColor: {
							type: Type.STRING,
							description: 'New hex color code for the role (e.g., #00FF00 for green, optional)',
						},
					},
					required: ['roleName'],
				},
			},
			{
				name: 'deleteRole',
				description: 'Delete a role from a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						roleName: {
							type: Type.STRING,
							description: 'Name of the role to delete',
						},
					},
					required: ['roleName'],
				},
			},
			{
				name: 'listRoles',
				description: 'List all roles in a Discord server with their details',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
					},
					required: [],
				},
			},
			{
				name: 'createWebhook',
				description: 'Create a webhook for a Discord channel to send messages from external services',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name or ID to create the webhook in',
						},
						name: {
							type: Type.STRING,
							description: 'Name for the webhook',
						},
					},
					required: ['channel', 'name'],
				},
			},
			{
				name: 'listWebhooks',
				description: 'List all webhooks in a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
					},
					required: [],
				},
			},
			{
				name: 'deleteWebhook',
				description: 'Delete a webhook from a Discord server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						webhookId: {
							type: Type.STRING,
							description: 'ID of the webhook to delete',
						},
					},
					required: ['webhookId'],
				},
			},
			{
				name: 'getBotInfo',
				description: 'Get information about the bot itself including its user ID and current roles',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
					},
					required: [],
				},
			},
		],
	};
}

export function createAIConfig(settings: BotSettings, tools: any[]) {
	return {
		// thinkingConfig: {
		// 	thinkingBudget: 8192,
		// },
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
