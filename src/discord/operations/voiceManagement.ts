import type { CreateTempVoiceData, VoiceStatsData, DisconnectAllData, MoveAllData } from '../../types/index.js';
import { findServer } from './core.js';
import { ChannelType } from 'discord.js';

export async function createTempVoiceChannel({ channelName, category }: CreateTempVoiceData): Promise<string> {
	return JSON.stringify({
		note: 'Temporary voice channels require voiceStateUpdate event listener',
		channelName,
		category,
		suggestion: 'Create channel when user joins, delete when empty',
	});
}

export async function voiceStats({ server }: VoiceStatsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice);
		const stats = [];

		for (const channel of voiceChannels.values()) {
			if (channel.type === ChannelType.GuildVoice) {
				stats.push({
					name: channel.name,
					id: channel.id,
					members: channel.members.size,
					usernames: channel.members.map((m) => m.user.username),
				});
			}
		}

		const totalInVoice = stats.reduce((sum, ch) => sum + ch.members, 0);

		return JSON.stringify({
			voiceChannels: stats.length,
			totalUsersInVoice: totalInVoice,
			channels: stats,
		});
	} catch (error) {
		throw new Error(`Failed to get voice stats: ${error}`);
	}
}

export async function disconnectAll({ server, channel }: DisconnectAllData): Promise<string> {
	const guild = await findServer(server);

	try {
		const voiceChannel = guild.channels.cache.find(
			(c) => c.name.toLowerCase() === channel.toLowerCase() && c.type === ChannelType.GuildVoice,
		);

		if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
			return JSON.stringify({ error: 'voice_channel_not_found', channel });
		}

		const disconnected = [];
		for (const member of voiceChannel.members.values()) {
			try {
				await member.voice.disconnect();
				disconnected.push(member.user.username);
			} catch {
				continue;
			}
		}

		return JSON.stringify({
			action: 'disconnected_all',
			channel: voiceChannel.name,
			disconnected: disconnected.length,
			users: disconnected,
		});
	} catch (error) {
		throw new Error(`Failed to disconnect all: ${error}`);
	}
}

export async function moveAll({ server, fromChannel, toChannel }: MoveAllData): Promise<string> {
	const guild = await findServer(server);

	try {
		const source = guild.channels.cache.find(
			(c) => c.name.toLowerCase() === fromChannel.toLowerCase() && c.type === ChannelType.GuildVoice,
		);

		const target = guild.channels.cache.find(
			(c) => c.name.toLowerCase() === toChannel.toLowerCase() && c.type === ChannelType.GuildVoice,
		);

		if (!source || source.type !== ChannelType.GuildVoice) {
			return JSON.stringify({ error: 'source_voice_channel_not_found', fromChannel });
		}

		if (!target || target.type !== ChannelType.GuildVoice) {
			return JSON.stringify({ error: 'target_voice_channel_not_found', toChannel });
		}

		const moved = [];
		for (const member of source.members.values()) {
			try {
				await member.voice.setChannel(target);
				moved.push(member.user.username);
			} catch {
				continue;
			}
		}

		return JSON.stringify({
			action: 'moved_all',
			from: source.name,
			to: target.name,
			moved: moved.length,
			users: moved,
		});
	} catch (error) {
		throw new Error(`Failed to move all users: ${error}`);
	}
}
