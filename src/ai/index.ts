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
				description:
					'Send a PLAIN TEXT message to a Discord channel. CANNOT send embeds/rich formatting - use executeCode for embeds.',
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
				name: 'createEmbed',
				description:
					'Create and send a rich embed message to a Discord channel. Use this for formatted messages with titles, descriptions, fields, colors, images. CALL THIS ONLY ONCE PER REQUEST - it immediately sends the embed. DO NOT call multiple times for the same request.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID (defaults to current server)' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						title: { type: Type.STRING, description: 'Embed title' },
						description: { type: Type.STRING, description: 'Main embed body text' },
						color: { type: Type.STRING, description: 'Hex color code (e.g., "#FF5733")' },
						fields: {
							type: Type.ARRAY,
							items: {
								type: Type.OBJECT,
								properties: {
									name: { type: Type.STRING },
									value: { type: Type.STRING },
									inline: { type: Type.BOOLEAN },
								},
							},
						},
						footer: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, iconUrl: { type: Type.STRING } } },
						image: { type: Type.STRING, description: 'Large image URL' },
						thumbnail: { type: Type.STRING, description: 'Thumbnail URL' },
						author: {
							type: Type.OBJECT,
							properties: { name: { type: Type.STRING }, iconUrl: { type: Type.STRING }, url: { type: Type.STRING } },
						},
						timestamp: { type: Type.BOOLEAN, description: 'Add timestamp' },
						url: { type: Type.STRING, description: 'Title URL' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'readDiscordMessages',
				description:
					'Read messages from a Discord channel. Can fetch recent messages or find the first/oldest messages in chronological order. IMPORTANT: If the user mentions a specific server name or provides a server ID, you MUST include the server parameter in your function call.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description:
								'Server name or ID. REQUIRED if user specifies a different server than the current one. Use the server ID (snowflake) if provided, or the server name mentioned by the user.',
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
					"FORCE PURGE a Discord channel. This PERMANENTLY removes ALL messages regardless of age, bypassing Discord's 2-week limitation. Use this when clearDiscordMessages fails due to old messages. WARNING: This is IRREVERSIBLE - all message history will be lost forever.",
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
				description:
					'Perform mathematical calculations using standard math functions. Supports: basic arithmetic (+,-,*,/), trigonometric functions (sin, cos, tan), logarithms (log, log10), power/root (pow, sqrt, cbrt), rounding (abs, ceil, floor, round), and constants (pi or PI for π, e or E for Euler\'s number). CANNOT find specific digits of pi or other constants - use executeCode for that. Use direct function calls without Math prefix (e.g., "sin(pi/4)" not "Math.sin(Math.PI/4)").',
				parameters: {
					type: Type.OBJECT,
					properties: {
						expression: {
							type: Type.STRING,
							description:
								'Mathematical expression to evaluate. Examples: "2 + 2 * 3", "sin(pi/4)", "sqrt(16)", "pow(2,10)", "pi * 2". Do NOT use Math.PI or Math.sin - use pi and sin directly.',
						},
					},
					required: ['expression'],
				},
			},
			{
				name: 'screenshotWebsite',
				description:
					"Capture a live screenshot of a webpage using the bot's local browser environment and deliver it in Discord. Ideal when the user wants to see the current appearance of a site.",
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: {
							type: Type.STRING,
							description: 'Server name or ID (defaults to current server)',
						},
						channel: {
							type: Type.STRING,
							description: 'Channel name or ID where the screenshot should be posted',
						},
						url: {
							type: Type.STRING,
							description: 'Website URL to capture. If protocol is missing, https is assumed.',
						},
						fullPage: {
							type: Type.BOOLEAN,
							description: 'Capture the full scrollable page when true. Defaults to true.',
						},
						width: {
							type: Type.NUMBER,
							description: 'Viewport width in pixels (320-3840). Defaults to 1280.',
						},
						height: {
							type: Type.NUMBER,
							description: 'Viewport height in pixels (320-2160). Defaults to 720.',
						},
						deviceScaleFactor: {
							type: Type.NUMBER,
							description: 'Device pixel ratio (1-3). Defaults to 1.',
						},
						delayMs: {
							type: Type.NUMBER,
							description: 'Delay in milliseconds after load before capturing (0-30000).',
						},
					},
					required: ['channel', 'url'],
				},
			},
			{
				name: 'search',
				description:
					'Search the web, images, or news using Google Gemini AI with code execution capabilities. For image searches, returns actual image URLs that can be shared with users.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						query: {
							type: Type.STRING,
							description: 'Search query to look for',
						},
						type: {
							type: Type.STRING,
							description: 'Type of search to perform. Use "images" to find and return image URLs.',
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
				name: 'DFINT',
				description:
					'Digital Footprint Intelligence - Tool for comprehensive web intelligence gathering. Searches across multiple search engines (Google, Bing, DuckDuckGo, Yahoo), scrapes web content, and provides AI-analyzed intelligence reports. Use this for deep research, background checks, or gathering comprehensive information about any topic.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						query: {
							type: Type.STRING,
							description: 'Search query or subject to investigate',
						},
						depth: {
							type: Type.STRING,
							description:
								'Analysis depth: "shallow" for quick overview, "moderate" for balanced analysis (default), "deep" for comprehensive investigation',
							enum: ['shallow', 'moderate', 'deep'],
						},
						includeImages: {
							type: Type.BOOLEAN,
							description: 'Include image URLs in the intelligence report',
						},
						includeNews: {
							type: Type.BOOLEAN,
							description: 'Include recent news and developments in the report',
						},
						maxResults: {
							type: Type.NUMBER,
							description: 'Maximum number of results to gather (default: 10)',
						},
						engines: {
							type: Type.ARRAY,
							description: 'Search engines to use. Options: google, bing, duckduckgo, yahoo',
							items: {
								type: Type.STRING,
								enum: ['google', 'bing', 'duckduckgo', 'yahoo'],
							},
						},
						scrapeResults: {
							type: Type.BOOLEAN,
							description:
								'Enable web scraping to extract content from top search results (slower but more comprehensive)',
						},
					},
					required: ['query'],
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
					'Execute JavaScript code for calculations, data processing, real-time information, AND Discord embeds/rich formatting. REQUIRED for sending embeds - use discordClient.channels.cache.get(channelId).send({ embeds: [...] }). Has access to discordClient, currentChannel, currentServer variables. Mark as risky if code performs Discord operations.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						code: {
							type: Type.STRING,
							description:
								'JavaScript code to execute. For current date/time use: new Date().toLocaleString() or new Date().toDateString()',
						},
						risky: {
							type: Type.BOOLEAN,
							description:
								'Set to FALSE for sending embeds/messages, calculations, reading data (these are safe, non-destructive). Set to TRUE only for destructive operations like bulk deleting, modifying roles, or clearing messages.',
						},
					},
					required: ['code', 'risky'],
				},
			},
			{
				name: 'fetchAPI',
				description:
					'Fetch data from free public APIs (no API keys required). Use this to get real-time information from any publicly accessible API endpoint.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						url: {
							type: Type.STRING,
							description: 'The full URL of the API endpoint to fetch (must include https://).',
						},
						description: {
							type: Type.STRING,
							description: 'Brief description of what data you are fetching.',
						},
					},
					required: ['url', 'description'],
				},
			},
			{
				name: 'bulkEditMessages',
				description: 'Edit multiple bot messages at once with new content',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						messageIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of message IDs to edit' },
						newContent: { type: Type.STRING, description: 'New content for all messages' },
					},
					required: ['channel', 'messageIds', 'newContent'],
				},
			},
			{
				name: 'searchMessages',
				description: 'Search messages in a channel by content, author, or date range',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						query: { type: Type.STRING, description: 'Text to search for in messages' },
						author: { type: Type.STRING, description: 'Filter by author username' },
						limit: { type: Type.NUMBER, description: 'Max results (default 100)' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'pinAllMessages',
				description: 'Pin multiple messages based on criteria (reactions, author, content)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						minReactions: { type: Type.NUMBER, description: 'Minimum reaction count' },
						authorId: { type: Type.STRING, description: 'Filter by author ID' },
						containsText: { type: Type.STRING, description: 'Filter by text content' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'exportMessages',
				description: 'Export channel messages to JSON or text file',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						format: { type: Type.STRING, enum: ['json', 'txt'], description: 'Export format' },
						limit: { type: Type.NUMBER, description: 'Max messages (default 1000)' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'copyMessages',
				description: 'Copy messages from one channel to another',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						sourceChannel: { type: Type.STRING, description: 'Source channel name or ID' },
						targetChannel: { type: Type.STRING, description: 'Target channel name or ID' },
						limit: { type: Type.NUMBER, description: 'Max messages to copy (default 50)' },
					},
					required: ['sourceChannel', 'targetChannel'],
				},
			},
			{
				name: 'warnUser',
				description: 'Issue a warning to a user (tracked in persistent storage)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						user: { type: Type.STRING, description: 'Username or user ID' },
						reason: { type: Type.STRING, description: 'Reason for warning' },
						moderator: { type: Type.STRING, description: 'Moderator issuing warning' },
					},
					required: ['user', 'reason', 'moderator'],
				},
			},
			{
				name: 'listWarnings',
				description: 'View all warnings for a user',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						user: { type: Type.STRING, description: 'Username or user ID' },
					},
					required: ['user'],
				},
			},
			{
				name: 'clearWarnings',
				description: 'Clear all or specific warnings for a user',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						user: { type: Type.STRING, description: 'Username or user ID' },
						warningId: { type: Type.STRING, description: 'Specific warning ID to clear (optional)' },
					},
					required: ['user'],
				},
			},
			{
				name: 'muteUser',
				description: 'Mute a user (removes Send Messages permission)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						user: { type: Type.STRING, description: 'Username or user ID' },
						reason: { type: Type.STRING, description: 'Reason for mute' },
					},
					required: ['user'],
				},
			},
			{
				name: 'lockChannel',
				description: 'Lock or unlock a channel (prevent/allow @everyone from sending messages)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						locked: { type: Type.BOOLEAN, description: 'True to lock, false to unlock' },
					},
					required: ['channel', 'locked'],
				},
			},
			{
				name: 'massKick',
				description: 'Kick multiple users matching criteria (bots, no roles, etc)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						criteria: { type: Type.STRING, enum: ['bots', 'no_roles'], description: 'Kick criteria' },
						reason: { type: Type.STRING, description: 'Reason for kicks' },
					},
					required: ['criteria'],
				},
			},
			{
				name: 'massBan',
				description: 'Ban multiple users by ID list',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						userIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of user IDs' },
						reason: { type: Type.STRING, description: 'Reason for bans' },
					},
					required: ['userIds'],
				},
			},
			{
				name: 'cloneRole',
				description: 'Duplicate a role with all permissions',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						roleName: { type: Type.STRING, description: 'Role name to clone' },
						newName: { type: Type.STRING, description: 'Name for cloned role' },
					},
					required: ['roleName'],
				},
			},
			{
				name: 'giveRoleToAll',
				description: 'Assign a role to all members or filtered subset',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						roleName: { type: Type.STRING, description: 'Role name to assign' },
						filter: { type: Type.STRING, enum: ['all', 'bots', 'humans'], description: 'Member filter' },
					},
					required: ['roleName'],
				},
			},
			{
				name: 'removeRoleFromAll',
				description: 'Remove a role from all members who have it',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						roleName: { type: Type.STRING, description: 'Role name to remove' },
					},
					required: ['roleName'],
				},
			},
			{
				name: 'syncPermissions',
				description: 'Sync category permissions to all child channels',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						category: { type: Type.STRING, description: 'Category name' },
					},
					required: ['category'],
				},
			},
			{
				name: 'cloneChannel',
				description: 'Duplicate a channel with all settings and permissions',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channelName: { type: Type.STRING, description: 'Channel name to clone' },
					},
					required: ['channelName'],
				},
			},
			{
				name: 'createTemplate',
				description: 'Save server structure as template (channels, categories, roles)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						templateName: { type: Type.STRING, description: 'Name for template' },
					},
					required: ['templateName'],
				},
			},
			{
				name: 'applyTemplate',
				description: 'Apply saved template to recreate server structure',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						templateFile: { type: Type.STRING, description: 'Template filename' },
					},
					required: ['templateFile'],
				},
			},
			{
				name: 'backupServer',
				description: 'Full server backup (channels, roles, permissions, settings)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
					},
					required: [],
				},
			},
			{
				name: 'voiceStats',
				description: 'Get voice activity statistics (who is in voice, where)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
					},
					required: [],
				},
			},
			{
				name: 'disconnectAll',
				description: 'Disconnect all users from a voice channel',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Voice channel name or ID' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'moveAll',
				description: 'Move all users from one voice channel to another',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						fromChannel: { type: Type.STRING, description: 'Source voice channel' },
						toChannel: { type: Type.STRING, description: 'Target voice channel' },
					},
					required: ['fromChannel', 'toChannel'],
				},
			},
			{
				name: 'stealEmoji',
				description: 'Copy emoji from another server by URL',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						emojiUrl: { type: Type.STRING, description: 'Emoji image URL' },
						name: { type: Type.STRING, description: 'Name for emoji' },
					},
					required: ['emojiUrl', 'name'],
				},
			},
			{
				name: 'enlargeEmoji',
				description: 'Get full-size version of custom emoji',
				parameters: {
					type: Type.OBJECT,
					properties: {
						emojiId: { type: Type.STRING, description: 'Custom emoji ID' },
					},
					required: ['emojiId'],
				},
			},
			{
				name: 'avatar',
				description: 'Get user avatar URL (profile picture)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						user: { type: Type.STRING, description: 'Username or user ID' },
					},
					required: ['user'],
				},
			},
			{
				name: 'serverIcon',
				description: 'Get server icon, banner, and splash URLs',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
					},
					required: [],
				},
			},
			{
				name: 'getChannelHistory',
				description: 'Show when channel was created and its metadata',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'translate',
				description:
					'AI-powered translation to any language, including fictional languages and styles (Shakespearean, pirate, Yoda, Elvish, Klingon, etc)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						text: { type: Type.STRING, description: 'Text to translate' },
						targetLanguage: {
							type: Type.STRING,
							description: 'Target language or style (e.g., "Spanish", "Pirate", "Yoda", "Shakespearean")',
						},
						style: { type: Type.STRING, description: 'Additional style modifiers (optional)' },
					},
					required: ['text', 'targetLanguage'],
				},
			},
			{
				name: 'weather',
				description: 'Get current weather for any location',
				parameters: {
					type: Type.OBJECT,
					properties: {
						location: { type: Type.STRING, description: 'City name or location' },
					},
					required: ['location'],
				},
			},
			{
				name: 'define',
				description: 'Get dictionary definition for a word',
				parameters: {
					type: Type.OBJECT,
					properties: {
						word: { type: Type.STRING, description: 'Word to define' },
					},
					required: ['word'],
				},
			},
			{
				name: 'wikipedia',
				description: 'Search Wikipedia and get article summary',
				parameters: {
					type: Type.OBJECT,
					properties: {
						query: { type: Type.STRING, description: 'Search query' },
						sentences: { type: Type.NUMBER, description: 'Number of sentences in summary (default 3)' },
					},
					required: ['query'],
				},
			},
			{
				name: 'messageHeatmap',
				description: 'Show when channel is most active (by hour/day)',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						days: { type: Type.NUMBER, description: 'Days to analyze (default 7)' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'topPosters',
				description: 'Show users with most messages in a time period',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						channel: { type: Type.STRING, description: 'Channel name or ID' },
						limit: { type: Type.NUMBER, description: 'Number of top posters (default 10)' },
						days: { type: Type.NUMBER, description: 'Days to analyze (default 7)' },
					},
					required: ['channel'],
				},
			},
			{
				name: 'emojiStats',
				description: 'Most used emojis in server',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						days: { type: Type.NUMBER, description: 'Days to analyze (default 7)' },
					},
					required: [],
				},
			},
			{
				name: 'channelActivity',
				description: 'Compare activity across all channels',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						days: { type: Type.NUMBER, description: 'Days to analyze (default 7)' },
					},
					required: [],
				},
			},
			{
				name: 'reactOnKeyword',
				description: 'Auto-react to messages containing specific keywords',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						keyword: { type: Type.STRING, description: 'Keyword to watch for' },
						emoji: { type: Type.STRING, description: 'Emoji to react with' },
						action: { type: Type.STRING, enum: ['add', 'remove', 'list'], description: 'Action to perform' },
					},
					required: ['keyword', 'emoji'],
				},
			},
			{
				name: 'autoRespond',
				description: 'Set up auto-responses to specific triggers',
				parameters: {
					type: Type.OBJECT,
					properties: {
						server: { type: Type.STRING, description: 'Server name or ID' },
						trigger: { type: Type.STRING, description: 'Trigger phrase' },
						response: { type: Type.STRING, description: 'Response message' },
						action: { type: Type.STRING, enum: ['add', 'remove', 'list'], description: 'Action to perform' },
					},
					required: ['trigger'],
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

export { DFINT } from './search.js';
