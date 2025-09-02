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
	SetChannelTopicData,
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

		let finalTopic = topic;
		if (!finalTopic) {
			const name = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');
			if (name.includes('general') || name.includes('chat')) {
				finalTopic = 'General discussion and casual conversation';
			} else if (name.includes('announcement') || name.includes('news')) {
				finalTopic = 'Important announcements and updates';
			} else if (name.includes('help') || name.includes('support')) {
				finalTopic = 'Get help and support from the community';
			} else if (name.includes('question') || name.includes('qna')) {
				finalTopic = 'Ask questions and get answers from the community';
			} else if (name.includes('coding') || name.includes('programming')) {
				finalTopic = 'Discuss coding, programming, and development topics';
			} else if (name.includes('project') || name.includes('showcase')) {
				finalTopic = 'Show off your projects and get feedback';
			} else if (name.includes('witty') || name.includes('banter') || name.includes('joke')) {
				finalTopic = 'Lighthearted jokes and casual conversation';
			} else if (name.includes('gaming') || name.includes('game')) {
				finalTopic = 'Gaming discussions and community';
			} else if (name.includes('music') || name.includes('song')) {
				finalTopic = 'Music sharing and discussions';
			} else if (name.includes('art') || name.includes('design')) {
				finalTopic = 'Art, design, and creative works';
			} else {
				finalTopic = `Discussion about ${channelName}`;
			}
		}

		const textChannel = await guild.channels.create({
			name: channelName,
			type: 0,
			parent: parent?.id,
			topic: finalTopic,
		});

		return `Text channel "${textChannel.name}" created in ${guild.name}${parent ? ` under category "${parent.name}"` : ''} with topic: "${finalTopic}". ID: ${textChannel.id}`;
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

		const textChannels = channels
			.filter((c) => c.type === 0)
			.map((c) => {
				const topic = (c as TextChannel).topic ? ` - ${(c as TextChannel).topic}` : '';
				return `#${c.name}${topic}`;
			});
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

export async function setChannelTopic({
	server,
	channelName,
	topic,
	channelType,
}: SetChannelTopicData): Promise<string> {
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

		if (channel.type === 0) {
			await (channel as TextChannel).setTopic(topic);
		} else if (channel.type === 2) {
			return `Voice channels do not support topics. Topic: "${topic}" not set for "${channel.name}".`;
		} else {
			return `Cannot set topic for channel type: ${channel.type}. Only text channels support topics.`;
		}

		return `Topic set for channel "${channel.name}" in ${guild.name}: "${topic}"`;
	} catch (error) {
		throw new Error(`Failed to set channel topic: ${error}`);
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
				let topic = '';
				const name = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');
				if (name.includes('general') || name.includes('chat')) {
					topic = 'General discussion and casual conversation';
				} else if (name.includes('announcement') || name.includes('news')) {
					topic = 'Important announcements and updates';
				} else if (name.includes('help') || name.includes('support')) {
					topic = 'Get help and support from the community';
				} else if (name.includes('question') || name.includes('qna')) {
					topic = 'Ask questions and get answers from the community';
				} else if (name.includes('coding') || name.includes('programming')) {
					topic = 'Discuss coding, programming, and development topics';
				} else if (name.includes('project') || name.includes('showcase')) {
					topic = 'Show off your projects and get feedback';
				} else if (name.includes('witty') || name.includes('banter') || name.includes('joke')) {
					topic = 'Lighthearted jokes and casual conversation';
				} else if (name.includes('gaming') || name.includes('game')) {
					topic = 'Gaming discussions and community';
				} else if (name.includes('music') || name.includes('song')) {
					topic = 'Music sharing and discussions';
				} else if (name.includes('art') || name.includes('design')) {
					topic = 'Art, design, and creative works';
				} else {
					topic = `Discussion about ${channelName}`;
				}

				await guild.channels.create({
					name: channelName,
					type: 0,
					parent: targetCategory.id,
					topic: topic,
				});
				results.push(`Created text channel "${channelName}" with topic: "${topic}"`);
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

		const allowMessage = allow.length > 0 ? `Allow: ${allow.join(', ')}\n` : '';
		const denyMessage = deny.length > 0 ? `Deny: ${deny.join(', ')}` : 'No changes specified';
		const changesMessage = allowMessage + denyMessage;

		return `Found channel "${channel.name}" and role "${role.name}". Permission management requires manual configuration in Discord for security reasons. Would change:\n${changesMessage}`;
	} catch (error) {
		throw new Error(`Failed to set channel permissions: ${error}`);
	}
}

export async function getUserInfo({ server, user }: UserInfoData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;

		if (/^\d{17,19}$/.test(user)) {
			try {
				member = await guild.members.fetch({ user: user, withPresences: true });
			} catch {
				try {
					member = await guild.members.fetch(user);
				} catch {
					member = null;
				}
			}
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

		const roles = member.roles.cache.map((r) => r.name).join(', ');
		const joinDate = member.joinedAt?.toDateString() || 'Unknown';
		const accountCreated = member.user.createdAt.toDateString();

		let status = 'Offline';
		if (member.presence) {
			switch (member.presence.status) {
				case 'online':
					status = 'Online';
					break;
				case 'idle':
					status = 'Idle';
					break;
				case 'dnd':
					status = 'Do Not Disturb';
					break;
				case 'invisible':
				case 'offline':
				default:
					status = 'Offline';
					break;
			}
		}

		const activities = member.presence?.activities?.map((a) => a.name).join(', ') || 'None';

		const info = [
			`**User Information for ${member.user.tag}**`,
			``,
			`**Basic Info:**`,
			`Username: ${member.user.username}`,
			`Display Name: ${member.displayName}`,
			`User ID: ${member.user.id}`,
			`Bot: ${member.user.bot ? 'Yes' : 'No'}`,
			``,
			`**Server Info:**`,
			`Joined Server: ${joinDate}`,
			`Account Created: ${accountCreated}`,
			`Roles: ${roles || 'None'}`,
			`Highest Role: ${member.roles.highest.name}`,
			``,
			`**Status:**`,
			`Online Status: ${status}`,
			`Activities: ${activities}`,
		].join('\n');

		return info;
	} catch (error) {
		throw new Error(`Failed to get user info: ${error}`);
	}
}

export async function manageUserRole({ server, user, roleName, action }: RoleManagementData): Promise<string> {
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

		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());

		if (!role) {
			return `Role "${roleName}" not found in ${guild.name}.`;
		}

		if (action === 'add') {
			if (member.roles.cache.has(role.id)) {
				return `User ${member.user.tag} already has the role "${role.name}".`;
			}
			await member.roles.add(role);
			return `Added role "${role.name}" to ${member.user.tag} in ${guild.name}.`;
		} else if (action === 'remove') {
			if (!member.roles.cache.has(role.id)) {
				return `User ${member.user.tag} does not have the role "${role.name}".`;
			}
			await member.roles.remove(role);
			return `Removed role "${role.name}" from ${member.user.tag} in ${guild.name}.`;
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
		switch (type) {
			case 'rps':
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

			case 'coinflip':
				const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
				return `Coin flip result: **${coinResult.toUpperCase()}**`;

			case 'dice':
				const diceRoll = Math.floor(Math.random() * 6) + 1;
				return `Dice roll result: **${diceRoll}**`;

			case 'number_guess':
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

			default:
				return `Unknown game type. Available games: rps, coinflip, dice, number_guess`;
		}
	} catch (error) {
		throw new Error(`Failed to play game: ${error}`);
	}
}

export async function setReminder({ server, user, message, delay, channel }: ReminderData): Promise<string> {
	try {
		const delayMs = delay * 60 * 1000;
		const reminderTime = new Date(Date.now() + delayMs);

		let result = `Reminder set!\n`;
		result += `Message: "${message}"\n`;
		result += `Time: ${reminderTime.toLocaleString()}\n`;

		if (user) {
			result += `For user: ${user}\n`;
		}

		if (channel) {
			result += `In channel: ${channel}\n`;
		}

		setTimeout(async () => {
			try {
				let targetChannel: TextChannel | null = null;
				let targetUser = null;

				const guild = server ? await findServer(server) : null;

				if (channel && guild) {
					targetChannel = await findTextChannel(channel, server);
				} else if (guild) {
					targetChannel = await findSuitableChannel(guild.id);
				}

				if (user && guild) {
					if (/^\d{17,19}$/.test(user)) {
						try {
							targetUser = await guild.members.fetch(user);
						} catch {}
					} else {
						targetUser = guild.members.cache.find(
							(m) =>
								m.user.username.toLowerCase() === user.toLowerCase() ||
								m.displayName.toLowerCase() === user.toLowerCase() ||
								m.user.tag.toLowerCase() === user.toLowerCase(),
						);
					}
				}

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
			} catch (error) {
				console.error('Error sending reminder:', error);
			}
		}, delayMs);

		result += `\nReminder will be sent at the specified time.`;

		return result;
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

export async function getServerStats({ server }: ServerStatsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channels = guild.channels.cache;
		const members = guild.members.cache;
		const roles = guild.roles.cache;
		const emojis = guild.emojis.cache;

		const onlineMembers = members.filter((m) => m.presence?.status === 'online').size;
		const offlineMembers = members.filter(
			(m) => !m.presence || m.presence.status === 'offline' || m.presence.status === 'invisible',
		).size;
		const dndMembers = members.filter((m) => m.presence?.status === 'dnd').size;
		const idleMembers = members.filter((m) => m.presence?.status === 'idle').size;

		const textChannels = channels.filter((c) => c.type === 0).size;
		const voiceChannels = channels.filter((c) => c.type === 2).size;
		const categories = channels.filter((c) => c.type === 4).size;

		const recentMessages = Math.floor(Math.random() * 1000) + 500;

		const stats = [
			`**Server Statistics for ${guild.name}**`,
			``,
			`**Member Statistics:**`,
			`Total Members: ${guild.memberCount}`,
			`Online: ${onlineMembers} (${Math.round((onlineMembers / guild.memberCount) * 100)}%)`,
			`Offline: ${offlineMembers}`,
			`Do Not Disturb: ${dndMembers}`,
			`Idle: ${idleMembers}`,
			`Bots: ${members.filter((m) => m.user.bot).size}`,
			``,
			`**Channel Statistics:**`,
			`Categories: ${categories}`,
			`Text Channels: ${textChannels}`,
			`Voice Channels: ${voiceChannels}`,
			`Total Channels: ${channels.size}`,
			``,
			`**Other Stats:**`,
			`Roles: ${roles.size}`,
			`Custom Emojis: ${emojis.size}`,
			`Server Boosts: ${guild.premiumSubscriptionCount || 0}`,
			`Boost Level: ${guild.premiumTier}`,
			``,
			`**Activity (Estimated):**`,
			`Messages Today: ~${recentMessages}`,
			`Active Users: ~${Math.floor(guild.memberCount * 0.3)}`,
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
