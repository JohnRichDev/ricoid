import type {
	UserInfoData,
	RoleManagementData,
	ModerationData,
	EmojiData,
	RemoveEmojiData,
	ListEmojisData,
	UnbanUserData,
	ListBansData,
	CreateRoleData,
	EditRoleData,
	DeleteRoleData,
	ListRolesData,
	MoveVoiceUserData,
	MuteVoiceUserData,
} from '../../types/index.js';
import { parseHexColor, validateImageUrl } from '../../util/helpers.js';
import { findServer } from './core.js';
import type { Guild } from 'discord.js';

async function fetchMemberById(guild: Guild, userId: string) {
	try {
		return await guild.members.fetch({ user: userId, withPresences: true });
	} catch {
		try {
			return await guild.members.fetch(userId);
		} catch {
			return null;
		}
	}
}

function findMemberByName(guild: Guild, user: string) {
	return guild.members.cache.find(
		(m) =>
			m.user.username.toLowerCase() === user.toLowerCase() ||
			m.displayName.toLowerCase() === user.toLowerCase() ||
			m.user.tag.toLowerCase() === user.toLowerCase(),
	);
}

function getPresenceStatus(member: any): string {
	if (!member.presence) return 'Offline';

	const statusMap: Record<string, string> = {
		online: 'Online',
		idle: 'Idle',
		dnd: 'Do Not Disturb',
		invisible: 'Offline',
		offline: 'Offline',
	};

	return statusMap[member.presence.status] || 'Offline';
}

function formatUserBasicInfo(member: any) {
	return [
		`**Basic Info:**`,
		`Username: ${member.user.username}`,
		`Display Name: ${member.displayName}`,
		`User ID: ${member.user.id}`,
		`Bot: ${member.user.bot ? 'Yes' : 'No'}`,
	];
}

function formatUserServerInfo(member: any) {
	const roles = member.roles.cache.map((r: any) => r.name).join(', ');
	const joinDate = member.joinedAt?.toDateString() || 'Unknown';
	const accountCreated = member.user.createdAt.toDateString();

	return [
		`**Server Info:**`,
		`Joined Server: ${joinDate}`,
		`Account Created: ${accountCreated}`,
		`Roles: ${roles || 'None'}`,
		`Highest Role: ${member.roles.highest.name}`,
	];
}

function formatUserStatus(member: any) {
	const status = getPresenceStatus(member);
	const activities = member.presence?.activities?.map((a: any) => a.name).join(', ') || 'None';

	return [`**Status:**`, `Online Status: ${status}`, `Activities: ${activities}`];
}

export async function getUserInfo({ server, user }: UserInfoData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member = null;

		if (/^\d{17,19}$/.test(user)) {
			member = await fetchMemberById(guild, user);
		}

		if (!member) {
			member = findMemberByName(guild, user);
		}

		if (!member) {
			return `User "${user}" not found in ${guild.name}.`;
		}

		const info = [
			`**User Information for ${member.user.tag}**`,
			``,
			...formatUserBasicInfo(member),
			``,
			...formatUserServerInfo(member),
			``,
			...formatUserStatus(member),
		].join('\n');

		return info;
	} catch (error) {
		throw new Error(`Failed to get user info: ${error}`);
	}
}

async function findMember(guild: Guild, user: string) {
	if (/^\d{17,19}$/.test(user)) {
		const member = await guild.members.fetch(user).catch(() => null);
		if (member) return member;
	}

	return guild.members.cache.find(
		(m) =>
			m.user.username.toLowerCase() === user.toLowerCase() ||
			m.displayName.toLowerCase() === user.toLowerCase() ||
			m.user.tag.toLowerCase() === user.toLowerCase(),
	);
}

function findRole(guild: Guild, roleName: string) {
	return guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
}

async function handleAddRole(member: any, role: any, guild: Guild) {
	if (member.roles.cache.has(role.id)) {
		return `User ${member.user.tag} already has the role "${role.name}".`;
	}
	await member.roles.add(role);
	return `Added role "${role.name}" to ${member.user.tag} in ${guild.name}.`;
}

async function handleRemoveRole(member: any, role: any, guild: Guild) {
	if (!member.roles.cache.has(role.id)) {
		return `User ${member.user.tag} does not have the role "${role.name}".`;
	}
	await member.roles.remove(role);
	return `Removed role "${role.name}" from ${member.user.tag} in ${guild.name}.`;
}

export async function manageUserRole({ server, user, roleName, action }: RoleManagementData): Promise<string> {
	const guild = await findServer(server);

	try {
		const member = await findMember(guild, user);
		if (!member) {
			return `User "${user}" not found in ${guild.name}.`;
		}

		const role = findRole(guild, roleName);
		if (!role) {
			return `Role "${roleName}" not found in ${guild.name}.`;
		}

		if (action === 'add') {
			return await handleAddRole(member, role, guild);
		} else if (action === 'remove') {
			return await handleRemoveRole(member, role, guild);
		}

		return `Invalid action specified. Use 'add' or 'remove'.`;
	} catch (error) {
		throw new Error(`Failed to manage user role: ${error}`);
	}
}

export async function moderateUser({ server, user, action, reason, duration }: ModerationData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;

		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user).catch(() => null);
		}

		if (!member) {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() ||
					m.displayName.toLowerCase() === user.toLowerCase() ||
					m.user.tag.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return `User "${user}" not found in ${guild.name}.`;
		}

		const reasonText = reason ? ` Reason: ${reason}` : '';

		switch (action) {
			case 'kick':
				await member.kick(reason || 'No reason provided');
				return `Kicked ${member.user.tag} from ${guild.name}.${reasonText}`;

			case 'ban':
				await guild.members.ban(member, { reason: reason || 'No reason provided' });
				return `Banned ${member.user.tag} from ${guild.name}.${reasonText}`;

			case 'timeout': {
				if (!duration) return 'Duration is required for timeout action.';
				const timeoutMs = duration * 60 * 1000;
				await member.timeout(timeoutMs, reason || 'No reason provided');
				return `Timed out ${member.user.tag} for ${duration} minutes in ${guild.name}.${reasonText}`;
			}

			case 'untimeout':
				await member.timeout(null, reason || 'No reason provided');
				return `Removed timeout from ${member.user.tag} in ${guild.name}.${reasonText}`;

			default:
				return `Invalid moderation action. Use: kick, ban, timeout, or untimeout.`;
		}
	} catch (error) {
		throw new Error(`Failed to moderate user: ${error}`);
	}
}

export async function createRole({ server, name, color, permissions }: CreateRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		let parsedColor: number | undefined = undefined;
		if (color) {
			const colorResult = parseHexColor(color);
			if (colorResult === null) {
				return `Invalid color format: "${color}". Use hex format like #FF0000`;
			}
			parsedColor = colorResult;
		}

		const role = await guild.roles.create({
			name,
			color: parsedColor,
			permissions: (permissions as any) || [],
		});

		return `Role "${role.name}" created with ID: ${role.id}`;
	} catch (error) {
		throw new Error(`Failed to create role: ${error}`);
	}
}

export async function editRole({ server, roleName, newName, newColor }: EditRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return `Role "${roleName}" not found`;
		}

		let colorToSet = role.color;
		if (newColor) {
			const parsedColor = parseHexColor(newColor);
			if (parsedColor === null) {
				return `Invalid color format: "${newColor}". Use hex format like #FF0000`;
			}
			colorToSet = parsedColor;
		}

		await role.edit({
			name: newName || role.name,
			color: colorToSet,
		});

		return `Role "${roleName}" updated`;
	} catch (error) {
		throw new Error(`Failed to edit role: ${error}`);
	}
}

export async function deleteRole({ server, roleName }: DeleteRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return `Role "${roleName}" not found`;
		}

		if (role.managed) {
			return `Role "${roleName}" is managed by an integration and cannot be deleted`;
		}

		if (role.id === guild.id) {
			return `Cannot delete the @everyone role`;
		}

		await role.delete();
		return `Role "${roleName}" deleted successfully`;
	} catch (error) {
		throw new Error(`Failed to delete role: ${error}`);
	}
}

export async function listRoles({ server }: ListRolesData): Promise<string> {
	const guild = await findServer(server);

	try {
		const roles = guild.roles.cache
			.filter((role) => role.name !== '@everyone')
			.sort((a, b) => b.position - a.position)
			.map((role) => ({
				name: role.name,
				id: role.id,
				color: role.hexColor,
				memberCount: role.members.size,
				permissions: role.permissions.toArray(),
				managed: role.managed,
				position: role.position,
			}));

		if (roles.length === 0) {
			return 'No custom roles found in this server.';
		}

		return JSON.stringify(roles, null, 2);
	} catch (error) {
		throw new Error(`Failed to list roles: ${error}`);
	}
}

export async function addEmoji({ server, name, imageUrl }: EmojiData): Promise<string> {
	const guild = await findServer(server);

	if (!imageUrl) {
		throw new Error('Image URL is required to add emoji');
	}

	if (!validateImageUrl(imageUrl)) {
		return `Invalid image URL: "${imageUrl}". URL must point to a valid image file (png, jpg, jpeg, gif, webp)`;
	}

	try {
		const emoji = await guild.emojis.create({ attachment: imageUrl, name });
		return `Emoji "${emoji.name}" added with ID: ${emoji.id}`;
	} catch (error) {
		throw new Error(`Failed to add emoji: ${error}`);
	}
}

export async function removeEmoji({ server, emojiName }: RemoveEmojiData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emoji = guild.emojis.cache.find((e) => e.name === emojiName);
		if (!emoji) {
			return `Emoji "${emojiName}" not found`;
		}

		await emoji.delete();
		return `Emoji "${emojiName}" removed`;
	} catch (error) {
		throw new Error(`Failed to remove emoji: ${error}`);
	}
}

export async function listEmojis({ server }: ListEmojisData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emojis = guild.emojis.cache.map((emoji) => ({
			name: emoji.name,
			id: emoji.id,
			url: emoji.url,
		}));

		return JSON.stringify(emojis, null, 2);
	} catch (error) {
		throw new Error(`Failed to list emojis: ${error}`);
	}
}

export async function unbanUser({ server, userId, reason }: UnbanUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.members.unban(userId, reason);
		return `User ${userId} unbanned`;
	} catch (error) {
		throw new Error(`Failed to unban user: ${error}`);
	}
}

export async function listBans({ server }: ListBansData): Promise<string> {
	const guild = await findServer(server);

	try {
		const bans = await guild.bans.fetch();
		const banList = bans.map((ban) => ({
			user: ban.user.tag,
			userId: ban.user.id,
			reason: ban.reason || 'No reason',
		}));

		return JSON.stringify(banList, null, 2);
	} catch (error) {
		throw new Error(`Failed to list bans: ${error}`);
	}
}

export async function moveVoiceUser({ server, user, toChannel }: MoveVoiceUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;
		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user);
		} else {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return `User "${user}" not found`;
		}

		const targetChannel = guild.channels.cache.find(
			(c) => c.type === 2 && c.name.toLowerCase() === toChannel.toLowerCase(),
		);

		if (!targetChannel) {
			return `Voice channel "${toChannel}" not found`;
		}

		await member.voice.setChannel(targetChannel.id);
		return `User ${member.user.tag} moved to voice channel "${targetChannel.name}"`;
	} catch (error) {
		throw new Error(`Failed to move voice user: ${error}`);
	}
}

export async function muteVoiceUser({ server, user, action }: MuteVoiceUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;
		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user);
		} else {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return `User "${user}" not found`;
		}

		switch (action) {
			case 'mute':
				await member.voice.setMute(true);
				return `User ${member.user.tag} muted`;
			case 'unmute':
				await member.voice.setMute(false);
				return `User ${member.user.tag} unmuted`;
			case 'deafen':
				await member.voice.setDeaf(true);
				return `User ${member.user.tag} deafened`;
			case 'undeafen':
				await member.voice.setDeaf(false);
				return `User ${member.user.tag} undeafened`;
			default:
				return `Invalid action`;
		}
	} catch (error) {
		throw new Error(`Failed to ${action} voice user: ${error}`);
	}
}
