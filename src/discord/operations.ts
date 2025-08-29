import { Guild, TextChannel } from 'discord.js';
import { discordClient } from './client.js';
import type { MessageData, MessageHistory, TextChannelData, VoiceChannelData } from '../types/index.js';

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
		}

		const voiceChannel = await guild.channels.create({
			name: channelName,
			type: 2,
			parent: parent?.id,
			userLimit: userLimit || 0,
		});

		return `Voice channel "${voiceChannel.name}" created in ${guild.name}. ID: ${voiceChannel.id}`;
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
		}

		const textChannel = await guild.channels.create({
			name: channelName,
			type: 0,
			parent: parent?.id,
			topic: topic,
		});

		return `Text channel "${textChannel.name}" created in ${guild.name}. ID: ${textChannel.id}`;
	} catch (error) {
		throw new Error(`Failed to create text channel: ${error}`);
	}
}
