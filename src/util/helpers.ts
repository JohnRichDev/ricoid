import { HEX_COLOR_REGEX, IMAGE_URL_REGEX, DISCORD_LIMITS } from './constants.js';

export function validateHexColor(color: string): boolean {
	return HEX_COLOR_REGEX.test(color);
}

export function parseHexColor(color: string): number | null {
	if (!validateHexColor(color)) {
		return null;
	}
	return parseInt(color.replace('#', ''), 16);
}

export function validateImageUrl(url: string): boolean {
	return IMAGE_URL_REGEX.test(url);
}

export function validateMessageContent(content: string): { valid: boolean; error?: string } {
	if (!content || content.trim().length === 0) {
		return { valid: false, error: 'Message content cannot be empty' };
	}

	if (content.length > DISCORD_LIMITS.MESSAGE_CONTENT_MAX_LENGTH) {
		return {
			valid: false,
			error: `Message content exceeds ${DISCORD_LIMITS.MESSAGE_CONTENT_MAX_LENGTH} characters`,
		};
	}

	return { valid: true };
}

export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
