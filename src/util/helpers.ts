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

export function safeStringifyObject(value: unknown): string {
	if (value === null || value === undefined) {
		return String(value);
	}
	if (typeof value === 'object') {
		try {
			const jsonStr = JSON.stringify(value, Object.getOwnPropertyNames(value));
			return jsonStr !== '{}' ? jsonStr : '[object Object]';
		} catch {
			return '[object Object]';
		}
	}
	return String(value);
}

export function safeStringifyError(error: unknown): string {
	if (error instanceof Error) {
		return error.message || error.toString();
	}
	if (error && typeof error === 'object') {
		try {
			const jsonStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
			return jsonStr !== '{}' ? jsonStr : '[Error object]';
		} catch {
			return '[Error object]';
		}
	}
	return String(error);
}

export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function isValidSnowflake(value: string): boolean {
	return /^\d{17,19}$/.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
