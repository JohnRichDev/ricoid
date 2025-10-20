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
				description:
					'Set permissions for a role on a specific channel. Allows granting or denying permissions like ViewChannel, SendMessages, ManageMessages, Connect, Speak, etc.',
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
					'Clear multiple messages from a Discord channel using bulk delete. IMPORTANT: Can only delete messages that are between 30 seconds and 2 weeks old (Discord API limitation). Cannot delete individual messages - use this for batch clearing only. If messages are too old or too new, this will fail.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name (e.g., "general") or ID. If not specified, clears the current channel.',
						},
						messageCount: {
							type: Type.NUMBER,
							description:
								'Number of messages to fetch and attempt to clear (max 100, default 100). Only messages within the age limits will be deleted.',
						},
					},
					required: [],
				},
			},
			{
				name: 'purgeChannel',
				description:
					"FORCE PURGE a Discord channel by cloning it and deleting the original. This PERMANENTLY removes ALL messages regardless of age, bypassing Discord's 2-week limitation. Use this when clearDiscordMessages fails due to old messages. WARNING: This is IRREVERSIBLE - all message history will be lost forever.",
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (optional if bot is only in one server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name (e.g., "general") or ID to completely purge.',
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
				name: 'search',
				description: 'Search the web, images, or news using Google Gemini AI with code execution capabilities',
				parameters: {
					type: Type.OBJECT,
					properties: {
						query: {
							type: Type.STRING,
							description: 'Search query to look for',
						},
						type: {
							type: Type.STRING,
							description: 'Type of search to perform',
							enum: ['web', 'images', 'news'],
						},
						limit: {
							type: Type.NUMBER,
							description: 'Maximum number of results to return (optional)',
						},
					},
					required: ['query', 'type'],
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
			{
				name: 'getAuditLogs',
				description: 'View server audit log to track moderation actions and changes',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						limit: {
							type: Type.NUMBER,
							description: 'Number of audit log entries to fetch (default 10, max 100)',
						},
						actionType: {
							type: Type.STRING,
							description: 'Filter by action type (e.g., MEMBER_BAN_ADD, CHANNEL_CREATE, MESSAGE_DELETE)',
						},
					},
					required: [],
				},
			},
			{
				name: 'createInvite',
				description: 'Create an invite link for a Discord server channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name or ID to create invite for',
						},
						maxUses: {
							type: Type.NUMBER,
							description: 'Maximum number of uses (0 = unlimited, default)',
						},
						maxAge: {
							type: Type.NUMBER,
							description: 'Time until expiration in seconds (default 86400 = 24 hours, 0 = never)',
						},
					},
					required: ['channel'],
				},
			},
			{
				name: 'listInvites',
				description: 'List all active invite links for the server',
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
				name: 'deleteInvite',
				description: 'Delete a specific invite link',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						inviteCode: {
							type: Type.STRING,
							description: 'The invite code to delete (e.g., "abc123xyz")',
						},
					},
					required: ['inviteCode'],
				},
			},
			{
				name: 'addEmoji',
				description: 'Add a custom emoji to the server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						name: {
							type: Type.STRING,
							description: 'Name for the emoji',
						},
						imageUrl: {
							type: Type.STRING,
							description: 'URL of the emoji image',
						},
					},
					required: ['name'],
				},
			},
			{
				name: 'removeEmoji',
				description: 'Remove a custom emoji from the server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						emojiName: {
							type: Type.STRING,
							description: 'Name of the emoji to remove',
						},
					},
					required: ['emojiName'],
				},
			},
			{
				name: 'listEmojis',
				description: 'List all custom emojis in the server',
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
				name: 'unbanUser',
				description: 'Remove a ban from a user',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						userId: {
							type: Type.STRING,
							description: 'User ID to unban',
						},
						reason: {
							type: Type.STRING,
							description: 'Reason for unbanning',
						},
					},
					required: ['userId'],
				},
			},
			{
				name: 'listBans',
				description: 'List all banned users in the server',
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
				name: 'updateServerSettings',
				description: 'Update server settings such as name, icon, or description',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						name: {
							type: Type.STRING,
							description: 'New server name',
						},
						iconUrl: {
							type: Type.STRING,
							description: 'URL of new server icon',
						},
						description: {
							type: Type.STRING,
							description: 'New server description',
						},
					},
					required: [],
				},
			},
			{
				name: 'createEvent',
				description: 'Create a scheduled event in the server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						name: {
							type: Type.STRING,
							description: 'Event name',
						},
						description: {
							type: Type.STRING,
							description: 'Event description',
						},
						startTime: {
							type: Type.STRING,
							description: 'ISO 8601 timestamp for event start time',
						},
						channel: {
							type: Type.STRING,
							description: 'Voice channel for the event (optional)',
						},
					},
					required: ['name', 'startTime'],
				},
			},
			{
				name: 'cancelEvent',
				description: 'Cancel a scheduled event',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						eventId: {
							type: Type.STRING,
							description: 'ID of the event to cancel',
						},
					},
					required: ['eventId'],
				},
			},
			{
				name: 'moveVoiceUser',
				description: 'Move a user from one voice channel to another',
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
						toChannel: {
							type: Type.STRING,
							description: 'Target voice channel name or ID',
						},
					},
					required: ['user', 'toChannel'],
				},
			},
			{
				name: 'muteVoiceUser',
				description: 'Mute, unmute, deafen, or undeafen a user in voice chat',
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
							description: 'Action to perform',
							enum: ['mute', 'unmute', 'deafen', 'undeafen'],
						},
					},
					required: ['user', 'action'],
				},
			},
			{
				name: 'createThread',
				description: 'Create a thread in a channel, optionally from a specific message',
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
						name: {
							type: Type.STRING,
							description: 'Thread name',
						},
						messageId: {
							type: Type.STRING,
							description: 'Message ID to start thread from (optional)',
						},
					},
					required: ['channel', 'name'],
				},
			},
			{
				name: 'archiveThread',
				description: 'Archive/close a thread',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Parent channel name or ID',
						},
						threadId: {
							type: Type.STRING,
							description: 'Thread ID to archive',
						},
					},
					required: ['channel', 'threadId'],
				},
			},
			{
				name: 'editMessage',
				description: 'Edit a previously sent message',
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
							description: 'ID of the message to edit',
						},
						newContent: {
							type: Type.STRING,
							description: 'New message content',
						},
					},
					required: ['channel', 'messageId', 'newContent'],
				},
			},
			{
				name: 'deleteMessage',
				description:
					'Delete a single specific message by its ID. ONLY use this when you have an exact message ID to delete (e.g., from editing a specific message). DO NOT use this to clear multiple messages - use clearDiscordMessages instead. Requires the exact numeric message ID (18-19 digits).',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name or ID where the message exists',
						},
						messageId: {
							type: Type.STRING,
							description: 'The exact numeric ID of the specific message to delete (18-19 digits, not a channel ID)',
						},
					},
					required: ['channel', 'messageId'],
				},
			},
			{
				name: 'setSlowmode',
				description: 'Set slowmode delay for a channel (rate limit between messages)',
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
						seconds: {
							type: Type.NUMBER,
							description: 'Slowmode delay in seconds (0 to disable, max 21600 = 6 hours)',
						},
					},
					required: ['channel', 'seconds'],
				},
			},
			{
				name: 'setNSFW',
				description: 'Mark or unmark a channel as NSFW (age-restricted)',
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
						enabled: {
							type: Type.BOOLEAN,
							description: 'True to mark as NSFW, false to remove NSFW flag',
						},
					},
					required: ['channel', 'enabled'],
				},
			},
			{
				name: 'createForumChannel',
				description: 'Create a forum channel for topic-based discussions',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channelName: {
							type: Type.STRING,
							description: 'Name for the forum channel',
						},
						category: {
							type: Type.STRING,
							description: 'Category to create forum in (optional)',
						},
						topic: {
							type: Type.STRING,
							description: 'Forum description/guidelines (optional)',
						},
						tags: {
							type: Type.ARRAY,
							description: 'Available tags for posts (optional)',
							items: {
								type: Type.STRING,
							},
						},
					},
					required: ['channelName'],
				},
			},
			{
				name: 'createForumPost',
				description: 'Create a new post in a forum channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Forum channel name or ID',
						},
						title: {
							type: Type.STRING,
							description: 'Post title',
						},
						message: {
							type: Type.STRING,
							description: 'Post content',
						},
						tags: {
							type: Type.ARRAY,
							description: 'Tags for the post (optional)',
							items: {
								type: Type.STRING,
							},
						},
					},
					required: ['channel', 'title', 'message'],
				},
			},
			{
				name: 'setupLogging',
				description: 'Configure event logging to track server activity in a specific channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						logChannel: {
							type: Type.STRING,
							description: 'Channel to send logs to',
						},
						eventType: {
							type: Type.STRING,
							description: 'Type of events to log',
							enum: ['message', 'member', 'channel', 'role', 'moderation', 'all'],
						},
						enabled: {
							type: Type.BOOLEAN,
							description: 'Enable or disable this log type',
						},
					},
					required: ['logChannel', 'eventType', 'enabled'],
				},
			},
			{
				name: 'createCustomCommand',
				description: 'Create a custom command that responds with a predefined message',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						trigger: {
							type: Type.STRING,
							description: 'Command trigger word/phrase',
						},
						response: {
							type: Type.STRING,
							description: 'Response message',
						},
						description: {
							type: Type.STRING,
							description: 'Command description (optional)',
						},
					},
					required: ['trigger', 'response'],
				},
			},
			{
				name: 'deleteCustomCommand',
				description: 'Delete a custom command',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						trigger: {
							type: Type.STRING,
							description: 'Command trigger to delete',
						},
					},
					required: ['trigger'],
				},
			},
			{
				name: 'listCustomCommands',
				description: 'List all custom commands for the server',
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
				name: 'executeCode',
				description:
					'Execute arbitrary JavaScript code in a safe context. Use this for calculations, string manipulation, or other code execution needs.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						code: {
							type: Type.STRING,
							description: 'The JavaScript code to execute',
						},
					},
					required: ['code'],
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
