import { Guild, TextChannel, PermissionFlagsBits } from 'discord.js';
import { discordClient } from '../client.js';
import { findServer, findTextChannel, findChannelByName, getChannelTypeDisplayName } from './core.js';
import { validateMessageContent, parseHexColor, safeStringifyObject } from '../../util/helpers.js';
import {
	DISCORD_LIMITS,
	POLL_EMOJIS,
	BULK_DELETE_MIN_AGE_MS,
	BULK_DELETE_MAX_AGE_MS,
	CHANNEL_TYPES,
	ERROR_MESSAGES,
} from '../../util/constants.js';
import type {
	MessageData,
	MessageHistory,
	CategoryData,
	DeleteChannelData,
	DeleteAllChannelsData,
	VoiceChannelData,
	TextChannelData,
	ClearMessagesData,
	PurgeChannelData,
	ListChannelsData,
	MoveChannelData,
	ReorderChannelData,
	ReorderChannelsData,
	RenameChannelData,
	SetChannelTopicData,
	SetAllChannelTopicsData,
	BulkCreateChannelsData,
	SetChannelPermissionsData,
	ReactionData,
	PinData,
	PollData,
	SetSlowmodeData,
	SetNSFWData,
	CreateForumChannelData,
	CreateForumPostData,
	CreateThreadData,
	ArchiveThreadData,
	CreateWebhookData,
	ListWebhooksData,
	DeleteWebhookData,
	EditMessageData,
	DeleteMessageData,
	LogEventData,
} from '../../types/index.js';

const loggingConfig: Map<string, any> = new Map();

function clampString(input: string, limit: number): string {
	return input.length > limit ? `${input.slice(0, limit - 3)}...` : input;
}

function setString(value: unknown): string | null {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value === 'object') {
		const result = safeStringifyObject(value);
		return result !== ERROR_MESSAGES.EMPTY_OBJECT ? result : ERROR_MESSAGES.EMPTY_OBJECT;
	}
	const stringValue = String(value).trim();
	return stringValue.length ? stringValue : null;
}

function splitFromSeparators(text: string): { name: string; value: string } | null {
	const separators = ['\n\n', '\r\n\r\n', '\r\n', '\n', ' — ', ' – ', ' - ', ': ', ' | ', ' • ', ' ~ ', ' → ', ' => '];
	for (const separator of separators) {
		const index = text.indexOf(separator);
		if (index > 0) {
			const name = text.slice(0, index).trim();
			const value = text.slice(index + separator.length).trim();
			if (name) return { name, value };
		}
	}
	return null;
}

function deriveFieldPartsFromString(raw: string, index: number): { name: string; value: string } {
	const ZERO_WIDTH_SPACE = '\u200b';
	const condensed = raw.replace(/\s+/g, ' ').trim();
	if (!condensed) return { name: `Entry ${index + 1}`, value: ZERO_WIDTH_SPACE };

	let name = '';
	let value = '';

	const separatorResult = splitFromSeparators(raw);
	if (separatorResult) {
		name = separatorResult.name;
		value = separatorResult.value;
	}

	if (!name) {
		const sentenceRegex = /^(.{20,140}?[.!?])\s+(.*)$/s;
		const sentenceMatch = sentenceRegex.exec(condensed);
		if (sentenceMatch) {
			name = sentenceMatch[1].trim();
			value = sentenceMatch[2].trim();
		}
	}

	if (!name) {
		name = condensed.length <= 80 ? condensed : condensed.slice(0, 80).trim();
		value = condensed.length > 80 ? condensed.slice(name.length).trim() : '';
	}

	if (!value) value = condensed !== name ? condensed : ZERO_WIDTH_SPACE;
	return { name, value };
}

function parseInlineValue(inlineRaw: any): boolean | undefined {
	if (typeof inlineRaw === 'boolean') return inlineRaw;
	if (typeof inlineRaw === 'string') {
		const lowered = inlineRaw.trim().toLowerCase();
		if (lowered === 'true') return true;
		if (lowered === 'false') return false;
	}
	return undefined;
}

function normalizeObjectField(field: any): { name: string; value: string; inline?: boolean } | null {
	const nameValue = setString(field.name);
	const valueValue = setString(field.value);
	if (!nameValue || !valueValue) return null;

	const inlineValue = parseInlineValue(field.inline);
	const result: { name: string; value: string; inline?: boolean } = {
		name: clampString(nameValue, 256),
		value: clampString(valueValue, 1024),
	};
	if (typeof inlineValue === 'boolean') {
		result.inline = inlineValue;
	}
	return result;
}

function normalizeStringField(field: string, index: number): { name: string; value: string } | null {
	const ZERO_WIDTH_SPACE = '\u200b';
	const trimmed = field.trim();
	if (!trimmed) return null;

	const { name, value } = deriveFieldPartsFromString(trimmed, index);
	return {
		name: clampString(name, 256),
		value: clampString(value || ZERO_WIDTH_SPACE, 1024),
	};
}

function normalizeFields(rawFields: unknown): Array<{ name: string; value: string; inline?: boolean }> {
	if (!Array.isArray(rawFields)) return [];

	const normalized: Array<{ name: string; value: string; inline?: boolean }> = [];
	rawFields.forEach((field, index) => {
		if (field && typeof field === 'object' && !Array.isArray(field)) {
			const result = normalizeObjectField(field);
			if (result) normalized.push(result);
		} else if (typeof field === 'string') {
			const result = normalizeStringField(field, index);
			if (result) normalized.push(result);
		}
	});
	return normalized;
}

function extractFieldsFromDescription(description: string): {
	cleaned: string | null;
	fields: Array<{ name: string; value: string; inline?: boolean }>;
} {
	let working = description;
	const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

	working = working.replace(/"inline"\s+(true|false)/gi, '"inline": $1');
	const candidates = working.match(/\{[\s\S]*?\}/g) || [];

	for (const raw of candidates) {
		try {
			const parsed = JSON.parse(raw);
			const n = setString(parsed.name);
			const v = setString(parsed.value);
			const inl = parseInlineValue(parsed.inline);

			if (n && v) {
				fields.push({
					name: clampString(n, 256),
					value: clampString(v, 1024),
					...(typeof inl === 'boolean' ? { inline: inl } : {}),
				});
				working = working.replace(raw, '').trim();
			}
		} catch {}
	}

	const cleaned = working.trim();
	return {
		cleaned: cleaned.length > 0 ? cleaned : null,
		fields,
	};
}

function buildEmbedFooter(footer: any): Record<string, any> | null {
	const footerText = setString(footer.text);
	if (!footerText) return null;

	const normalizedFooter: Record<string, any> = { text: clampString(footerText, 2048) };
	const footerIcon = setString(footer.iconUrl);
	if (footerIcon) normalizedFooter.icon_url = footerIcon;
	return normalizedFooter;
}

function buildEmbedAuthor(author: any): Record<string, any> | null {
	const authorName = setString(author.name);
	if (!authorName) return null;

	const normalizedAuthor: Record<string, any> = { name: clampString(authorName, 256) };
	const authorIcon = setString(author.iconUrl);
	const authorUrl = setString(author.url);
	if (authorIcon) normalizedAuthor.icon_url = authorIcon;
	if (authorUrl) normalizedAuthor.url = authorUrl;
	return normalizedAuthor;
}

function processEmbedDescription(description?: string): {
	description: string | null;
	fields: Array<{ name: string; value: string; inline?: boolean }>;
} {
	let normalizedDescription = setString(description);
	let extractedFieldsFromDescription: Array<{ name: string; value: string; inline?: boolean }> = [];

	if (normalizedDescription) {
		const { cleaned, fields } = extractFieldsFromDescription(normalizedDescription);
		normalizedDescription = cleaned;
		extractedFieldsFromDescription = fields;
	}

	return {
		description: normalizedDescription ? clampString(normalizedDescription, 4096) : null,
		fields: extractedFieldsFromDescription,
	};
}

function addEmbedMedia(embed: any, params: { image?: string; thumbnail?: string }): void {
	if (params.image) {
		const imageUrl = setString(params.image);
		if (imageUrl) embed.image = { url: imageUrl };
	}

	if (params.thumbnail) {
		const thumbnailUrl = setString(params.thumbnail);
		if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };
	}
}

function addEmbedMetadata(
	embed: any,
	params: {
		footer?: { text: string; iconUrl?: string };
		author?: { name: string; iconUrl?: string; url?: string };
		timestamp?: boolean;
		url?: string;
	},
): void {
	if (params.footer && typeof params.footer === 'object') {
		const footerObj = buildEmbedFooter(params.footer);
		if (footerObj) embed.footer = footerObj;
	}

	if (params.author && typeof params.author === 'object') {
		const authorObj = buildEmbedAuthor(params.author);
		if (authorObj) embed.author = authorObj;
	}

	if (params.timestamp) embed.timestamp = new Date().toISOString();

	if (params.url) {
		const normalizedUrl = setString(params.url);
		if (normalizedUrl) embed.url = normalizedUrl;
	}
}

function buildEmbed(params: {
	title?: string;
	description?: string;
	color?: string;
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	footer?: { text: string; iconUrl?: string };
	image?: string;
	thumbnail?: string;
	author?: { name: string; iconUrl?: string; url?: string };
	timestamp?: boolean;
	url?: string;
}): any {
	const embed: any = {};

	const normalizedTitle = setString(params.title);
	if (normalizedTitle) embed.title = clampString(normalizedTitle, 256);

	const { description, fields: extractedFields } = processEmbedDescription(params.description);
	if (description) embed.description = description;

	if (params.color) {
		const parsedColor = parseHexColor(params.color);
		if (parsedColor !== null) embed.color = parsedColor;
	}

	const normalizedFields = normalizeFields(params.fields);
	if (extractedFields.length > 0) {
		normalizedFields.push(...extractedFields);
	}
	if (normalizedFields.length > 0) embed.fields = normalizedFields;

	addEmbedMetadata(embed, params);
	addEmbedMedia(embed, params);

	return embed;
}

export async function sendDiscordMessage({ server, channel, message }: MessageData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);
	const sentMessage = await textChannel.send({
		content: message,
		allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
	});
	return `Sent to #${textChannel.name} in ${textChannel.guild.name}. ID: ${sentMessage.id}`;
}

export async function createEmbed({
	server,
	channel,
	title,
	description,
	color,
	fields,
	footer,
	image,
	thumbnail,
	author,
	timestamp,
	url,
}: {
	server?: string;
	channel: string;
	title?: string;
	description?: string;
	color?: string;
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	footer?: { text: string; iconUrl?: string };
	image?: string;
	thumbnail?: string;
	author?: { name: string; iconUrl?: string; url?: string };
	timestamp?: boolean;
	url?: string;
}): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	const embed = buildEmbed({
		title,
		description,
		color,
		fields,
		footer,
		image,
		thumbnail,
		author,
		timestamp,
		url,
	});

	if (Object.keys(embed).length === 0) {
		throw new Error('Embed payload is empty. Specify at least one field such as title or description.');
	}

	const sentMessage = await textChannel.send({ embeds: [embed] });
	return `Embed sent to #${textChannel.name} in ${textChannel.guild.name}. ID: ${sentMessage.id}`;
}

export async function readDiscordMessages({ server, channel, messageCount = 50 }: MessageHistory): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	const messages = await textChannel.messages.fetch({
		limit: Math.min(messageCount * 3, 100),
	});

	const messageArray = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

	const formattedMessages = messageArray.slice(0, messageCount).map((msg) => ({
		channel: `#${textChannel.name}`,
		server: textChannel.guild.name,
		author: msg.author.tag,
		content: msg.content,
		timestamp: msg.createdAt.toISOString(),
	}));

	return JSON.stringify(formattedMessages, null, 2);
}

export async function createCategory({ server, categoryName }: CategoryData): Promise<string> {
	const guild = await findServer(server);

	try {
		const existingCategory = guild.channels.cache.find(
			(channel) => channel.name.toLowerCase() === categoryName.toLowerCase() && channel.type === 4,
		);

		if (existingCategory) {
			return `Category "${existingCategory.name}" already exists in ${guild.name}. ID: ${existingCategory.id}`;
		}

		const category = await guild.channels.create({
			name: categoryName,
			type: 4,
		});

		return `Category "${category.name}" created in ${guild.name}. ID: ${category.id}`;
	} catch (error) {
		throw new Error(`Failed to create category: ${error}`);
	}
}

export async function deleteChannel({ server, channelName, channelType }: DeleteChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;
		else if (channelType === 'category') channelTypeNum = 4;

		const channel = guild.channels.cache.find(
			(channel) =>
				channel.name.toLowerCase() === channelName.toLowerCase() &&
				(channelTypeNum === undefined || channel.type === channelTypeNum),
		);

		if (!channel) {
			return `Channel "${channelName}" not found in ${guild.name}.`;
		}

		const displayType = getChannelTypeDisplayName(channel.type);
		const capitalizedType = displayType.charAt(0).toUpperCase() + displayType.slice(1);

		await channel.delete();
		return `${capitalizedType} "${channel.name}" deleted from ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to delete channel: ${error}`);
	}
}

export async function deleteAllChannels({
	server,
	excludeCategories = [],
	excludeChannels = [],
}: DeleteAllChannelsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channels = guild.channels.cache;
		const results: string[] = [];
		let deletedCount = 0;

		const excludeCategoriesLower = excludeCategories.map((cat: string) => cat.toLowerCase());
		const excludeChannelsLower = excludeChannels.map((ch: string) => ch.toLowerCase());

		for (const [, channel] of channels) {
			if (excludeChannelsLower.includes(channel.name.toLowerCase())) {
				results.push(`Skipped channel "${channel.name}" (excluded)`);
				continue;
			}

			if (channel.parent && excludeCategoriesLower.includes(channel.parent.name.toLowerCase())) {
				results.push(`Skipped channel "${channel.name}" (category excluded)`);
				continue;
			}

			if (channel.type === 5 || channel.type === 13) {
				results.push(`Skipped thread "${channel.name}" (system channel)`);
				continue;
			}

			try {
				await channel.delete();
				const channelTypeName = getChannelTypeDisplayName(channel.type);
				results.push(`Deleted ${channelTypeName} channel "${channel.name}"`);
				deletedCount++;
			} catch (error) {
				results.push(`Failed to delete "${channel.name}": ${error}`);
			}
		}

		const summary = `Deleted ${deletedCount} channels from ${guild.name}.`;
		return summary + (results.length > 0 ? '\n\nDetails:\n' + results.join('\n') : '');
	} catch (error) {
		throw new Error(`Failed to delete all channels: ${error}`);
	}
}

export async function createVoiceChannel({
	server,
	channelName,
	category,
	userLimit,
}: VoiceChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		let parent;
		if (category) {
			parent = guild.channels.cache.find(
				(channel) => channel.name.toLowerCase() === category.toLowerCase() && channel.type === 4,
			);
			if (!parent) {
				parent = await guild.channels.create({
					name: category,
					type: 4,
				});
			}
		}

		const existingChannel = guild.channels.cache.find(
			(channel) => channel.name.toLowerCase() === channelName.toLowerCase() && channel.type === 2,
		);

		if (existingChannel) {
			return `Voice channel "${existingChannel.name}" already exists in ${guild.name}. ID: ${existingChannel.id}`;
		}

		const voiceChannel = await guild.channels.create({
			name: channelName,
			type: 2,
			parent: parent?.id,
			userLimit: userLimit || 0,
		});

		const categoryInfo = parent ? ` under category "${parent.name}"` : '';
		return `Voice channel "${voiceChannel.name}" created in ${guild.name}${categoryInfo}. ID: ${voiceChannel.id}`;
	} catch (error) {
		throw new Error(`Failed to create voice channel: ${error}`);
	}
}

function findOrCreateCategory(guild: Guild, categoryName: string) {
	const existingCategory = guild.channels.cache.find(
		(channel) => channel.name.toLowerCase() === categoryName.toLowerCase() && channel.type === 4,
	);

	if (existingCategory) {
		return existingCategory;
	}

	return guild.channels.create({
		name: categoryName,
		type: 4,
	});
}

function checkExistingTextChannel(guild: Guild, channelName: string) {
	return guild.channels.cache.find(
		(channel) => channel.name.toLowerCase() === channelName.toLowerCase() && channel.type === 0,
	);
}

function formatChannelCreatedMessage(textChannel: any, guild: Guild, parent?: any) {
	const parentMessage = parent ? ` under category "${parent.name}"` : '';
	return `Text channel "${textChannel.name}" created in ${guild.name}${parentMessage}. ID: ${textChannel.id}`;
}

export async function createTextChannel({ server, channelName, category, topic }: TextChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		let parent;
		if (category) {
			parent = await findOrCreateCategory(guild, category);
		}

		const existingChannel = checkExistingTextChannel(guild, channelName);
		if (existingChannel) {
			return `Text channel "${existingChannel.name}" already exists in ${guild.name}. ID: ${existingChannel.id}`;
		}

		const textChannel = await guild.channels.create({
			name: channelName,
			type: 0,
			parent: parent?.id,
			topic: topic,
		});

		return formatChannelCreatedMessage(textChannel, guild, parent);
	} catch (error) {
		throw new Error(`Failed to create text channel: ${error}`);
	}
}

export async function clearDiscordMessages({
	server,
	channel,
	messageCount = 100,
}: ClearMessagesData): Promise<string> {
	if (!channel) {
		throw new Error('Channel is required for clearing messages');
	}

	const textChannel = await findTextChannel(channel, server);

	try {
		const messages = await textChannel.messages.fetch({
			limit: Math.min(messageCount, DISCORD_LIMITS.MESSAGE_FETCH_LIMIT),
		});

		const twoWeeksAgo = Date.now() - BULK_DELETE_MAX_AGE_MS;
		const thirtySecondsAgo = Date.now() - BULK_DELETE_MIN_AGE_MS;
		const deletableMessages = messages.filter(
			(msg) => msg.createdTimestamp > twoWeeksAgo && msg.createdTimestamp < thirtySecondsAgo,
		);

		if (deletableMessages.size === 0) {
			const tooOld = messages.filter((msg) => msg.createdTimestamp <= twoWeeksAgo).size;
			const tooNew = messages.filter((msg) => msg.createdTimestamp >= thirtySecondsAgo).size;

			let reason = '';
			if (tooOld > 0 && tooNew > 0) {
				reason = `${tooOld} messages are older than 2 weeks and ${tooNew} are newer than 30 seconds`;
			} else if (tooOld > 0) {
				reason = `all ${tooOld} messages are older than 2 weeks`;
			} else if (tooNew > 0) {
				reason = `all ${tooNew} messages are newer than 30 seconds`;
			} else {
				reason = 'no messages found';
			}

			return `Cannot bulk delete messages in #${textChannel.name} because ${reason}. Discord's bulk delete only works on messages between 30 seconds and 2 weeks old. Wait a moment for recent messages to age, or try again later for older messages.`;
		}

		const deletedCount = await textChannel.bulkDelete(deletableMessages, true);

		return `Successfully cleared ${deletedCount.size} messages from #${textChannel.name} in ${textChannel.guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to clear messages: ${error}`);
	}
}

export async function purgeChannel({ server, channel }: PurgeChannelData): Promise<string> {
	if (!channel) {
		throw new Error('Channel is required for purging');
	}

	const textChannel = await findTextChannel(channel, server);
	const guild = textChannel.guild;

	try {
		const channelName = textChannel.name;
		const channelTopic = textChannel.topic;
		const channelPosition = textChannel.position;
		const channelParent = textChannel.parent;
		const channelNsfw = textChannel.nsfw;
		const channelRateLimitPerUser = textChannel.rateLimitPerUser;
		const channelPermissionOverwrites = textChannel.permissionOverwrites.cache.map((overwrite) => ({
			id: overwrite.id,
			type: overwrite.type,
			allow: overwrite.allow.bitfield,
			deny: overwrite.deny.bitfield,
		}));

		const newChannel = await guild.channels.create({
			name: channelName,
			type: 0,
			topic: channelTopic || undefined,
			parent: channelParent?.id,
			position: channelPosition,
			nsfw: channelNsfw,
			rateLimitPerUser: channelRateLimitPerUser,
			permissionOverwrites: channelPermissionOverwrites,
		});

		await textChannel.delete();

		const parentInfo = channelParent ? ` in category "${channelParent.name}"` : '';
		return `I've permanently deleted all messages in #${channelName}${parentInfo}. The message history is now gone. NEW_CHANNEL_ID:${newChannel.id}`;
	} catch (error) {
		throw new Error(`Failed to purge channel: ${error}`);
	}
}

function getChannelIcon(channelType: number): string {
	switch (channelType) {
		case CHANNEL_TYPES.TEXT:
			return '💬';
		case CHANNEL_TYPES.VOICE:
			return '🔊';
		default:
			return '📄';
	}
}

function getChannelTypeNumber(channelType?: string): number | undefined {
	switch (channelType) {
		case 'text':
			return CHANNEL_TYPES.TEXT;
		case 'voice':
			return CHANNEL_TYPES.VOICE;
		case 'category':
			return CHANNEL_TYPES.CATEGORY;
		default:
			return undefined;
	}
}

function getChannelTypeText(channelType: number): string {
	switch (channelType) {
		case 0:
			return ' (chat)';
		case 2:
			return ' (vc)';
		default:
			return '';
	}
}

function getChannelPosition(channel: any): number {
	return 'position' in channel ? channel.position || 0 : 0;
}

function sortChannelsByPosition(channels: any[]): any[] {
	return channels.sort((a, b) => getChannelPosition(a) - getChannelPosition(b));
}

function formatChannelLine(channel: any, indent = ''): string {
	const icon = getChannelIcon(channel.type);
	const typeText = getChannelTypeText(channel.type);
	const position = getChannelPosition(channel);
	return `${indent}${icon} ${channel.name}${typeText} (pos: ${position})\n`;
}

function formatCategoryChannels(channels: any[]): string {
	if (channels.length === 0) {
		return '  ↳ (empty category)\n';
	}

	return channels.map((channel) => formatChannelLine(channel, '  ↳ ')).join('');
}

function listCategoryChannels(guild: any, categoryChannel: any): string {
	const categoryChannels = guild.channels.cache.filter((channel: any) => channel.parentId === categoryChannel.id);

	const sortedChannels = sortChannelsByPosition(Array.from(categoryChannels.values()));

	let result = `**${categoryChannel.name}**\n`;

	if (sortedChannels.length === 0) {
		result += '(No channels in this category)';
	} else {
		for (const channel of sortedChannels) {
			const icon = getChannelIcon(channel.type);
			const typeText = channel.type === 2 ? ' (vc)' : ' (chat)';
			result += `↳ ${icon} ${channel.name}${typeText}\n`;
		}
	}

	return result;
}

function listAllChannels(guild: any): string {
	const allChannels = Array.from(guild.channels.cache.values());
	const categories = sortChannelsByPosition(allChannels.filter((c: any) => c.type === 4));
	const uncategorizedChannels = sortChannelsByPosition(allChannels.filter((c: any) => c.type !== 4 && !c.parentId));

	let result = `**Channel Structure for ${guild.name}:**\n\n`;

	if (uncategorizedChannels.length > 0) {
		result += `**🏠 Uncategorized Channels:**\n`;
		result += uncategorizedChannels.map((channel) => formatChannelLine(channel)).join('');
		result += '\n';
	}

	for (const category of categories) {
		const categoryPosition = getChannelPosition(category);
		result += `**📁 ${category.name}** (pos: ${categoryPosition})\n`;

		const categoryChannels = sortChannelsByPosition(
			allChannels.filter((channel: any) => channel.parentId === category.id),
		);

		result += formatCategoryChannels(categoryChannels);
		result += '\n';
	}

	return result.trim();
}

export async function listChannels({ server, category }: ListChannelsData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		if (category) {
			const categoryChannel = guild.channels.cache.find(
				(channel: any) => channel.name.toLowerCase().includes(category.toLowerCase()) && channel.type === 4,
			);

			if (!categoryChannel) {
				return `Category "${category}" not found in ${guild.name}.`;
			}

			return listCategoryChannels(guild, categoryChannel);
		}

		return listAllChannels(guild);
	} catch (error) {
		throw new Error(`Failed to list channels: ${error}`);
	}
}

export async function moveChannel({ server, channelName, newCategory, channelType }: MoveChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;

		const channel = findChannelByName(guild, channelName, channelTypeNum);

		if (!channel) {
			const availableChannels = guild.channels.cache
				.filter((ch) => channelTypeNum === undefined || ch.type === channelTypeNum)
				.map((ch) => ch.name)
				.join(', ');
			return `Channel "${channelName}" not found in ${guild.name}. Available channels: ${availableChannels}`;
		}

		const targetCategory = findChannelByName(guild, newCategory, 4);

		if (!targetCategory) {
			const availableCategories = guild.channels.cache
				.filter((ch) => ch.type === 4)
				.map((ch) => ch.name)
				.join(', ');
			return `Category "${newCategory}" not found in ${guild.name}. Available categories: ${availableCategories}`;
		}

		await channel.edit({ parent: targetCategory.id });
		return `Channel "${channel.name}" moved to category "${targetCategory.name}" in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to move channel: ${error}`);
	}
}

export async function reorderChannel({
	server,
	channelName,
	position,
	channelType,
}: ReorderChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		const channelTypeNum = getChannelTypeNumber(channelType);
		const channel = findChannelByName(guild, channelName, channelTypeNum);

		if (!channel) {
			const availableChannels = guild.channels.cache
				.filter((ch) => channelTypeNum === undefined || ch.type === channelTypeNum)
				.map((ch) => ch.name)
				.join(', ');
			return `Channel "${channelName}" not found in ${guild.name}. Available channels: ${availableChannels}`;
		}

		if (!('position' in channel) || !('setPosition' in channel)) {
			return `Cannot reorder this type of channel: "${channelName}". Only text channels, voice channels, and categories can be reordered.`;
		}

		const oldPosition = channel.position;
		await channel.setPosition(position);

		const channelTypeDisplay = getChannelTypeDisplayName(channel.type);
		const capitalizedType = channelTypeDisplay.charAt(0).toUpperCase() + channelTypeDisplay.slice(1);

		return `${capitalizedType} "${channel.name}" moved from position ${oldPosition} to position ${position} in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to reorder channel: ${error}`);
	}
}

async function processChannelReorder(guild: any, channelInfo: any, errors: string[], results: string[]): Promise<void> {
	const channelTypeNum = getChannelTypeNumber(channelInfo.type);
	const channel = findChannelByName(guild, channelInfo.name, channelTypeNum);

	if (!channel) {
		errors.push(`Channel "${channelInfo.name}" not found`);
		return;
	}

	try {
		if (!('position' in channel) || !('setPosition' in channel)) {
			errors.push(
				`Cannot reorder channel "${channelInfo.name}": Only text channels, voice channels, and categories can be reordered`,
			);
			return;
		}

		const oldPosition = channel.position;
		await channel.setPosition(channelInfo.position);

		const channelTypeDisplay = getChannelTypeDisplayName(channel.type);
		const capitalizedType = channelTypeDisplay.charAt(0).toUpperCase() + channelTypeDisplay.slice(1);

		results.push(`${capitalizedType} "${channel.name}" moved from position ${oldPosition} to ${channelInfo.position}`);
	} catch (error) {
		errors.push(`Failed to move "${channelInfo.name}": ${error}`);
	}
}

export async function reorderChannels({ server, channels }: ReorderChannelsData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		const results: string[] = [];
		const errors: string[] = [];

		for (const channelInfo of channels) {
			await processChannelReorder(guild, channelInfo, errors, results);
		}

		let response = `Bulk channel reordering completed in ${guild.name}.\n\n`;

		if (results.length > 0) {
			response += `**Successfully reordered:**\n${results.join('\n')}\n\n`;
		}

		if (errors.length > 0) {
			response += `**Errors:**\n${errors.join('\n')}`;
		}

		return response.trim();
	} catch (error) {
		throw new Error(`Failed to bulk reorder channels: ${error}`);
	}
}

export async function renameChannel({ server, oldName, newName, channelType }: RenameChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;
		else if (channelType === 'category') channelTypeNum = 4;

		const channel = findChannelByName(guild, oldName, channelTypeNum);

		if (!channel) {
			const availableChannels = guild.channels.cache
				.filter((ch) => channelTypeNum === undefined || ch.type === channelTypeNum)
				.map((ch) => ch.name)
				.join(', ');
			return `Channel "${oldName}" not found in ${guild.name}. Available channels: ${availableChannels}`;
		}

		const oldChannelName = channel.name;
		await channel.setName(newName);
		return `Channel "${oldChannelName}" renamed to "${newName}" in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to rename channel: ${error}`);
	}
}

export async function setChannelTopic({
	server,
	channelName,
	topic,
	channelType = 'text',
}: SetChannelTopicData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;

		const channel = findChannelByName(guild, channelName, channelTypeNum);

		if (!channel) {
			const availableChannels = guild.channels.cache
				.filter((ch) => channelTypeNum === undefined || ch.type === channelTypeNum)
				.map((ch) => ch.name)
				.join(', ');
			return `Channel "${channelName}" not found in ${guild.name}. Available channels: ${availableChannels}`;
		}

		if (channel.type !== 0) {
			return `Cannot set topic for "${channelName}" - only text channels can have topics.`;
		}

		const textChannel = channel as TextChannel;
		await textChannel.setTopic(topic);
		return `Topic set for "${channelName}": "${topic}"`;
	} catch (error) {
		throw new Error(`Failed to set channel topic: ${error}`);
	}
}

export async function setAllChannelTopics({ server, channelTopics }: SetAllChannelTopicsData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		const textChannels = guild.channels.cache.filter((ch) => ch.type === 0);
		const results: string[] = [];
		const errors: string[] = [];

		for (const [channelName, topic] of Object.entries(channelTopics)) {
			try {
				const channel = textChannels.find(
					(ch) =>
						ch.name.toLowerCase() === channelName.toLowerCase() ||
						ch.name
							.toLowerCase()
							.replace(/[^\w\s-]/g, '')
							.trim() ===
							channelName
								.toLowerCase()
								.replace(/[^\w\s-]/g, '')
								.trim(),
				);

				if (!channel) {
					errors.push(`Channel "${channelName}" not found`);
					continue;
				}

				const textChannel = channel as TextChannel;
				await textChannel.setTopic(topic);
				results.push(`✅ ${channelName}: "${topic}"`);
			} catch (error) {
				errors.push(`❌ ${channelName}: ${error}`);
			}
		}

		let response = `**Channel Topics Set:**\n${results.join('\n')}`;
		if (errors.length > 0) {
			response += `\n\n**Errors:**\n${errors.join('\n')}`;
		}

		return response;
	} catch (error) {
		throw new Error(`Failed to set channel topics: ${error}`);
	}
}

export async function bulkCreateChannels({
	server,
	category,
	textChannels = [],
	voiceChannels = [],
}: BulkCreateChannelsData): Promise<string> {
	const guild = await findServer(server);

	try {
		let targetCategory = guild.channels.cache.find(
			(channel) => channel.name.toLowerCase() === category.toLowerCase() && channel.type === 4,
		);

		if (!targetCategory) {
			targetCategory = await guild.channels.create({
				name: category,
				type: 4,
			});
		}

		const results: string[] = [];
		let createdCount = 0;

		for (const channelName of textChannels) {
			const existingChannel = guild.channels.cache.find(
				(c) => c.name.toLowerCase() === channelName.toLowerCase() && c.type === 0,
			);

			if (existingChannel) {
				results.push(`Text channel "${channelName}" already exists`);
			} else {
				await guild.channels.create({
					name: channelName,
					type: 0,
					parent: targetCategory.id,
				});
				results.push(`Created text channel "${channelName}"`);
				createdCount++;
			}
		}

		for (const channelName of voiceChannels) {
			const existingChannel = guild.channels.cache.find(
				(c) => c.name.toLowerCase() === channelName.toLowerCase() && c.type === 2,
			);

			if (existingChannel) {
				results.push(`Voice channel "${channelName}" already exists`);
			} else {
				await guild.channels.create({
					name: channelName,
					type: 2,
					parent: targetCategory.id,
				});
				results.push(`Created voice channel "${channelName}"`);
				createdCount++;
			}
		}

		const summary = `Bulk creation completed in ${guild.name} under category "${targetCategory.name}":\n${results.join('\n')}\n\nTotal: ${createdCount} channels created, ${results.length - createdCount} already existed.`;

		return summary;
	} catch (error) {
		throw new Error(`Failed to bulk create channels: ${error}`);
	}
}

function convertPermissionNameToBit(permissionName: string): bigint | null {
	const permissionMap: Record<string, bigint> = {
		ViewChannel: PermissionFlagsBits.ViewChannel,
		SendMessages: PermissionFlagsBits.SendMessages,
		ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
		AddReactions: PermissionFlagsBits.AddReactions,
		AttachFiles: PermissionFlagsBits.AttachFiles,
		EmbedLinks: PermissionFlagsBits.EmbedLinks,
		UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
		UseExternalStickers: PermissionFlagsBits.UseExternalStickers,
		MentionEveryone: PermissionFlagsBits.MentionEveryone,
		ManageMessages: PermissionFlagsBits.ManageMessages,
		ManageThreads: PermissionFlagsBits.ManageThreads,
		CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
		CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
		SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
		SendTTSMessages: PermissionFlagsBits.SendTTSMessages,
		Connect: PermissionFlagsBits.Connect,
		Speak: PermissionFlagsBits.Speak,
		Stream: PermissionFlagsBits.Stream,
		UseVAD: PermissionFlagsBits.UseVAD,
		MuteMembers: PermissionFlagsBits.MuteMembers,
		DeafenMembers: PermissionFlagsBits.DeafenMembers,
		MoveMembers: PermissionFlagsBits.MoveMembers,
		ManageChannels: PermissionFlagsBits.ManageChannels,
		ManageRoles: PermissionFlagsBits.ManageRoles,
		ManageWebhooks: PermissionFlagsBits.ManageWebhooks,
		UseApplicationCommands: PermissionFlagsBits.UseApplicationCommands,
		PrioritySpeaker: PermissionFlagsBits.PrioritySpeaker,
		SendVoiceMessages: PermissionFlagsBits.SendVoiceMessages,
	};

	const normalizedName = permissionName.replace(/[_\s-]/g, '').toLowerCase();

	for (const [key, value] of Object.entries(permissionMap)) {
		if (key.toLowerCase() === normalizedName) {
			return value;
		}
	}

	return null;
}

function parsePermissions(permissions: string[]): bigint[] {
	const validPermissions: bigint[] = [];

	for (const perm of permissions) {
		const bit = convertPermissionNameToBit(perm);
		if (bit !== null) {
			validPermissions.push(bit);
		}
	}

	return validPermissions;
}

function buildPermissionOverwrites(allowBits: bigint[], denyBits: bigint[]): { [key: string]: boolean | null } {
	const permissionOverwrites: { [key: string]: boolean | null } = {};

	for (const bit of allowBits) {
		const permName = Object.keys(PermissionFlagsBits).find(
			(key) => PermissionFlagsBits[key as keyof typeof PermissionFlagsBits] === bit,
		);
		if (permName) {
			permissionOverwrites[permName] = true;
		}
	}

	for (const bit of denyBits) {
		const permName = Object.keys(PermissionFlagsBits).find(
			(key) => PermissionFlagsBits[key as keyof typeof PermissionFlagsBits] === bit,
		);
		if (permName) {
			permissionOverwrites[permName] = false;
		}
	}

	return permissionOverwrites;
}

function formatPermissionChanges(allow: string[], deny: string[]): string {
	const allowMessage = allow.length > 0 ? `Allowed: ${allow.join(', ')}\n` : '';
	const denyMessage = deny.length > 0 ? `Denied: ${deny.join(', ')}` : '';
	return (allowMessage + denyMessage).trim();
}

export async function setChannelPermissions({
	server,
	channelName,
	roleName,
	allow = [],
	deny = [],
	channelType,
}: SetChannelPermissionsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channelTypeNum = getChannelTypeNumber(channelType);

		const channel = guild.channels.cache.find(
			(channel) =>
				channel.name.toLowerCase() === channelName.toLowerCase() &&
				(channelTypeNum === undefined || channel.type === channelTypeNum),
		);

		if (!channel) {
			return `Channel "${channelName}" not found in ${guild.name}.`;
		}

		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());

		if (!role) {
			return `Role "${roleName}" not found in ${guild.name}.`;
		}

		const allowBits = parsePermissions(allow);
		const denyBits = parsePermissions(deny);

		if (allowBits.length === 0 && denyBits.length === 0) {
			return `No valid permissions specified for channel "${channel.name}" and role "${role.name}".`;
		}

		if (!('permissionOverwrites' in channel)) {
			return `Channel "${channel.name}" does not support permission overwrites.`;
		}

		const permissionOverwrites = buildPermissionOverwrites(allowBits, denyBits);

		await channel.permissionOverwrites.edit(role, permissionOverwrites);

		const changesMessage = formatPermissionChanges(allow, deny);

		return `Successfully updated permissions for role "${role.name}" in channel "${channel.name}".\n${changesMessage}`;
	} catch (error) {
		throw new Error(`Failed to set channel permissions: ${error}`);
	}
}

export async function manageReaction({ server, channel, messageId, emoji, action }: ReactionData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const message = await textChannel.messages.fetch(messageId);

		if (!message) {
			return `Message with ID ${messageId} not found in #${textChannel.name}.`;
		}

		if (action === 'add') {
			await message.react(emoji);
			return `Added reaction ${emoji} to message in #${textChannel.name}.`;
		} else if (action === 'remove') {
			const reaction = message.reactions.cache.find((r) => r.emoji.name === emoji);
			if (reaction) {
				await reaction.remove();
				return `Removed reaction ${emoji} from message in #${textChannel.name}.`;
			} else {
				return `Reaction ${emoji} not found on message in #${textChannel.name}.`;
			}
		}

		return `Invalid action specified. Use 'add' or 'remove'.`;
	} catch (error) {
		throw new Error(`Failed to manage reaction: ${error}`);
	}
}

export async function managePin({ server, channel, messageId, action }: PinData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const message = await textChannel.messages.fetch(messageId);

		if (!message) {
			return `Message with ID ${messageId} not found in #${textChannel.name}.`;
		}

		if (action === 'pin') {
			await message.pin();
			return `Pinned message in #${textChannel.name}.`;
		} else if (action === 'unpin') {
			await message.unpin();
			return `Unpinned message in #${textChannel.name}.`;
		}

		return `Invalid action specified. Use 'pin' or 'unpin'.`;
	} catch (error) {
		throw new Error(`Failed to manage pin: ${error}`);
	}
}

export async function createPoll({ server, channel, question, options, duration }: PollData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		if (options.length < DISCORD_LIMITS.POLL_MIN_OPTIONS || options.length > DISCORD_LIMITS.POLL_MAX_OPTIONS) {
			return `Poll must have between ${DISCORD_LIMITS.POLL_MIN_OPTIONS} and ${DISCORD_LIMITS.POLL_MAX_OPTIONS} options.`;
		}

		let pollMessage = `**${question}**\n\n`;

		options.forEach((option, index) => {
			pollMessage += `${POLL_EMOJIS[index]} ${option}\n`;
		});

		if (duration) {
			pollMessage += `\n⏰ Poll ends in ${duration} minutes`;
		}

		const sentMessage = await textChannel.send({
			content: pollMessage,
			allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
		});

		for (let i = 0; i < options.length; i++) {
			await sentMessage.react(POLL_EMOJIS[i]);
		}

		let result = `Poll created in #${textChannel.name}!\nMessage ID: ${sentMessage.id}`;

		if (duration) {
			result += `\n\nNote: Poll will automatically end in ${duration} minutes. You'll need to implement a scheduler to handle this.`;
		}

		return result;
	} catch (error) {
		throw new Error(`Failed to create poll: ${error}`);
	}
}

export async function setSlowmode({ server, channel, seconds }: SetSlowmodeData): Promise<string> {
	const guild = await findServer(server);

	try {
		const targetChannel = await findChannelByName(guild, channel, CHANNEL_TYPES.TEXT);
		if (!targetChannel || !('setRateLimitPerUser' in targetChannel)) {
			return `Channel "${channel}" not found or does not support slowmode in ${guild.name}.`;
		}

		if (seconds < DISCORD_LIMITS.SLOWMODE_MIN_SECONDS || seconds > DISCORD_LIMITS.SLOWMODE_MAX_SECONDS) {
			return `Slowmode delay must be between ${DISCORD_LIMITS.SLOWMODE_MIN_SECONDS} and ${DISCORD_LIMITS.SLOWMODE_MAX_SECONDS} seconds (6 hours).`;
		}

		await targetChannel.setRateLimitPerUser(seconds);

		if (seconds === 0) {
			return `Slowmode disabled for ${channel}.`;
		}
		return `Slowmode set to ${seconds} seconds for ${channel}.`;
	} catch (error) {
		throw new Error(`Failed to set slowmode: ${error}`);
	}
}

export async function setNSFW({ server, channel, enabled }: SetNSFWData): Promise<string> {
	const guild = await findServer(server);

	try {
		const targetChannel = await findChannelByName(guild, channel, 0);
		if (!targetChannel || !('setNSFW' in targetChannel)) {
			return `Channel "${channel}" not found or does not support NSFW settings in ${guild.name}.`;
		}

		await targetChannel.setNSFW(enabled);
		return `Channel ${channel} ${enabled ? 'marked as NSFW' : 'NSFW flag removed'}.`;
	} catch (error) {
		throw new Error(`Failed to set NSFW: ${error}`);
	}
}

export async function createForumChannel({
	server,
	channelName,
	category,
	topic,
	tags = [],
}: CreateForumChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		const existingChannel = guild.channels.cache.find(
			(ch) => ch.name.toLowerCase() === channelName.toLowerCase() && ch.type === 15,
		);

		if (existingChannel) {
			return `Forum channel "${channelName}" already exists in ${guild.name}.`;
		}

		let parentCategory = null;
		if (category) {
			parentCategory = guild.channels.cache.find(
				(ch) => ch.name.toLowerCase() === category.toLowerCase() && ch.type === 4,
			);
		}

		const channelOptions: any = {
			name: channelName,
			type: 15,
			topic: topic || undefined,
			parent: parentCategory?.id,
		};

		if (tags.length > 0) {
			channelOptions.availableTags = tags.map((tag) => ({
				name: tag,
				id: null,
				moderated: false,
			}));
		}

		const forumChannel = await guild.channels.create(channelOptions);
		return `Forum channel "${forumChannel.name}" created successfully in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to create forum channel: ${error}`);
	}
}

export async function createForumPost({
	server,
	channel,
	title,
	message,
	tags = [],
}: CreateForumPostData): Promise<string> {
	const guild = await findServer(server);

	try {
		const forumChannel = guild.channels.cache.find(
			(ch) => ch.name.toLowerCase() === channel.toLowerCase() && ch.type === 15,
		);

		if (!forumChannel || !('threads' in forumChannel)) {
			return `Forum channel "${channel}" not found in ${guild.name}.`;
		}

		const threadOptions: any = {
			name: title,
			message: { content: message },
		};

		if (tags.length > 0 && 'availableTags' in forumChannel) {
			const availableTags: any = forumChannel.availableTags;
			const tagIds = availableTags
				.filter((t: any) => tags.includes(t.name))
				.map((t: any) => t.id)
				.filter((id: any) => id !== null);

			if (tagIds.length > 0) {
				threadOptions.appliedTags = tagIds;
			}
		}

		await forumChannel.threads.create(threadOptions);
		return `Forum post "${title}" created successfully in ${channel}.`;
	} catch (error) {
		throw new Error(`Failed to create forum post: ${error}`);
	}
}

export async function createThread({ server, channel, name, messageId }: CreateThreadData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		let startMessage;
		if (messageId) {
			startMessage = await textChannel.messages.fetch(messageId);
		}

		const thread = await textChannel.threads.create({
			name,
			startMessage: startMessage?.id,
		});

		return `Thread "${thread.name}" created with ID: ${thread.id}`;
	} catch (error) {
		throw new Error(`Failed to create thread: ${error}`);
	}
}

export async function archiveThread({ server, channel, threadId }: ArchiveThreadData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const thread = await textChannel.threads.fetch(threadId);
		if (!thread) {
			return `Thread "${threadId}" not found`;
		}
		await thread.setArchived(true);
		return `Thread "${thread.name}" archived`;
	} catch (error) {
		throw new Error(`Failed to archive thread: ${error}`);
	}
}

export async function createWebhook({ server, channel, name }: CreateWebhookData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const webhook = await textChannel.createWebhook({ name });
		return `Webhook "${webhook.name}" created with URL: ${webhook.url}`;
	} catch (error) {
		throw new Error(`Failed to create webhook: ${error}`);
	}
}

export async function listWebhooks({ server }: ListWebhooksData): Promise<string> {
	const guild = await findServer(server);

	try {
		const webhooks = await guild.fetchWebhooks();
		const webhookList = webhooks.map((webhook) => ({
			name: webhook.name,
			id: webhook.id,
			url: webhook.url,
			channel: webhook.channel?.name || 'Unknown',
		}));

		return JSON.stringify(webhookList, null, 2);
	} catch (error) {
		throw new Error(`Failed to list webhooks: ${error}`);
	}
}

export async function deleteWebhook({ server, webhookId }: DeleteWebhookData): Promise<string> {
	const guild = await findServer(server);

	try {
		const webhooks = await guild.fetchWebhooks();
		const webhook = webhooks.get(webhookId);
		if (!webhook) {
			return `Webhook "${webhookId}" not found`;
		}

		await webhook.delete();
		return `Webhook "${webhook.name}" deleted`;
	} catch (error) {
		throw new Error(`Failed to delete webhook: ${error}`);
	}
}

export async function getBotInfo({ server }: { server?: string }): Promise<string> {
	const guild = await findServer(server);

	try {
		const botMember = guild.members.cache.get(discordClient.user!.id);
		if (!botMember) {
			return `Bot not found in ${guild.name}`;
		}

		const botInfo = {
			id: discordClient.user!.id,
			username: discordClient.user!.username,
			displayName: botMember.displayName,
			tag: discordClient.user!.tag,
			joinedAt: botMember.joinedAt?.toISOString(),
			roles: botMember.roles.cache
				.filter((role) => role.name !== '@everyone')
				.map((role) => ({
					name: role.name,
					id: role.id,
					color: role.hexColor,
				})),
		};

		return JSON.stringify(botInfo, null, 2);
	} catch (error) {
		throw new Error(`Failed to get bot info: ${error}`);
	}
}

export async function editMessage({ server, channel, messageId, newContent }: EditMessageData): Promise<string> {
	const guild = await findServer(server);

	try {
		const validation = validateMessageContent(newContent);
		if (!validation.valid) {
			return `Invalid message content: ${validation.error}`;
		}

		const targetChannel = await findChannelByName(guild, channel, CHANNEL_TYPES.TEXT);
		if (!targetChannel || !('messages' in targetChannel)) {
			return `Channel "${channel}" not found or is not a text channel in ${guild.name}.`;
		}

		const message = await targetChannel.messages.fetch(messageId);
		if (!message) {
			return `Message ${messageId} not found in ${channel}.`;
		}

		if (message.author.id !== discordClient.user!.id) {
			return `Cannot edit message ${messageId} - bot can only edit its own messages.`;
		}

		await message.edit(newContent);
		return `Message ${messageId} edited successfully in ${channel}.`;
	} catch (error) {
		throw new Error(`Failed to edit message: ${error}`);
	}
}

export async function deleteMessage({ server, channel, messageId }: DeleteMessageData): Promise<string> {
	const guild = await findServer(server);

	try {
		const targetChannel = await findChannelByName(guild, channel, 0);
		if (!targetChannel || !('messages' in targetChannel)) {
			return `Channel "${channel}" not found or is not a text channel in ${guild.name}.`;
		}

		const message = await targetChannel.messages.fetch(messageId);
		if (!message) {
			return `Message ${messageId} not found in ${channel}.`;
		}

		await message.delete();
		return `Message ${messageId} deleted successfully from ${channel}.`;
	} catch (error) {
		throw new Error(`Failed to delete message: ${error}`);
	}
}

export async function setupLogging({ server, logChannel, eventType, enabled }: LogEventData): Promise<string> {
	const guild = await findServer(server);

	try {
		const targetChannel = await findChannelByName(guild, logChannel, 0);
		if (!targetChannel) {
			return `Log channel "${logChannel}" not found in ${guild.name}.`;
		}

		const key = `${guild.id}_${eventType}`;

		if (enabled) {
			loggingConfig.set(key, {
				guildId: guild.id,
				channelId: targetChannel.id,
				eventType,
			});
			return `Logging enabled for ${eventType} events to ${logChannel} in ${guild.name}.`;
		} else {
			loggingConfig.delete(key);
			return `Logging disabled for ${eventType} events in ${guild.name}.`;
		}
	} catch (error) {
		throw new Error(`Failed to setup logging: ${error}`);
	}
}

export function getLoggingConfig(guildId: string, eventType: string): any {
	return loggingConfig.get(`${guildId}_${eventType}`);
}

export async function findSuitableChannel(guildId: string): Promise<TextChannel | null> {
	try {
		const guild = await discordClient.guilds.fetch(guildId);
		if (!guild) return null;

		if (guild.systemChannel && guild.systemChannel.type === 0) {
			return guild.systemChannel as TextChannel;
		}

		const generalChannel = guild.channels.cache.find(
			(channel) => channel.type === 0 && channel.name.toLowerCase().includes('general'),
		) as TextChannel;
		if (generalChannel) return generalChannel;

		const mainChannel = guild.channels.cache.find(
			(channel) =>
				channel.type === 0 &&
				(channel.name.toLowerCase().includes('main') || channel.name.toLowerCase().includes('chat')),
		) as TextChannel;
		if (mainChannel) return mainChannel;

		const firstTextChannel = guild.channels.cache.find((channel) => {
			if (!guild.members.me) return false;
			return channel.type === 0 && channel.permissionsFor(guild.members.me)?.has('SendMessages');
		});
		if (firstTextChannel) return firstTextChannel as TextChannel;

		return null;
	} catch (error) {
		console.error('Error finding suitable channel:', error);
		return null;
	}
}
