import type {
	MessageHeatmapData,
	TopPostersData,
	EmojiStatsData,
	ChannelActivityData,
	MemberGrowthData,
} from '../../types/index.js';
import { findServer, findTextChannel } from './core.js';
import type { Collection, Message } from 'discord.js';
import { DISCORD_LIMITS } from '../../util/constants.js';

const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;

function processHeatmapMessages(
	messages: Collection<string, Message>,
	cutoffDate: Date,
	hourCounts: number[],
	dayCounts: number[],
) {
	let processed = 0;
	for (const msg of messages.values()) {
		if (msg.createdAt < cutoffDate) return { processed, stop: true };
		const hour = msg.createdAt.getHours();
		const day = msg.createdAt.getDay();
		hourCounts[hour]++;
		dayCounts[day]++;
		processed++;
	}
	return { processed, stop: false };
}

function processTopPostersMessages(
	messages: Collection<string, Message>,
	cutoffDate: Date,
	userCounts: Record<string, { username: string; count: number; totalLength: number }>,
) {
	let processed = 0;
	for (const msg of messages.values()) {
		if (msg.createdAt < cutoffDate) return { processed, stop: true };

		const userId = msg.author.id;
		if (!userCounts[userId]) {
			userCounts[userId] = {
				username: msg.author.username,
				count: 0,
				totalLength: 0,
			};
		}

		userCounts[userId].count++;
		userCounts[userId].totalLength += msg.content.length;
		processed++;
	}

	return { processed, stop: false };
}

export async function messageHeatmap({ server, channel, days = 7 }: MessageHeatmapData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const hourCounts = new Array(HOURS_IN_DAY).fill(0);
		const dayCounts = new Array(DAYS_IN_WEEK).fill(0);
		const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
		let lastId: string | undefined;
		let totalMessages = 0;

		while (totalMessages < DISCORD_LIMITS.ANALYTICS_HEATMAP_MAX_MESSAGES) {
			const fetchOptions: any = { limit: DISCORD_LIMITS.MESSAGE_FETCH_LIMIT };
			if (lastId) fetchOptions.before = lastId;

			const messages = (await textChannel.messages.fetch(fetchOptions)) as unknown as Collection<string, Message>;
			if (messages.size === 0) break;

			const { processed, stop } = processHeatmapMessages(messages, cutoffDate, hourCounts, dayCounts);
			totalMessages += processed;
			if (stop) break;

			const lastMessage = messages.last();
			lastId = lastMessage?.id;
		}

		const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		const byDay = dayCounts.map((count, i) => ({ day: dayNames[i], messages: count }));
		const byHour = hourCounts.map((count, i) => ({ hour: i, messages: count }));

		return JSON.stringify({
			channel: textChannel.name,
			analyzedMessages: totalMessages,
			days,
			byHour,
			byDay,
		});
	} catch (error) {
		throw new Error(`Failed to generate message heatmap: ${error}`);
	}
}

export async function topPosters({ server, channel, limit = 10, days = 7 }: TopPostersData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const userCounts: Record<string, { username: string; count: number; totalLength: number }> = {};
		const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		let lastId: string | undefined;
		let totalMessages = 0;

		while (totalMessages < DISCORD_LIMITS.ANALYTICS_MAX_MESSAGES) {
			const fetchOptions: any = { limit: DISCORD_LIMITS.MESSAGE_FETCH_LIMIT };
			if (lastId) fetchOptions.before = lastId;

			const messages = (await textChannel.messages.fetch(fetchOptions)) as unknown as Collection<string, Message>;
			if (messages.size === 0) break;

			const { processed, stop } = processTopPostersMessages(messages, cutoffDate, userCounts);
			totalMessages += processed;
			if (stop) break;

			const lastMessage = messages.last();
			lastId = lastMessage?.id;
		}

		const sorted = Object.values(userCounts)
			.sort((a, b) => b.count - a.count)
			.slice(0, limit)
			.map((user, i) => ({
				rank: i + 1,
				username: user.username,
				messages: user.count,
				avgMessageLength: Math.round(user.totalLength / user.count),
			}));

		return JSON.stringify({
			channel: textChannel.name,
			days,
			analyzedMessages: totalMessages,
			topPosters: sorted,
		});
	} catch (error) {
		throw new Error(`Failed to get top posters: ${error}`);
	}
}

export async function emojiStats({ server, days = 7 }: EmojiStatsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emojiCounts: Record<string, { name: string; count: number; isCustom: boolean }> = {};
		const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		for (const channel of guild.channels.cache.values()) {
			if (channel.isTextBased() && 'messages' in channel) {
				try {
					const messages = await channel.messages.fetch({ limit: 100 });

					for (const msg of messages.values()) {
						if (msg.createdAt < cutoffDate) continue;

						const customEmojiRegex = /<a?:\w+:(\d+)>/g;
						const customMatches = msg.content.match(customEmojiRegex);

						if (customMatches) {
							for (const match of customMatches) {
								if (!emojiCounts[match]) {
									emojiCounts[match] = { name: match, count: 0, isCustom: true };
								}
								emojiCounts[match].count++;
							}
						}

						for (const reaction of msg.reactions.cache.values()) {
							const key = reaction.emoji.id || reaction.emoji.name || 'unknown';
							const name = reaction.emoji.name || 'unknown';

							if (!emojiCounts[key]) {
								emojiCounts[key] = { name, count: 0, isCustom: !!reaction.emoji.id };
							}
							emojiCounts[key].count += reaction.count;
						}
					}
				} catch {
					continue;
				}
			}
		}

		const sorted = Object.values(emojiCounts)
			.sort((a, b) => b.count - a.count)
			.slice(0, 20);

		return JSON.stringify({
			server: guild.name,
			days,
			topEmojis: sorted,
		});
	} catch (error) {
		throw new Error(`Failed to get emoji stats: ${error}`);
	}
}

export async function channelActivity({ server, days = 7 }: ChannelActivityData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channelCounts: Record<string, { name: string; messages: number; activeUsers: Set<string> }> = {};
		const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		for (const channel of guild.channels.cache.values()) {
			if (channel.isTextBased() && 'messages' in channel) {
				try {
					channelCounts[channel.id] = {
						name: channel.name,
						messages: 0,
						activeUsers: new Set(),
					};

					const messages = await channel.messages.fetch({ limit: 100 });

					for (const msg of messages.values()) {
						if (msg.createdAt < cutoffDate) continue;

						channelCounts[channel.id].messages++;
						channelCounts[channel.id].activeUsers.add(msg.author.id);
					}
				} catch {
					continue;
				}
			}
		}

		const sorted = Object.values(channelCounts)
			.map((ch) => ({
				name: ch.name,
				messages: ch.messages,
				activeUsers: ch.activeUsers.size,
			}))
			.sort((a, b) => b.messages - a.messages);

		return JSON.stringify({
			server: guild.name,
			days,
			channels: sorted,
		});
	} catch (error) {
		throw new Error(`Failed to get channel activity: ${error}`);
	}
}

export async function memberGrowth({ server }: MemberGrowthData): Promise<string> {
	const guild = await findServer(server);

	try {
		return JSON.stringify({
			note: 'Member growth tracking requires persistent event logging over time',
			currentMembers: guild.memberCount,
			suggestion: 'Implement daily snapshots in scheduled task',
		});
	} catch (error) {
		throw new Error(`Failed to get member growth: ${error}`);
	}
}
