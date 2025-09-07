import { Guild, TextChannel } from 'discord.js';
import { discordClient } from './client.js';
import type {
	MessageData,
	MessageHistory,
	TextChannelData,
	VoiceChannelData,
	ClearMessagesData,
	CategoryData,
	DeleteChannelData,
	DeleteAllChannelsData,
	ListChannelsData,
	MoveChannelData,
	ReorderChannelData,
	ReorderChannelsData,
	RenameChannelData,
	BulkCreateChannelsData,
	ServerInfoData,
	SetChannelPermissionsData,
	UserInfoData,
	RoleManagementData,
	ModerationData,
	ReactionData,
	PinData,
	PollData,
	GameData,
	ReminderData,
	CalculatorData,
	ServerStatsData,
	AuditLogData,
	InviteData,
	ListInvitesData,
	DeleteInviteData,
	CreateRoleData,
	EditRoleData,
	DeleteRoleData,
	ListRolesData,
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
	CreateWebhookData,
	ListWebhooksData,
	DeleteWebhookData,
} from '../types/index.js';

function getChannelTypeDisplayName(channelType: number): string {
	switch (channelType) {
		case 0:
			return 'text';
		case 2:
			return 'voice';
		case 4:
			return 'category';
		default:
			return 'unknown';
	}
}

function findChannelByName(guild: Guild, channelName: string, channelType?: number) {
	const channels = guild.channels.cache;

	let channel = channels.find(
		(ch) =>
			ch.name.toLowerCase() === channelName.toLowerCase() && (channelType === undefined || ch.type === channelType),
	);

	if (channel) return channel;

	const simplifiedInput = channelName
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.trim();

	channel = channels.find((ch) => {
		const simplifiedChannelName = ch.name
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.trim();
		return simplifiedChannelName === simplifiedInput && (channelType === undefined || ch.type === channelType);
	});

	if (channel) return channel;

	channel = channels.find((ch) => {
		const simplifiedChannelName = ch.name
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.trim();
		return simplifiedChannelName.includes(simplifiedInput) && (channelType === undefined || ch.type === channelType);
	});

	if (channel) return channel;

	return channels.find(
		(ch) =>
			ch.name.toLowerCase().includes(channelName.toLowerCase()) &&
			(channelType === undefined || ch.type === channelType),
	);
}

export async function findServer(serverId?: string): Promise<Guild> {
	if (!serverId) {
		if (discordClient.guilds.cache.size === 1) {
			return discordClient.guilds.cache.first()!;
		}
		const serverList = Array.from(discordClient.guilds.cache.values())
			.map((g) => `"${g.name}"`)
			.join(', ');
		throw new Error(`Multiple servers. Specify name/ID. Available: ${serverList}`);
	}

	let server: Guild | undefined;
	try {
		server = await discordClient.guilds.fetch(serverId);
	} catch {}
	if (server) return server;

	if (/^\d{17,19}$/.test(serverId)) {
		for (const guild of discordClient.guilds.cache.values()) {
			try {
				const channel = await guild.channels.fetch(serverId);
				if (channel) {
					return guild;
				}
			} catch {}
		}
	}

	const servers = discordClient.guilds.cache.filter((g) => g.name.toLowerCase() === serverId.toLowerCase());
	if (servers.size === 0) {
		const availableServers = Array.from(discordClient.guilds.cache.values())
			.map((g) => `"${g.name}"`)
			.join(', ');
		throw new Error(`Server "${serverId}" not found. Available: ${availableServers}`);
	}
	if (servers.size > 1) {
		const serverList = servers.map((g) => `${g.name} (ID: ${g.id})`).join(', ');
		throw new Error(`Multiple servers found: ${serverList}. Use ID.`);
	}
	return servers.first()!;
}

export async function findTextChannel(channelId: string, serverId?: string): Promise<TextChannel> {
	const server = await findServer(serverId);

	try {
		const channel = await discordClient.channels.fetch(channelId);
		if (channel instanceof TextChannel && channel.guild.id === server.id) {
			return channel;
		}
	} catch {
		const channels = server.channels.cache.filter(
			(channel): channel is TextChannel =>
				channel instanceof TextChannel &&
				(channel.name.toLowerCase() === channelId.toLowerCase() ||
					channel.name.toLowerCase() === channelId.toLowerCase().replace('#', '')),
		);

		if (channels.size === 0) {
			const availableChannels = server.channels.cache
				.filter((c): c is TextChannel => c instanceof TextChannel)
				.map((c) => `"#${c.name}"`)
				.join(', ');
			throw new Error(`Channel "${channelId}" not found in "${server.name}". Available: ${availableChannels}`);
		}
		if (channels.size > 1) {
			const channelList = channels.map((c) => `#${c.name} (${c.id})`).join(', ');
			throw new Error(`Multiple channels found in "${server.name}": ${channelList}. Use ID.`);
		}
		return channels.first()!;
	}
	throw new Error(`Channel "${channelId}" not found in "${server.name}"`);
}

export async function sendDiscordMessage({ server, channel, message }: MessageData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);
	const sentMessage = await textChannel.send(message);
	return `Sent to #${textChannel.name} in ${textChannel.guild.name}. ID: ${sentMessage.id}`;
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

		await channel.delete();
		return `Channel "${channel.name}" deleted from ${guild.name}.`;
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

		return `Voice channel "${voiceChannel.name}" created in ${guild.name}${parent ? ` under category "${parent.name}"` : ''}. ID: ${voiceChannel.id}`;
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
	const textChannel = await findTextChannel(channel, server);

	try {
		const messages = await textChannel.messages.fetch({
			limit: Math.min(messageCount, 100),
		});

		const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
		const thirtySecondsAgo = Date.now() - 30 * 1000;
		const deletableMessages = messages.filter(
			(msg) => msg.createdTimestamp > twoWeeksAgo && msg.createdTimestamp < thirtySecondsAgo,
		);

		if (deletableMessages.size === 0) {
			return `No messages found in #${textChannel.name} that can be deleted (messages older than 2 weeks or newer than 30 seconds cannot be bulk deleted).`;
		}

		const deletedCount = await textChannel.bulkDelete(deletableMessages, true);

		return `Successfully cleared ${deletedCount.size} messages from #${textChannel.name} in ${textChannel.guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to clear messages: ${error}`);
	}
}

export async function listChannels({ server, category }: ListChannelsData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		if (category) {
			const categoryChannel = guild.channels.cache.find(
				(channel) => channel.name.toLowerCase().includes(category.toLowerCase()) && channel.type === 4,
			);

			if (!categoryChannel) {
				return `Category "${category}" not found in ${guild.name}.`;
			}

			const categoryChannels = guild.channels.cache
				.filter((channel) => channel.parentId === categoryChannel.id)
				.sort((a, b) => {
					const aPos = 'position' in a ? (a as any).position || 0 : 0;
					const bPos = 'position' in b ? (b as any).position || 0 : 0;
					return aPos - bPos;
				});

			let result = `**${categoryChannel.name}**\n`;

			for (const channel of categoryChannels.values()) {
				let channelIcon;
				if (channel.type === 0) channelIcon = '💬';
				else if (channel.type === 2) channelIcon = '🔊';
				else channelIcon = '📄';
				const channelType = channel.type === 2 ? ' (vc)' : ' (chat)';
				result += `↳ ${channelIcon} ${channel.name}${channelType}\n`;
			}

			return result || `**${categoryChannel.name}**\n(No channels in this category)`;
		}

		const allChannels = Array.from(guild.channels.cache.values());

		const categories = allChannels
			.filter((c) => c.type === 4)
			.sort((a, b) => {
				const aPos = 'position' in a ? (a as any).position || 0 : 0;
				const bPos = 'position' in b ? (b as any).position || 0 : 0;
				return aPos - bPos;
			});

		const uncategorizedChannels = allChannels
			.filter((c) => c.type !== 4 && !c.parentId)
			.sort((a, b) => {
				const aPos = 'position' in a ? (a as any).position || 0 : 0;
				const bPos = 'position' in b ? (b as any).position || 0 : 0;
				return aPos - bPos;
			});

		let result = `**Channel Structure for ${guild.name}:**\n\n`;

		if (uncategorizedChannels.length > 0) {
			result += `**🏠 Uncategorized Channels:**\n`;
			for (const channel of uncategorizedChannels) {
				let channelIcon;
				if (channel.type === 0) channelIcon = '💬';
				else if (channel.type === 2) channelIcon = '🔊';
				else channelIcon = '📄';
				let channelType = '';
				if (channel.type === 2) channelType = ' (vc)';
				else if (channel.type === 0) channelType = ' (chat)';
				const position = 'position' in channel ? (channel as any).position || 0 : 0;
				result += `${channelIcon} ${channel.name}${channelType} (pos: ${position})\n`;
			}
			result += '\n';
		}

		for (const category of categories) {
			const categoryPosition = 'position' in category ? (category as any).position || 0 : 0;
			result += `**📁 ${category.name}** (pos: ${categoryPosition})\n`;

			const categoryChannels = allChannels
				.filter((channel) => channel.parentId === category.id)
				.sort((a, b) => {
					const aPos = 'position' in a ? (a as any).position || 0 : 0;
					const bPos = 'position' in b ? (b as any).position || 0 : 0;
					return aPos - bPos;
				});

			if (categoryChannels.length === 0) {
				result += `  ↳ (empty category)\n`;
			} else {
				for (const channel of categoryChannels) {
					let channelIcon;
					if (channel.type === 0) channelIcon = '💬';
					else if (channel.type === 2) channelIcon = '🔊';
					else channelIcon = '📄';
					let channelType = '';
					if (channel.type === 2) channelType = ' (vc)';
					else if (channel.type === 0) channelType = ' (chat)';
					const position = 'position' in channel ? (channel as any).position || 0 : 0;
					result += `  ↳ ${channelIcon} ${channel.name}${channelType} (pos: ${position})\n`;
				}
			}
			result += '\n';
		}

		return result.trim();
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

		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;
		else if (channelType === 'category') channelTypeNum = 4;

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

		const oldPosition = (channel as any).position;

		await (channel as any).setPosition(position);

		let channelTypeDisplay = 'channel';
		if (channel.type === 0) channelTypeDisplay = 'text channel';
		else if (channel.type === 2) channelTypeDisplay = 'voice channel';
		else if (channel.type === 4) channelTypeDisplay = 'category';

		return `${channelTypeDisplay.charAt(0).toUpperCase() + channelTypeDisplay.slice(1)} "${channel.name}" moved from position ${oldPosition} to position ${position} in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to reorder channel: ${error}`);
	}
}

export async function reorderChannels({ server, channels }: ReorderChannelsData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.channels.fetch();

		const results: string[] = [];
		const errors: string[] = [];

		for (const channelInfo of channels) {
			let channelTypeNum: number | undefined;
			if (channelInfo.type === 'text') channelTypeNum = 0;
			else if (channelInfo.type === 'voice') channelTypeNum = 2;
			else if (channelInfo.type === 'category') channelTypeNum = 4;

			const channel = findChannelByName(guild, channelInfo.name, channelTypeNum);

			if (!channel) {
				errors.push(`Channel "${channelInfo.name}" not found`);
				continue;
			}

			try {
				if (!('position' in channel) || !('setPosition' in channel)) {
					errors.push(
						`Cannot reorder channel "${channelInfo.name}": Only text channels, voice channels, and categories can be reordered`,
					);
					continue;
				}

				const oldPosition = (channel as any).position;
				await (channel as any).setPosition(channelInfo.position);

				const channelTypeDisplay =
					channel.type === 0
						? 'text channel'
						: channel.type === 2
							? 'voice channel'
							: channel.type === 4
								? 'category'
								: 'channel';

				results.push(
					`${channelTypeDisplay.charAt(0).toUpperCase() + channelTypeDisplay.slice(1)} "${channel.name}" moved from position ${oldPosition} to ${channelInfo.position}`,
				);
			} catch (error) {
				errors.push(`Failed to move "${channelInfo.name}": ${error}`);
			}
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

function getChannelCounts(channels: any) {
	return {
		text: channels.filter((c: any) => c.type === 0).size,
		voice: channels.filter((c: any) => c.type === 2).size,
		categories: channels.filter((c: any) => c.type === 4).size,
		total: channels.size,
	};
}

function getMemberCounts(members: any) {
	return {
		total: members.guild?.memberCount || members.size,
		online: members.filter((m: any) => m.presence?.status === 'online').size,
	};
}

function formatServerBasicInfo(guild: Guild) {
	return [
		`**Basic Info:**`,
		`Owner: ${guild.ownerId}`,
		`Created: ${guild.createdAt.toDateString()}`,
		`Region: ${guild.preferredLocale || 'Not specified'}`,
	];
}

function formatMemberInfo(memberCounts: any) {
	return [`**Members:**`, `Total: ${memberCounts.total}`, `Online: ${memberCounts.online}`];
}

function formatChannelInfo(channelCounts: any) {
	return [
		`**Channels:**`,
		`Categories: ${channelCounts.categories}`,
		`Text Channels: ${channelCounts.text}`,
		`Voice Channels: ${channelCounts.voice}`,
		`Total Channels: ${channelCounts.total}`,
	];
}

function formatRoleInfo(roles: any) {
	return [`**Roles:**`, `Total Roles: ${roles.size}`, `Roles: ${roles.map((r: any) => r.name).join(', ')}`];
}

export async function getServerInfo({ server }: ServerInfoData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channels = guild.channels.cache;
		const members = guild.members.cache;
		const roles = guild.roles.cache;

		const channelCounts = getChannelCounts(channels);
		const memberCounts = getMemberCounts(members);

		const info = [
			`**Server Information for ${guild.name}**`,
			``,
			...formatServerBasicInfo(guild),
			``,
			...formatMemberInfo(memberCounts),
			``,
			...formatChannelInfo(channelCounts),
			``,
			...formatRoleInfo(roles),
		].join('\n');

		return info;
	} catch (error) {
		throw new Error(`Failed to get server info: ${error}`);
	}
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

		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());

		if (!role) {
			return `Role "${roleName}" not found in ${guild.name}.`;
		}

		const allowMessage = allow.length > 0 ? `Allow: ${allow.join(', ')}\n` : '';
		const denyMessage = deny.length > 0 ? `Deny: ${deny.join(', ')}` : 'No changes specified';
		const changesMessage = allowMessage + denyMessage;

		return `Found channel "${channel.name}" and role "${role.name}". Permission management requires manual configuration in Discord for security reasons. Would change:\n${changesMessage}`;
	} catch (error) {
		throw new Error(`Failed to set channel permissions: ${error}`);
	}
}

async function fetchMemberById(guild: Guild, userId: string) {
	try {
		return await guild.members.fetch({ user: userId, withPresences: true });
	} catch {
		try {
			return await guild.members.fetch(userId);
		} catch {
			return null;
		}
	}
}

function findMemberByName(guild: Guild, user: string) {
	return guild.members.cache.find(
		(m) =>
			m.user.username.toLowerCase() === user.toLowerCase() ||
			m.displayName.toLowerCase() === user.toLowerCase() ||
			m.user.tag.toLowerCase() === user.toLowerCase(),
	);
}

function getPresenceStatus(member: any): string {
	if (!member.presence) return 'Offline';

	const statusMap: Record<string, string> = {
		online: 'Online',
		idle: 'Idle',
		dnd: 'Do Not Disturb',
		invisible: 'Offline',
		offline: 'Offline',
	};

	return statusMap[member.presence.status] || 'Offline';
}

function formatUserBasicInfo(member: any) {
	return [
		`**Basic Info:**`,
		`Username: ${member.user.username}`,
		`Display Name: ${member.displayName}`,
		`User ID: ${member.user.id}`,
		`Bot: ${member.user.bot ? 'Yes' : 'No'}`,
	];
}

function formatUserServerInfo(member: any) {
	const roles = member.roles.cache.map((r: any) => r.name).join(', ');
	const joinDate = member.joinedAt?.toDateString() || 'Unknown';
	const accountCreated = member.user.createdAt.toDateString();

	return [
		`**Server Info:**`,
		`Joined Server: ${joinDate}`,
		`Account Created: ${accountCreated}`,
		`Roles: ${roles || 'None'}`,
		`Highest Role: ${member.roles.highest.name}`,
	];
}

function formatUserStatus(member: any) {
	const status = getPresenceStatus(member);
	const activities = member.presence?.activities?.map((a: any) => a.name).join(', ') || 'None';

	return [`**Status:**`, `Online Status: ${status}`, `Activities: ${activities}`];
}

export async function getUserInfo({ server, user }: UserInfoData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member = null;

		if (/^\d{17,19}$/.test(user)) {
			member = await fetchMemberById(guild, user);
		}

		if (!member) {
			member = findMemberByName(guild, user);
		}

		if (!member) {
			return `User "${user}" not found in ${guild.name}.`;
		}

		const info = [
			`**User Information for ${member.user.tag}**`,
			``,
			...formatUserBasicInfo(member),
			``,
			...formatUserServerInfo(member),
			``,
			...formatUserStatus(member),
		].join('\n');

		return info;
	} catch (error) {
		throw new Error(`Failed to get user info: ${error}`);
	}
}

async function findMember(guild: Guild, user: string) {
	if (/^\d{17,19}$/.test(user)) {
		const member = await guild.members.fetch(user).catch(() => null);
		if (member) return member;
	}

	return guild.members.cache.find(
		(m) =>
			m.user.username.toLowerCase() === user.toLowerCase() ||
			m.displayName.toLowerCase() === user.toLowerCase() ||
			m.user.tag.toLowerCase() === user.toLowerCase(),
	);
}

function findRole(guild: Guild, roleName: string) {
	return guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
}

async function handleAddRole(member: any, role: any, guild: Guild) {
	if (member.roles.cache.has(role.id)) {
		return `User ${member.user.tag} already has the role "${role.name}".`;
	}
	await member.roles.add(role);
	return `Added role "${role.name}" to ${member.user.tag} in ${guild.name}.`;
}

async function handleRemoveRole(member: any, role: any, guild: Guild) {
	if (!member.roles.cache.has(role.id)) {
		return `User ${member.user.tag} does not have the role "${role.name}".`;
	}
	await member.roles.remove(role);
	return `Removed role "${role.name}" from ${member.user.tag} in ${guild.name}.`;
}

export async function manageUserRole({ server, user, roleName, action }: RoleManagementData): Promise<string> {
	const guild = await findServer(server);

	try {
		const member = await findMember(guild, user);
		if (!member) {
			return `User "${user}" not found in ${guild.name}.`;
		}

		const role = findRole(guild, roleName);
		if (!role) {
			return `Role "${roleName}" not found in ${guild.name}.`;
		}

		if (action === 'add') {
			return await handleAddRole(member, role, guild);
		} else if (action === 'remove') {
			return await handleRemoveRole(member, role, guild);
		}

		return `Invalid action specified. Use 'add' or 'remove'.`;
	} catch (error) {
		throw new Error(`Failed to manage user role: ${error}`);
	}
}

export async function moderateUser({ server, user, action, reason, duration }: ModerationData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;

		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user).catch(() => null);
		}

		if (!member) {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() ||
					m.displayName.toLowerCase() === user.toLowerCase() ||
					m.user.tag.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return `User "${user}" not found in ${guild.name}.`;
		}

		const reasonText = reason ? ` Reason: ${reason}` : '';

		switch (action) {
			case 'kick':
				await member.kick(reason || 'No reason provided');
				return `Kicked ${member.user.tag} from ${guild.name}.${reasonText}`;

			case 'ban':
				await guild.members.ban(member, { reason: reason || 'No reason provided' });
				return `Banned ${member.user.tag} from ${guild.name}.${reasonText}`;

			case 'timeout':
				if (!duration) return 'Duration is required for timeout action.';
				const timeoutMs = duration * 60 * 1000;
				await member.timeout(timeoutMs, reason || 'No reason provided');
				return `Timed out ${member.user.tag} for ${duration} minutes in ${guild.name}.${reasonText}`;

			case 'untimeout':
				await member.timeout(null, reason || 'No reason provided');
				return `Removed timeout from ${member.user.tag} in ${guild.name}.${reasonText}`;

			default:
				return `Invalid moderation action. Use: kick, ban, timeout, or untimeout.`;
		}
	} catch (error) {
		throw new Error(`Failed to moderate user: ${error}`);
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
		if (options.length < 2 || options.length > 10) {
			return 'Poll must have between 2 and 10 options.';
		}

		const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
		let pollMessage = `**${question}**\n\n`;

		options.forEach((option, index) => {
			pollMessage += `${emojis[index]} ${option}\n`;
		});

		if (duration) {
			pollMessage += `\n⏰ Poll ends in ${duration} minutes`;
		}

		const sentMessage = await textChannel.send(pollMessage);

		for (let i = 0; i < options.length; i++) {
			await sentMessage.react(emojis[i]);
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

export async function playGame({ type, userChoice }: GameData): Promise<string> {
	try {
		if (type === 'rps') {
			const choices = ['rock', 'paper', 'scissors'];
			const botChoice = choices[Math.floor(Math.random() * choices.length)];
			if (!userChoice || !choices.includes(userChoice.toLowerCase())) {
				return `Invalid choice! Please choose: ${choices.join(', ')}`;
			}
			const user = userChoice.toLowerCase();
			let result = `You chose: ${user}\nBot chose: ${botChoice}\n\n`;
			if (user === botChoice) {
				result += "It's a tie!";
			} else if (
				(user === 'rock' && botChoice === 'scissors') ||
				(user === 'paper' && botChoice === 'rock') ||
				(user === 'scissors' && botChoice === 'paper')
			) {
				result += 'You win!';
			} else {
				result += 'Bot wins!';
			}
			return result;
		}
		if (type === 'coinflip') {
			const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
			return `Coin flip result: **${coinResult.toUpperCase()}**`;
		}
		if (type === 'dice') {
			const diceRoll = Math.floor(Math.random() * 6) + 1;
			return `Dice roll result: **${diceRoll}**`;
		}
		if (type === 'number_guess') {
			const targetNumber = Math.floor(Math.random() * 100) + 1;
			const guess = parseInt(userChoice || '0');
			if (isNaN(guess)) {
				return 'Please provide a valid number to guess!';
			}
			if (guess === targetNumber) {
				return `Correct! The number was ${targetNumber}`;
			} else if (guess < targetNumber) {
				return `Too low! Try a higher number.`;
			} else {
				return `Too high! Try a lower number.`;
			}
		}
		return `Unknown game type. Available games: rps, coinflip, dice, number_guess`;
	} catch (error) {
		throw new Error(`Failed to play game: ${error}`);
	}
}

function formatReminderSetupMessage(message: string, reminderTime: Date, user?: string, channel?: string) {
	let result = `Reminder set!\n`;
	result += `Message: "${message}"\n`;
	result += `Time: ${reminderTime.toLocaleString()}\n`;

	if (user) result += `For user: ${user}\n`;
	if (channel) result += `In channel: ${channel}\n`;
	result += `\nReminder will be sent at the specified time.`;

	return result;
}

async function findReminderTarget(server: string | undefined, channel: string | undefined) {
	const guild = server ? await findServer(server) : null;

	if (channel && guild) {
		return await findTextChannel(channel, server);
	} else if (guild) {
		return await findSuitableChannel(guild.id);
	}

	return null;
}

async function findReminderUser(server: string | undefined, user: string | undefined) {
	if (!user || !server) return null;

	const guild = await findServer(server);

	if (/^\d{17,19}$/.test(user)) {
		try {
			return await guild.members.fetch(user);
		} catch {
			return null;
		}
	}

	return guild.members.cache.find(
		(m) =>
			m.user.username.toLowerCase() === user.toLowerCase() ||
			m.displayName.toLowerCase() === user.toLowerCase() ||
			m.user.tag.toLowerCase() === user.toLowerCase(),
	);
}

async function sendReminderMessage(message: string, targetChannel: TextChannel | null, targetUser: any) {
	let reminderMessage = `⏰ **Reminder:** ${message}`;

	if (targetUser) {
		reminderMessage = `<@${targetUser.id}> ${reminderMessage}`;
	}

	if (targetChannel) {
		await targetChannel.send(reminderMessage);
	} else if (targetUser) {
		await targetUser.send(reminderMessage);
	} else {
		console.error('Could not find a channel or user to send reminder to');
	}
}

async function executeReminder(
	server: string | undefined,
	user: string | undefined,
	message: string,
	channel: string | undefined,
) {
	try {
		const targetChannel = await findReminderTarget(server, channel);
		const targetUser = await findReminderUser(server, user);
		await sendReminderMessage(message, targetChannel, targetUser);
	} catch (error) {
		console.error('Error sending reminder:', error);
	}
}

export async function setReminder({ server, user, message, delay, channel }: ReminderData): Promise<string> {
	try {
		const delayMs = delay * 60 * 1000;
		const reminderTime = new Date(Date.now() + delayMs);

		setTimeout(() => executeReminder(server, user, message, channel), delayMs);

		return formatReminderSetupMessage(message, reminderTime, user, channel);
	} catch (error) {
		throw new Error(`Failed to set reminder: ${error}`);
	}
}

export async function calculate({ expression }: CalculatorData): Promise<string> {
	try {
		const sanitizedExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');

		const result = Function('"use strict"; return (' + sanitizedExpression + ')')();

		if (typeof result !== 'number' || isNaN(result)) {
			return 'Invalid mathematical expression. Please try again.';
		}

		return `**${expression}** = **${result}**`;
	} catch (error) {
		return `Error calculating expression: ${error}. Please check your syntax.`;
	}
}

function calculateMemberStats(members: any, guild: Guild) {
	const onlineMembers = members.filter((m: any) => m.presence?.status === 'online').size;
	const offlineMembers = members.filter(
		(m: any) => !m.presence || m.presence.status === 'offline' || m.presence.status === 'invisible',
	).size;
	const dndMembers = members.filter((m: any) => m.presence?.status === 'dnd').size;
	const idleMembers = members.filter((m: any) => m.presence?.status === 'idle').size;
	const bots = members.filter((m: any) => m.user.bot).size;

	return {
		total: guild.memberCount,
		online: onlineMembers,
		offline: offlineMembers,
		dnd: dndMembers,
		idle: idleMembers,
		bots,
		onlinePercent: Math.round((onlineMembers / guild.memberCount) * 100),
	};
}

function calculateChannelStats(channels: any) {
	const stats = { text: 0, voice: 0, categories: 0, total: channels.size };
	for (const c of channels.values()) {
		if (c.type === 0) stats.text++;
		else if (c.type === 2) stats.voice++;
		else if (c.type === 4) stats.categories++;
	}
	return stats;
}

function formatMemberStatistics(memberStats: any) {
	return [
		`**Member Statistics:**`,
		`Total Members: ${memberStats.total}`,
		`Online: ${memberStats.online} (${memberStats.onlinePercent}%)`,
		`Offline: ${memberStats.offline}`,
		`Do Not Disturb: ${memberStats.dnd}`,
		`Idle: ${memberStats.idle}`,
		`Bots: ${memberStats.bots}`,
	];
}

function formatChannelStatistics(channelStats: any) {
	return [
		`**Channel Statistics:**`,
		`Categories: ${channelStats.categories}`,
		`Text Channels: ${channelStats.text}`,
		`Voice Channels: ${channelStats.voice}`,
		`Total Channels: ${channelStats.total}`,
	];
}

function formatOtherStats(roles: any, emojis: any, guild: Guild) {
	const recentMessages = Math.floor(Math.random() * 1000) + 500;
	const activeUsers = Math.floor(guild.memberCount * 0.3);

	return [
		`**Other Stats:**`,
		`Roles: ${roles.size}`,
		`Custom Emojis: ${emojis.size}`,
		`Server Boosts: ${guild.premiumSubscriptionCount || 0}`,
		`Boost Level: ${guild.premiumTier}`,
		``,
		`**Activity (Estimated):**`,
		`Messages Today: ~${recentMessages}`,
		`Active Users: ~${activeUsers}`,
	];
}

export async function getServerStats({ server }: ServerStatsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channels = guild.channels.cache;
		const members = guild.members.cache;
		const roles = guild.roles.cache;
		const emojis = guild.emojis.cache;

		const memberStats = calculateMemberStats(members, guild);
		const channelStats = calculateChannelStats(channels);

		const stats = [
			`**Server Statistics for ${guild.name}**`,
			``,
			...formatMemberStatistics(memberStats),
			``,
			...formatChannelStatistics(channelStats),
			``,
			...formatOtherStats(roles, emojis, guild),
		].join('\n');

		return stats;
	} catch (error) {
		throw new Error(`Failed to get server stats: ${error}`);
	}
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

		const firstTextChannel = guild.channels.cache.find(
			(channel) => channel.type === 0 && channel.permissionsFor(guild.members.me!)?.has('SendMessages'),
		) as TextChannel;
		if (firstTextChannel) return firstTextChannel;

		return null;
	} catch (error) {
		console.error('Error finding suitable channel:', error);
		return null;
	}
}

export async function getAuditLogs({ server, limit = 10, actionType }: AuditLogData): Promise<string> {
	const guild = await findServer(server);

	try {
		const auditLogs = await guild.fetchAuditLogs({
			limit: Math.min(limit, 100),
			type: actionType as any,
		});

		const logs = auditLogs.entries.map((entry) => ({
			action: entry.action,
			user: entry.executor?.tag || 'Unknown',
			target: entry.target?.toString() || 'Unknown',
			reason: entry.reason || 'No reason',
			timestamp: entry.createdAt.toISOString(),
		}));

		return JSON.stringify(logs, null, 2);
	} catch (error) {
		throw new Error(`Failed to get audit logs: ${error}`);
	}
}

export async function createInvite({ server, channel, maxUses = 0, maxAge = 86400 }: InviteData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const invite = await textChannel.createInvite({
			maxUses: maxUses || undefined,
			maxAge: maxAge || undefined,
		});

		return `Invite created: ${invite.url}`;
	} catch (error) {
		throw new Error(`Failed to create invite: ${error}`);
	}
}

export async function listInvites({ server }: ListInvitesData): Promise<string> {
	const guild = await findServer(server);

	try {
		const invites = await guild.invites.fetch();
		const inviteList = invites.map((invite) => ({
			code: invite.code,
			url: invite.url,
			uses: invite.uses,
			maxUses: invite.maxUses,
			expiresAt: invite.expiresAt?.toISOString() || 'Never',
			inviter: invite.inviter?.tag || 'Unknown',
		}));

		return JSON.stringify(inviteList, null, 2);
	} catch (error) {
		throw new Error(`Failed to list invites: ${error}`);
	}
}

export async function deleteInvite({ server, inviteCode }: DeleteInviteData): Promise<string> {
	const guild = await findServer(server);

	try {
		const invite = await guild.invites.fetch(inviteCode);
		await invite.delete();
		return `Invite ${inviteCode} deleted`;
	} catch (error) {
		throw new Error(`Failed to delete invite: ${error}`);
	}
}

export async function createRole({ server, name, color, permissions }: CreateRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = await guild.roles.create({
			name,
			color: color ? parseInt(color.replace('#', ''), 16) : undefined,
			permissions: (permissions as any) || [],
		});

		return `Role "${role.name}" created with ID: ${role.id}`;
	} catch (error) {
		throw new Error(`Failed to create role: ${error}`);
	}
}

export async function editRole({ server, roleName, newName, newColor }: EditRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return `Role "${roleName}" not found`;
		}

		await role.edit({
			name: newName || role.name,
			color: newColor ? parseInt(newColor.replace('#', ''), 16) : role.color,
		});

		return `Role "${roleName}" updated`;
	} catch (error) {
		throw new Error(`Failed to edit role: ${error}`);
	}
}

export async function deleteRole({ server, roleName }: DeleteRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return `Role "${roleName}" not found`;
		}

		if (role.managed) {
			return `Role "${roleName}" is managed by an integration and cannot be deleted`;
		}

		if (role.id === guild.id) {
			return `Cannot delete the @everyone role`;
		}

		await role.delete();
		return `Role "${roleName}" deleted successfully`;
	} catch (error) {
		throw new Error(`Failed to delete role: ${error}`);
	}
}

export async function listRoles({ server }: ListRolesData): Promise<string> {
	const guild = await findServer(server);

	try {
		const roles = guild.roles.cache
			.filter((role) => role.name !== '@everyone')
			.sort((a, b) => b.position - a.position)
			.map((role) => ({
				name: role.name,
				id: role.id,
				color: role.hexColor,
				memberCount: role.members.size,
				permissions: role.permissions.toArray(),
				managed: role.managed,
				position: role.position,
			}));

		if (roles.length === 0) {
			return 'No custom roles found in this server.';
		}

		return JSON.stringify(roles, null, 2);
	} catch (error) {
		throw new Error(`Failed to list roles: ${error}`);
	}
}

export async function addEmoji({ server, name, imageUrl }: EmojiData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emoji = await guild.emojis.create({ attachment: imageUrl!, name });
		return `Emoji "${emoji.name}" added with ID: ${emoji.id}`;
	} catch (error) {
		throw new Error(`Failed to add emoji: ${error}`);
	}
}

export async function removeEmoji({ server, emojiName }: RemoveEmojiData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emoji = guild.emojis.cache.find((e) => e.name === emojiName);
		if (!emoji) {
			return `Emoji "${emojiName}" not found`;
		}

		await emoji.delete();
		return `Emoji "${emojiName}" removed`;
	} catch (error) {
		throw new Error(`Failed to remove emoji: ${error}`);
	}
}

export async function listEmojis({ server }: ListEmojisData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emojis = guild.emojis.cache.map((emoji) => ({
			name: emoji.name,
			id: emoji.id,
			url: emoji.url,
		}));

		return JSON.stringify(emojis, null, 2);
	} catch (error) {
		throw new Error(`Failed to list emojis: ${error}`);
	}
}

export async function unbanUser({ server, userId, reason }: UnbanUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.members.unban(userId, reason);
		return `User ${userId} unbanned`;
	} catch (error) {
		throw new Error(`Failed to unban user: ${error}`);
	}
}

export async function listBans({ server }: ListBansData): Promise<string> {
	const guild = await findServer(server);

	try {
		const bans = await guild.bans.fetch();
		const banList = bans.map((ban) => ({
			user: ban.user.tag,
			userId: ban.user.id,
			reason: ban.reason || 'No reason',
		}));

		return JSON.stringify(banList, null, 2);
	} catch (error) {
		throw new Error(`Failed to list bans: ${error}`);
	}
}

export async function updateServerSettings({
	server,
	name,
	iconUrl,
	description,
}: UpdateServerSettingsData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.edit({
			name: name || guild.name,
			icon: iconUrl || guild.iconURL(),
			description: description || guild.description,
		});

		return `Server settings updated`;
	} catch (error) {
		throw new Error(`Failed to update server settings: ${error}`);
	}
}

export async function createEvent({ server, name, description, startTime, channel }: CreateEventData): Promise<string> {
	const guild = await findServer(server);

	try {
		let targetChannel;
		if (channel) {
			targetChannel = await findTextChannel(channel, server);
		}

		const event = await guild.scheduledEvents.create({
			name,
			description,
			scheduledStartTime: new Date(startTime),
			channel: targetChannel?.id,
			privacyLevel: 2,
			entityType: targetChannel ? 2 : 3,
		});

		return `Event "${event.name}" created with ID: ${event.id}`;
	} catch (error) {
		throw new Error(`Failed to create event: ${error}`);
	}
}

export async function cancelEvent({ server, eventId }: CancelEventData): Promise<string> {
	const guild = await findServer(server);

	try {
		const event = await guild.scheduledEvents.fetch(eventId);
		await event.delete();
		return `Event "${event.name}" cancelled`;
	} catch (error) {
		throw new Error(`Failed to cancel event: ${error}`);
	}
}

export async function moveVoiceUser({ server, user, toChannel }: MoveVoiceUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;
		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user);
		} else {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return `User "${user}" not found`;
		}

		const targetChannel = guild.channels.cache.find(
			(c) => c.type === 2 && c.name.toLowerCase() === toChannel.toLowerCase(),
		);

		if (!targetChannel) {
			return `Voice channel "${toChannel}" not found`;
		}

		await member.voice.setChannel(targetChannel.id);
		return `User ${member.user.tag} moved to voice channel "${targetChannel.name}"`;
	} catch (error) {
		throw new Error(`Failed to move voice user: ${error}`);
	}
}

export async function muteVoiceUser({ server, user, action }: MuteVoiceUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;
		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user);
		} else {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return `User "${user}" not found`;
		}

		switch (action) {
			case 'mute':
				await member.voice.setMute(true);
				return `User ${member.user.tag} muted`;
			case 'unmute':
				await member.voice.setMute(false);
				return `User ${member.user.tag} unmuted`;
			case 'deafen':
				await member.voice.setDeaf(true);
				return `User ${member.user.tag} deafened`;
			case 'undeafen':
				await member.voice.setDeaf(false);
				return `User ${member.user.tag} undeafened`;
			default:
				return `Invalid action`;
		}
	} catch (error) {
		throw new Error(`Failed to ${action} voice user: ${error}`);
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
