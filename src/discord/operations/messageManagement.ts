import type {
	BulkEditMessagesData,
	SearchMessagesData,
	PinAllMessagesData,
	ExportMessagesData,
	CopyMessagesData,
} from '../../types/index.js';
import { findTextChannel } from './core.js';
import type { Collection, Message } from 'discord.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { DISCORD_LIMITS } from '../../util/constants.js';

function filterMessages(messages: any[], query?: string, author?: string): any[] {
	return messages.filter((msg) => {
		const matchesQuery = !query || msg.content.toLowerCase().includes(query.toLowerCase());
		const matchesAuthor = !author || msg.author.username.toLowerCase().includes(author.toLowerCase());
		return matchesQuery && matchesAuthor;
	});
}

function mapMessageToResult(m: any) {
	return {
		id: m.id,
		content: m.content,
		author: m.author.username,
		timestamp: m.createdAt.toISOString(),
		url: m.url,
	};
}

function mapMessageToExportData(m: any) {
	return {
		id: m.id,
		author: m.author.username,
		authorId: m.author.id,
		content: m.content,
		timestamp: m.createdAt.toISOString(),
		attachments: m.attachments.map((a: any) => a.url),
		embeds: m.embeds.length,
		reactions: m.reactions.cache.map((r: any) => ({ emoji: r.emoji.name, count: r.count })),
	};
}

function formatMessageAsText(m: any): string {
	return `[${m.timestamp}] ${m.author}: ${m.content}`;
}

function shouldPinMessage(msg: any, minReactions?: number, authorId?: string, containsText?: string): boolean {
	const matchesReactions =
		!minReactions || msg.reactions.cache.reduce((sum: number, r: any) => sum + r.count, 0) >= minReactions;
	const matchesAuthor = !authorId || msg.author.id === authorId;
	const matchesText = !containsText || msg.content.toLowerCase().includes(containsText.toLowerCase());
	return matchesReactions && matchesAuthor && matchesText;
}

async function fetchPaginatedMessages(textChannel: any, maxMessages: number, cutoffDate?: Date) {
	const results: any[] = [];
	let lastId: string | undefined;

	while (results.length < maxMessages) {
		const fetchOptions: any = { limit: 100 };
		if (lastId) fetchOptions.before = lastId;

		const fetched = (await textChannel.messages.fetch(fetchOptions)) as unknown as Collection<string, Message>;
		if (fetched.size === 0) break;

		for (const msg of fetched.values()) {
			if (cutoffDate && msg.createdAt < cutoffDate) return results;
			results.push(msg);
			if (results.length >= maxMessages) break;
		}

		lastId = fetched.last()?.id;
	}

	return results;
}

async function processSingleMessageEdit(
	textChannel: any,
	messageId: string,
): Promise<{ id: string; success: boolean; error?: string }> {
	try {
		const message = await textChannel.messages.fetch(messageId);
		if (message.author.id !== textChannel.client.user?.id) {
			return { id: messageId, success: false, error: 'not_bot_message' };
		}
		return { id: messageId, success: true };
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : 'fetch_failed';
		return { id: messageId, success: false, error: errorMessage };
	}
}

export async function bulkEditMessages({
	server,
	channel,
	messageIds,
	newContent,
}: BulkEditMessagesData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const results = [];
		for (const messageId of messageIds) {
			const result = await processSingleMessageEdit(textChannel, messageId);
			if (result.success) {
				const message = await textChannel.messages.fetch(messageId);
				await message.edit(newContent);
			}
			results.push(result);
		}

		return JSON.stringify({
			edited: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			results,
		});
	} catch (error) {
		throw new Error(`Failed to bulk edit messages: ${error}`);
	}
}

export async function searchMessages({
	server,
	channel,
	query,
	author,
	limit = 100,
}: SearchMessagesData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const maxMessages = Math.min(limit, DISCORD_LIMITS.SEARCH_MESSAGES_MAX_LIMIT);
		const messages = await fetchPaginatedMessages(textChannel, maxMessages);

		const filtered = filterMessages(messages, query, author);

		const results = filtered.map(mapMessageToResult);

		return JSON.stringify({ found: results.length, messages: results });
	} catch (error) {
		throw new Error(`Failed to search messages: ${error}`);
	}
}

export async function pinAllMessages({
	server,
	channel,
	minReactions,
	authorId,
	containsText,
}: PinAllMessagesData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const messages = await textChannel.messages.fetch({ limit: DISCORD_LIMITS.MESSAGE_FETCH_LIMIT });
		const pinned = [];

		for (const msg of messages.values()) {
			if (msg.pinned) continue;

			if (shouldPinMessage(msg, minReactions, authorId, containsText)) {
				try {
					await msg.pin();
					pinned.push(msg.id);
				} catch {
					continue;
				}
			}
		}

		return JSON.stringify({ pinned: pinned.length, messageIds: pinned });
	} catch (error) {
		throw new Error(`Failed to pin messages: ${error}`);
	}
}

export async function exportMessages({
	server,
	channel,
	format = 'json',
	limit = 1000,
}: ExportMessagesData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);

	try {
		const messages = await fetchPaginatedMessages(textChannel, limit);

		const data = messages.toReversed().map(mapMessageToExportData);

		const filename = `export_${textChannel.name}_${Date.now()}.${format}`;
		const filepath = join(process.cwd(), 'data', filename);

		if (format === 'json') {
			await writeFile(filepath, JSON.stringify(data, null, 2));
		} else {
			const textContent = data.map(formatMessageAsText).join('\n');
			await writeFile(filepath, textContent);
		}

		return JSON.stringify({ exported: messages.length, filename, filepath });
	} catch (error) {
		throw new Error(`Failed to export messages: ${error}`);
	}
}

export async function copyMessages({
	server,
	sourceChannel,
	targetChannel,
	limit = 50,
}: CopyMessagesData): Promise<string> {
	const source = await findTextChannel(sourceChannel, server);
	const target = await findTextChannel(targetChannel, server);

	try {
		const messages = await source.messages.fetch({ limit: Math.min(limit, DISCORD_LIMITS.MESSAGE_FETCH_LIMIT) });
		const reversed = Array.from(messages.values());
		reversed.reverse();
		let copied = 0;

		for (const msg of reversed) {
			try {
				const content = msg.content || '(no text content)';
				await target.send({
					content: `**${msg.author.username}** (${msg.createdAt.toLocaleDateString()}):\n${content}`,
					files: Array.from(msg.attachments.values()).map((a) => a.url),
				});
				copied++;
			} catch {
				continue;
			}
		}

		return JSON.stringify({ copied, total: messages.size });
	} catch (error) {
		throw new Error(`Failed to copy messages: ${error}`);
	}
}
