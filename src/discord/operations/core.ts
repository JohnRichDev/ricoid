import { Guild, TextChannel } from 'discord.js';
import { discordClient } from '../client.js';

export function getChannelTypeDisplayName(channelType: number): string {
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

export function findChannelByName(guild: Guild, channelName: string, channelType?: number) {
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

function handleNoServerId(): Guild {
	if (discordClient.guilds.cache.size === 1) {
		return discordClient.guilds.cache.first()!;
	}
	const serverList = Array.from(discordClient.guilds.cache.values())
		.map((g) => `"${g.name}"`)
		.join(', ');
	throw new Error(`Multiple servers. Specify name/ID. Available: ${serverList}`);
}

async function tryFetchServerById(serverId: string): Promise<Guild | undefined> {
	try {
		return await discordClient.guilds.fetch(serverId);
	} catch {
		return undefined;
	}
}

async function findServerByChannelId(serverId: string): Promise<Guild | undefined> {
	if (!/^\d{17,19}$/.test(serverId)) {
		return undefined;
	}

	for (const guild of discordClient.guilds.cache.values()) {
		try {
			const channel = await guild.channels.fetch(serverId);
			if (channel) {
				return guild;
			}
		} catch (error) {
			console.debug(`Could not fetch channel ${serverId} from guild ${guild.name}:`, error);
		}
	}
	return undefined;
}

function findServerByName(serverId: string): Guild {
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

export async function findServer(serverId?: string): Promise<Guild> {
	if (!serverId) {
		return handleNoServerId();
	}

	const serverById = await tryFetchServerById(serverId);
	if (serverById) return serverById;

	const serverByChannelId = await findServerByChannelId(serverId);
	if (serverByChannelId) return serverByChannelId;

	return findServerByName(serverId);
}

export async function findTextChannel(channelId: string, serverId?: string): Promise<TextChannel> {
	const server = await findServer(serverId);

	if (/^\d{17,19}$/.test(channelId)) {
		try {
			const channel = await discordClient.channels.fetch(channelId);
			if (channel instanceof TextChannel) {
				if (channel.guild.id === server.id) {
					return channel;
				}
				throw new Error(`Channel "${channelId}" exists but belongs to "${channel.guild.name}", not "${server.name}"`);
			}
			throw new Error(`Channel "${channelId}" exists in "${server.name}" but is not a text channel`);
		} catch (error) {
			if (error instanceof Error && error.message.includes('exists but')) {
				throw error;
			}
		}
	}

	const channels = server.channels.cache.filter(
		(channel): channel is TextChannel =>
			channel instanceof TextChannel &&
			(channel.name.toLowerCase() === channelId.toLowerCase() ||
				channel.name.toLowerCase() === channelId.toLowerCase().replace('#', '') ||
				channel.name.toLowerCase().includes(channelId.toLowerCase())),
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
