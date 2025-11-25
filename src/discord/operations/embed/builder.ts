import { clampString, setString, extractFieldsFromDescription } from './fieldParser.js';

export function buildEmbedFooter(footer: any): Record<string, any> | null {
	const footerText = setString(footer.text);
	if (!footerText) return null;

	const normalizedFooter: Record<string, any> = { text: clampString(footerText, 2048) };
	const footerIcon = setString(footer.iconUrl);
	if (footerIcon) normalizedFooter.icon_url = footerIcon;
	return normalizedFooter;
}

export function buildEmbedAuthor(author: any): Record<string, any> | null {
	const authorName = setString(author.name);
	if (!authorName) return null;

	const normalizedAuthor: Record<string, any> = { name: clampString(authorName, 256) };
	const authorIcon = setString(author.iconUrl);
	const authorUrl = setString(author.url);
	if (authorIcon) normalizedAuthor.icon_url = authorIcon;
	if (authorUrl) normalizedAuthor.url = authorUrl;
	return normalizedAuthor;
}

export function processEmbedDescription(description?: string): {
	description: string | null;
	fields: Array<{ name: string; value: string; inline?: boolean }>;
} {
	let normalizedDescription = setString(description);
	let extractedFieldsFromDescription: Array<{ name: string; value: string; inline?: boolean }> = [];

	if (normalizedDescription) {
		const { cleaned, fields } = extractFieldsFromDescription(normalizedDescription);
		normalizedDescription = cleaned;
		extractedFieldsFromDescription = fields;
	}

	return {
		description: normalizedDescription ? clampString(normalizedDescription, 4096) : null,
		fields: extractedFieldsFromDescription,
	};
}

export function addEmbedMedia(embed: any, params: { image?: string; thumbnail?: string }): void {
	if (params.image) {
		const imageUrl = setString(params.image);
		if (imageUrl) embed.image = { url: imageUrl };
	}

	if (params.thumbnail) {
		const thumbnailUrl = setString(params.thumbnail);
		if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };
	}
}

export function addEmbedMetadata(
	embed: any,
	params: {
		footer?: { text: string; iconUrl?: string };
		author?: { name: string; iconUrl?: string; url?: string };
		timestamp?: boolean;
		url?: string;
	},
): void {
	if (params.footer) {
		const normalizedFooter = buildEmbedFooter(params.footer);
		if (normalizedFooter) embed.footer = normalizedFooter;
	}

	if (params.author) {
		const normalizedAuthor = buildEmbedAuthor(params.author);
		if (normalizedAuthor) embed.author = normalizedAuthor;
	}

	if (params.timestamp) {
		embed.timestamp = new Date().toISOString();
	}

	if (params.url) {
		const embedUrl = setString(params.url);
		if (embedUrl) embed.url = embedUrl;
	}
}

export function buildEmbed(params: {
	title?: string;
	description?: string;
	color?: string;
	fields?: Array<{ name: string; value: string; inline?: boolean }>;
	footer?: { text: string; iconUrl?: string };
	image?: string;
	thumbnail?: string;
	author?: { name: string; iconUrl?: string; url?: string };
	timestamp?: boolean;
	url?: string;
}): any {
	const embed: any = {};

	if (params.title) {
		const titleValue = setString(params.title);
		if (titleValue) embed.title = clampString(titleValue, 256);
	}

	const { description, fields: extractedFields } = processEmbedDescription(params.description);
	if (description) embed.description = description;

	if (params.color) {
		const colorValue = setString(params.color);
		if (colorValue) {
			embed.color = parseInt(colorValue.replace(/^#/, ''), 16);
		}
	}

	const allFields = [...extractedFields, ...(params.fields || [])];
	if (allFields.length > 0) {
		embed.fields = allFields.slice(0, 25);
	}

	addEmbedMedia(embed, params);
	addEmbedMetadata(embed, params);

	return embed;
}
