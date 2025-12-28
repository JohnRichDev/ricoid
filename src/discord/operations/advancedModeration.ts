import type {
	WarnUserData,
	ListWarningsData,
	ClearWarningsData,
	AutomodData,
	MuteUserData,
	LockChannelData,
	MassKickData,
	MassBanData,
} from '../../types/index.js';
import { findServer, findTextChannel } from './core.js';
import { GuildMember } from 'discord.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { ERROR_MESSAGES, OPERATION_REASONS } from '../../util/constants.js';

const WARNINGS_FILE = join(process.cwd(), 'data', 'warnings.json');

async function loadWarnings(): Promise<Record<string, any[]>> {
	try {
		const data = await readFile(WARNINGS_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return {};
	}
}

async function saveWarnings(warnings: Record<string, any[]>): Promise<void> {
	await writeFile(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
}

async function resolveMember(guild: any, user: string): Promise<GuildMember | undefined> {
	if (!user) return undefined;

	// Attempt direct fetch by ID if it looks like one
	if (/^\d{17,19}$/.test(user)) {
		const fetched = await guild.members.fetch(user).catch(() => undefined);
		if (fetched) return fetched;
	}

	// Fallback to cache search by username or display name
	return guild.members.cache.find(
		(m: GuildMember) =>
			m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
	);
}

export async function warnUser({ server, user, reason, moderator }: WarnUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		const member = await resolveMember(guild, user);

		if (!member) return JSON.stringify({ error: 'user_not_found', user });

		const warnings = await loadWarnings();
		const userId = member.user.id;

		if (!warnings[userId]) {
			warnings[userId] = [];
		}

		const warning = {
			id: Date.now().toString(),
			reason,
			moderator,
			timestamp: new Date().toISOString(),
			serverId: guild.id,
			serverName: guild.name,
		};

		warnings[userId].push(warning);
		await saveWarnings(warnings);

		return JSON.stringify({
			action: 'warned',
			user: member.user.username,
			userId,
			totalWarnings: warnings[userId].length,
			warning,
		});
	} catch (error) {
		throw new Error(`Failed to warn user: ${error}`);
	}
}

export async function listWarnings({ server, user }: ListWarningsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const member = await resolveMember(guild, user);

		if (!member) return JSON.stringify({ error: 'user_not_found', user });

		const warnings = await loadWarnings();
		const userId = member.user.id;
		const userWarnings = warnings[userId] || [];

		return JSON.stringify({
			user: member.user.username,
			userId,
			totalWarnings: userWarnings.length,
			warnings: userWarnings,
		});
	} catch (error) {
		throw new Error(`Failed to list warnings: ${error}`);
	}
}

export async function clearWarnings({ server, user, warningId }: ClearWarningsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const member = await resolveMember(guild, user);

		if (!member) return JSON.stringify({ error: 'user_not_found', user });

		const warnings = await loadWarnings();
		const userId = member.user.id;

		if (!warnings[userId] || warnings[userId].length === 0) {
			return JSON.stringify({ error: 'no_warnings', user: member.user.username });
		}

		if (warningId) {
			const index = warnings[userId].findIndex((w) => w.id === warningId);
			if (index === -1) {
				return JSON.stringify({ error: 'warning_not_found', warningId });
			}
			warnings[userId].splice(index, 1);
		} else {
			warnings[userId] = [];
		}

		await saveWarnings(warnings);

		return JSON.stringify({
			action: 'warnings_cleared',
			user: member.user.username,
			userId,
			remainingWarnings: warnings[userId].length,
		});
	} catch (error) {
		throw new Error(`Failed to clear warnings: ${error}`);
	}
}

export async function automod({ action, bannedWords, maxMentions }: AutomodData): Promise<string> {
	return JSON.stringify({
		note: 'Automod rules configured. Implementation requires event listener in messageCreate event.',
		action,
		bannedWords: bannedWords?.length || 0,
		maxMentions: maxMentions || 'not set',
	});
}

export async function muteUser({ server, user, reason }: MuteUserData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member: GuildMember | undefined;
		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user).catch(() => undefined);
		}

		if (!member) {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return JSON.stringify({ error: 'user_not_found', user });
		}

		let muteRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'muted');

		if (!muteRole) {
			muteRole = await guild.roles.create({
				name: 'Muted',
				permissions: [],
				reason: 'Auto-created mute role',
			});

			for (const channel of guild.channels.cache.values()) {
				if ('permissionOverwrites' in channel) {
					await channel.permissionOverwrites.create(muteRole, {
						SendMessages: false,
						Speak: false,
						AddReactions: false,
					});
				}
			}
		}

		await member.roles.add(muteRole, reason || 'Muted by moderator');

		return JSON.stringify({
			action: 'muted',
			user: member.user.username,
			userId: member.user.id,
			reason,
		});
	} catch (error) {
		throw new Error(`Failed to mute user: ${error}`);
	}
}

export async function lockChannel({ server, channel, locked }: LockChannelData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);
	const guild = textChannel.guild;

	try {
		const everyoneRole = guild.roles.everyone;

		await textChannel.permissionOverwrites.edit(everyoneRole, {
			SendMessages: !locked,
		});

		return JSON.stringify({
			action: locked ? 'locked' : 'unlocked',
			channel: textChannel.name,
			channelId: textChannel.id,
		});
	} catch (error) {
		throw new Error(`Failed to lock/unlock channel: ${error}`);
	}
}

function filterMembersToKick(members: any, criteria: string): any[] {
	const toKick: any[] = [];
	for (const member of members.values()) {
		const shouldKick =
			(member.user.bot && criteria === 'bots') || (criteria === 'no_roles' && member.roles.cache.size === 1);

		if (shouldKick) {
			toKick.push(member);
		}
	}
	return toKick;
}

async function performMassKick(members: any[], reason?: string): Promise<string[]> {
	const kicked = [];
	for (const member of members) {
		try {
			await member.kick(reason || OPERATION_REASONS.MASS_KICK);
			kicked.push(member.user.username);
		} catch (error) {
			console.error(`${ERROR_MESSAGES.MASS_KICK_FAILED_PREFIX}:`, error);
			continue;
		}
	}
	return kicked;
}

async function performMassBan(
	guild: any,
	userIds: string[],
	reason?: string,
): Promise<{ banned: string[]; failed: string[] }> {
	const banned = [];
	const failed = [];

	for (const userId of userIds) {
		try {
			await guild.members.ban(userId, { reason: reason || OPERATION_REASONS.MASS_BAN });
			banned.push(userId);
		} catch (error) {
			console.error(`${ERROR_MESSAGES.MASS_BAN_FAILED_PREFIX} ${userId}:`, error);
			failed.push(userId);
		}
	}

	return { banned, failed };
}

export async function massKick({ server, criteria, reason }: MassKickData): Promise<string> {
	const guild = await findServer(server);

	try {
		await guild.members.fetch();
		const members = guild.members.cache;

		const toKick = filterMembersToKick(members, criteria);

		const kicked = await performMassKick(toKick, reason);

		return JSON.stringify({
			action: 'mass_kick',
			criteria,
			kicked: kicked.length,
			total: toKick.length,
			users: kicked,
		});
	} catch (error) {
		throw new Error(`Failed to mass kick: ${error}`);
	}
}

export async function massBan({ server, userIds, reason }: MassBanData): Promise<string> {
	const guild = await findServer(server);

	try {
		const { banned, failed } = await performMassBan(guild, userIds, reason);

		return JSON.stringify({
			action: 'mass_ban',
			banned: banned.length,
			failed: failed.length,
			total: userIds.length,
			bannedIds: banned,
		});
	} catch (error) {
		throw new Error(`Failed to mass ban: ${error}`);
	}
}
