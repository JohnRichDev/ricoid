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
	RenameChannelData,
	BulkCreateChannelsData,
	ServerInfoData,
	SetChannelPermissionsData,
} from '../types/index.js';

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

	try {
		const server = await discordClient.guilds.fetch(serverId);
		if (server) return server;
	} catch {
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
	throw new Error(`Server "${serverId}" not found`);
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
				results.push(
					`Deleted ${channel.type === 0 ? 'text' : channel.type === 2 ? 'voice' : channel.type === 4 ? 'category' : 'unknown'} channel "${channel.name}"`,
				);
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

export async function createTextChannel({ server, channelName, category, topic }: TextChannelData): Promise<string> {
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
			(channel) => channel.name.toLowerCase() === channelName.toLowerCase() && channel.type === 0,
		);

		if (existingChannel) {
			return `Text channel "${existingChannel.name}" already exists in ${guild.name}. ID: ${existingChannel.id}`;
		}

		const textChannel = await guild.channels.create({
			name: channelName,
			type: 0,
			parent: parent?.id,
			topic: topic,
		});

		return `Text channel "${textChannel.name}" created in ${guild.name}${parent ? ` under category "${parent.name}"` : ''}. ID: ${textChannel.id}`;
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
		let channels;
		if (category) {
			const categoryChannel = guild.channels.cache.find(
				(channel) => channel.name.toLowerCase() === category.toLowerCase() && channel.type === 4,
			);

			if (!categoryChannel) {
				return `Category "${category}" not found in ${guild.name}.`;
			}

			channels = guild.channels.cache.filter((channel) => channel.parentId === categoryChannel.id);
		} else {
			channels = guild.channels.cache;
		}

		const textChannels = channels.filter((c) => c.type === 0).map((c) => `#${c.name}`);
		const voiceChannels = channels.filter((c) => c.type === 2).map((c) => `🔊${c.name}`);
		const categories = channels.filter((c) => c.type === 4).map((c) => `📁${c.name}`);

		let result = `Channels in ${guild.name}`;
		if (category) result += ` (Category: ${category})`;
		result += ':\n\n';

		if (categories.length > 0) {
			result += `**Categories:**\n${categories.join('\n')}\n\n`;
		}

		if (textChannels.length > 0) {
			result += `**Text Channels:**\n${textChannels.join('\n')}\n\n`;
		}

		if (voiceChannels.length > 0) {
			result += `**Voice Channels:**\n${voiceChannels.join('\n')}\n\n`;
		}

		if (textChannels.length === 0 && voiceChannels.length === 0 && categories.length === 0) {
			result += 'No channels found.';
		}

		return result;
	} catch (error) {
		throw new Error(`Failed to list channels: ${error}`);
	}
}

export async function moveChannel({ server, channelName, newCategory, channelType }: MoveChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;

		const channel = guild.channels.cache.find(
			(channel) =>
				channel.name.toLowerCase() === channelName.toLowerCase() &&
				(channelTypeNum === undefined || channel.type === channelTypeNum),
		);

		if (!channel) {
			return `Channel "${channelName}" not found in ${guild.name}.`;
		}

		const targetCategory = guild.channels.cache.find(
			(c) => c.name.toLowerCase() === newCategory.toLowerCase() && c.type === 4,
		);

		if (!targetCategory) {
			return `Category "${newCategory}" not found in ${guild.name}.`;
		}

		await channel.edit({ parent: targetCategory.id });
		return `Channel "${channel.name}" moved to category "${targetCategory.name}" in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to move channel: ${error}`);
	}
}

export async function renameChannel({ server, oldName, newName, channelType }: RenameChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		let channelTypeNum: number | undefined;
		if (channelType === 'text') channelTypeNum = 0;
		else if (channelType === 'voice') channelTypeNum = 2;
		else if (channelType === 'category') channelTypeNum = 4;

		const channel = guild.channels.cache.find(
			(channel) =>
				channel.name.toLowerCase() === oldName.toLowerCase() &&
				(channelTypeNum === undefined || channel.type === channelTypeNum),
		);

		if (!channel) {
			return `Channel "${oldName}" not found in ${guild.name}.`;
		}

		await channel.setName(newName);
		return `Channel "${oldName}" renamed to "${newName}" in ${guild.name}.`;
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

export async function getServerInfo({ server }: ServerInfoData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channels = guild.channels.cache;
		const members = guild.members.cache;
		const roles = guild.roles.cache;

		const textChannels = channels.filter((c) => c.type === 0).size;
		const voiceChannels = channels.filter((c) => c.type === 2).size;
		const categories = channels.filter((c) => c.type === 4).size;

		const info = [
			`**Server Information for ${guild.name}**`,
			``,
			`**Basic Info:**`,
			`Owner: ${guild.ownerId}`,
			`Created: ${guild.createdAt.toDateString()}`,
			`Region: ${guild.preferredLocale || 'Not specified'}`,
			``,
			`**Members:**`,
			`Total: ${guild.memberCount}`,
			`Online: ${members.filter((m) => m.presence?.status === 'online').size}`,
			``,
			`**Channels:**`,
			`Categories: ${categories}`,
			`Text Channels: ${textChannels}`,
			`Voice Channels: ${voiceChannels}`,
			`Total Channels: ${channels.size}`,
			``,
			`**Roles:**`,
			`Total Roles: ${roles.size}`,
			`Roles: ${roles.map((r) => r.name).join(', ')}`,
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

		return `Found channel "${channel.name}" and role "${role.name}". Permission management requires manual configuration in Discord for security reasons. Would change:\n${allow.length > 0 ? `Allow: ${allow.join(', ')}\n` : ''}${deny.length > 0 ? `Deny: ${deny.join(', ')}` : 'No changes specified'}`;
	} catch (error) {
		throw new Error(`Failed to set channel permissions: ${error}`);
	}
}
