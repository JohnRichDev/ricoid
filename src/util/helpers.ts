import type { Guild, GuildMember, PermissionResolvable } from 'discord.js';
import { DISCORD_SNOWFLAKE_REGEX, HEX_COLOR_REGEX, IMAGE_URL_REGEX, DISCORD_LIMITS } from './constants.js';

export async function findMember(guild: Guild, user: string): Promise<GuildMember | null> {
	if (DISCORD_SNOWFLAKE_REGEX.test(user)) {
		const member = await guild.members.fetch(user).catch(() => null);
		if (member) return member;
	}

	return (
		guild.members.cache.find(
			(m) =>
				m.user.username.toLowerCase() === user.toLowerCase() ||
				m.displayName.toLowerCase() === user.toLowerCase() ||
				m.user.tag.toLowerCase() === user.toLowerCase(),
		) || null
	);
}

export async function checkBotPermissions(
	guild: Guild,
	permissions: PermissionResolvable[],
): Promise<{ hasPermission: boolean; missing: string[] }> {
	const botMember = guild.members.me;

	if (!botMember) {
		return { hasPermission: false, missing: ['Bot member not found'] };
	}

	const missing: string[] = [];

	for (const permission of permissions) {
		if (!botMember.permissions.has(permission)) {
			missing.push(permission.toString());
		}
	}

	return {
		hasPermission: missing.length === 0,
		missing,
	};
}

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

export function validateChannelName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: 'Channel name cannot be empty' };
	}

	if (name.length > DISCORD_LIMITS.CHANNEL_NAME_MAX_LENGTH) {
		return {
			valid: false,
			error: `Channel name exceeds ${DISCORD_LIMITS.CHANNEL_NAME_MAX_LENGTH} characters`,
		};
	}

	if (!/^[a-z0-9-_]+$/.test(name.toLowerCase())) {
		return {
			valid: false,
			error: 'Channel name can only contain letters, numbers, hyphens, and underscores',
		};
	}

	return { valid: true };
}

export function validateRoleName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: 'Role name cannot be empty' };
	}

	if (name.length > DISCORD_LIMITS.ROLE_NAME_MAX_LENGTH) {
		return {
			valid: false,
			error: `Role name exceeds ${DISCORD_LIMITS.ROLE_NAME_MAX_LENGTH} characters`,
		};
	}

	return { valid: true };
}

export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
