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
			try {
				const message = await textChannel.messages.fetch(messageId);
				if (message.author.id === textChannel.client.user?.id) {
					await message.edit(newContent);
					results.push({ id: messageId, success: true });
				} else {
					results.push({ id: messageId, success: false, error: 'not_bot_message' });
				}
			} catch (error) {
				results.push({ id: messageId, success: false, error: 'fetch_failed' });
			}
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
		const messages: Message[] = [];
		let lastId: string | undefined;
		const maxMessages = Math.min(limit, 500);

		while (messages.length < maxMessages) {
			const fetchOptions: any = { limit: 100 };
			if (lastId) fetchOptions.before = lastId;

			const fetched = (await textChannel.messages.fetch(fetchOptions)) as unknown as Collection<string, Message>;
			if (fetched.size === 0) break;

			for (const msg of fetched.values()) {
				const matchesQuery = !query || msg.content.toLowerCase().includes(query.toLowerCase());
				const matchesAuthor = !author || msg.author.username.toLowerCase().includes(author.toLowerCase());

				if (matchesQuery && matchesAuthor) {
					messages.push(msg);
					if (messages.length >= maxMessages) break;
				}
			}

			lastId = fetched.last()?.id;
			if (messages.length >= maxMessages) break;
		}

		const results = messages.map((m) => ({
			id: m.id,
			content: m.content,
			author: m.author.username,
			timestamp: m.createdAt.toISOString(),
			url: m.url,
		}));

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
		const messages = await textChannel.messages.fetch({ limit: 100 });
		const pinned = [];

		for (const msg of messages.values()) {
			if (msg.pinned) continue;

			const matchesReactions =
				!minReactions || msg.reactions.cache.reduce((sum, r) => sum + r.count, 0) >= minReactions;
			const matchesAuthor = !authorId || msg.author.id === authorId;
			const matchesText = !containsText || msg.content.toLowerCase().includes(containsText.toLowerCase());

			if (matchesReactions && matchesAuthor && matchesText) {
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
		let lastId: string | undefined;
		const messages: any[] = [];

		while (messages.length < limit) {
			const fetchOptions: any = { limit: 100 };
			if (lastId) fetchOptions.before = lastId;

			const fetched = (await textChannel.messages.fetch(fetchOptions)) as unknown as Collection<string, Message>;
			if (fetched.size === 0) break;

			messages.push(...Array.from(fetched.values()));
			const lastMessage = fetched.last();
			lastId = lastMessage?.id;

			if (messages.length >= limit) break;
		}

		const data = messages.reverse().map((m: any) => ({
			id: m.id,
			author: m.author.username,
			authorId: m.author.id,
			content: m.content,
			timestamp: m.createdAt.toISOString(),
			attachments: m.attachments.map((a: any) => a.url),
			embeds: m.embeds.length,
			reactions: m.reactions.cache.map((r: any) => ({ emoji: r.emoji.name, count: r.count })),
		}));

		const filename = `export_${textChannel.name}_${Date.now()}.${format}`;
		const filepath = join(process.cwd(), 'data', filename);

		if (format === 'json') {
			await writeFile(filepath, JSON.stringify(data, null, 2));
		} else {
			const textContent = data.map((m) => `[${m.timestamp}] ${m.author}: ${m.content}`).join('\n');
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
		const messages = await source.messages.fetch({ limit: Math.min(limit, 100) });
		const reversed = Array.from(messages.values()).reverse();
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
