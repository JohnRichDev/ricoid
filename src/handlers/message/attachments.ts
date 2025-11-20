import { GoogleGenAI } from '@google/genai';
import type { Attachment, Collection } from 'discord.js';
import { Blob, Buffer } from 'node:buffer';
import { extname } from 'node:path';
import type { ConversationPart } from './types.js';

const INLINE_ATTACHMENT_LIMIT_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const EXTENSION_MIME_TYPES: Record<string, string> = {
	'.aac': 'audio/aac',
	'.avi': 'video/x-msvideo',
	'.bmp': 'image/bmp',
	'.csv': 'text/csv',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.flac': 'audio/flac',
	'.gif': 'image/gif',
	'.heic': 'image/heic',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.json': 'application/json',
	'.m4a': 'audio/mp4',
	'.mkv': 'video/x-matroska',
	'.mov': 'video/quicktime',
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.ogg': 'audio/ogg',
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.rar': 'application/vnd.rar',
	'.svg': 'image/svg+xml',
	'.tar': 'application/x-tar',
	'.txt': 'text/plain',
	'.wav': 'audio/wav',
	'.webm': 'video/webm',
	'.webp': 'image/webp',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.zip': 'application/zip',
	'.7z': 'application/x-7z-compressed',
};

function resolveAttachmentMimeType(attachment: Attachment): string | null {
	if (attachment.contentType) {
		return attachment.contentType;
	}
	const extension = extname(attachment.name || '').toLowerCase();
	if (!extension) {
		return null;
	}
	return EXTENSION_MIME_TYPES[extension] || null;
}

function formatAttachmentSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index++;
	}
	const decimals = value >= 10 || index === 0 ? 0 : 1;
	return `${value.toFixed(decimals)} ${units[index]}`;
}

export function buildAttachmentSummary(attachment: Attachment, mimeType: string | null): string {
	const name = attachment.name || 'attachment';
	const size = typeof attachment.size === 'number' ? formatAttachmentSize(attachment.size) : 'unknown size';
	const typeLabel = mimeType || 'unknown type';
	return `Attachment ${name} (${typeLabel}, ${size})`;
}

export function summarizeAttachmentForInstructions(attachment: Attachment): string {
	const mime = resolveAttachmentMimeType(attachment) || 'unknown type';
	const size = typeof attachment.size === 'number' ? formatAttachmentSize(attachment.size) : 'unknown size';
	const name = attachment.name || 'attachment';
	return `- ${name} (${mime}, ${size})`;
}

async function downloadAttachment(attachment: Attachment): Promise<Buffer | { text: string }> {
	const name = attachment.name || 'attachment';

	let url: URL;
	try {
		url = new URL(attachment.url);
	} catch {
		return { text: `Attachment ${name} has an invalid URL.` };
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		return { text: `Attachment ${name} uses an unsupported protocol.` };
	}

	let response: Response;
	try {
		response = await fetch(url.toString());
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unknown error';
		return { text: `Attachment ${name} could not be downloaded (${reason}).` };
	}

	if (!response.ok) {
		return { text: `Attachment ${name} download failed with status ${response.status}.` };
	}

	let buffer: Buffer;
	try {
		const arrayBuffer = await response.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unknown error';
		return { text: `Attachment ${name} data could not be read (${reason}).` };
	}

	if (buffer.length === 0) {
		return { text: `Attachment ${name} is empty.` };
	}

	return buffer;
}

async function uploadAttachment(
	aiClient: GoogleGenAI,
	buffer: Buffer,
	mimeType: string,
	attachment: Attachment,
): Promise<ConversationPart> {
	const name = attachment.name || 'attachment';
	const blob = new Blob([buffer], { type: mimeType });

	try {
		const uploaded = await aiClient.files.upload({
			file: blob,
			config: { mimeType },
		});

		if (uploaded.uri) {
			return {
				fileData: {
					mimeType,
					fileUri: uploaded.uri,
					displayName: attachment.name,
				},
			};
		}
		return { text: `Attachment ${name} upload did not return a usable URI.` };
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'unknown error';
		return { text: `Attachment ${name} could not be uploaded (${reason}).` };
	}
}

async function createAttachmentDataPart(
	aiClient: GoogleGenAI,
	attachment: Attachment,
	mimeTypeHint: string | null,
): Promise<ConversationPart | null> {
	const name = attachment.name || 'attachment';

	if (typeof attachment.size === 'number' && attachment.size > MAX_ATTACHMENT_BYTES) {
		return {
			text: `Attachment ${name} exceeds the ${formatAttachmentSize(MAX_ATTACHMENT_BYTES)} processing limit.`,
		};
	}

	const downloadResult = await downloadAttachment(attachment);

	if (!Buffer.isBuffer(downloadResult)) {
		return downloadResult;
	}

	const buffer = downloadResult;
	const response = await fetch(attachment.url);
	let mimeType = mimeTypeHint || response.headers.get('content-type') || 'application/octet-stream';

	if (buffer.length <= INLINE_ATTACHMENT_LIMIT_BYTES) {
		return {
			inlineData: {
				mimeType,
				data: buffer.toString('base64'),
			},
		};
	}

	if (aiClient.vertexai) {
		return {
			text: `Attachment ${name} is ${formatAttachmentSize(buffer.length)} and requires upload, which is unavailable in Vertex AI mode.`,
		};
	}

	return await uploadAttachment(aiClient, buffer, mimeType, attachment);
}

export async function addAttachmentParts(
	parts: ConversationPart[],
	attachments: Collection<string, Attachment>,
	aiClient: GoogleGenAI,
): Promise<void> {
	if (attachments.size === 0) {
		return;
	}
	for (const attachment of attachments.values()) {
		const mimeType = resolveAttachmentMimeType(attachment);
		parts.push({ text: buildAttachmentSummary(attachment, mimeType) });
		const dataPart = await createAttachmentDataPart(aiClient, attachment, mimeType);
		if (dataPart) {
			parts.push(dataPart);
		}
	}
}
