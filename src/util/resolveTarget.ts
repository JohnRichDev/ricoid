import type { GuildMember, Role, Guild } from 'discord.js';

export type ResolvedTarget =
	| { kind: 'member'; member: GuildMember }
	| { kind: 'role'; role: Role }
	| { kind: 'raw'; value: string };

async function tryResolveMentionUser(guild: Guild, raw: string): Promise<GuildMember | null> {
	const mentionUser = raw.match(/^<@!?(\d+)>$/);
	if (!mentionUser) return null;

	const id = mentionUser[1];
	return await guild.members.fetch(id).catch(() => null);
}

async function tryResolveMentionRole(guild: Guild, raw: string): Promise<Role | null> {
	const mentionRole = raw.match(/^<@&(\d+)>$/);
	if (!mentionRole) return null;

	const id = mentionRole[1];
	return guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
}

async function tryResolveById(guild: Guild, raw: string): Promise<GuildMember | Role | null> {
	if (!/^\d{17,19}$/.test(raw)) return null;

	const [member, role] = await Promise.all([
		guild.members.fetch(raw).catch(() => null),
		guild.roles.fetch(raw).catch(() => null),
	]);

	return member || role || null;
}

function tryResolveByName(guild: Guild, raw: string): GuildMember | Role | null {
	const lowercaseRaw = raw.toLowerCase();

	const byName = guild.members.cache.find((m) => m.user.username.toLowerCase() === lowercaseRaw);
	if (byName) return byName;

	const byRole = guild.roles.cache.find((r) => r.name.toLowerCase() === lowercaseRaw);
	return byRole || null;
}

export async function resolveTarget(guild: Guild | null | undefined, raw: string): Promise<ResolvedTarget> {
	raw = raw.trim();

	if (!guild) {
		return { kind: 'raw', value: raw };
	}

	const mentionUser = await tryResolveMentionUser(guild, raw);
	if (mentionUser) return { kind: 'member', member: mentionUser };

	const mentionRole = await tryResolveMentionRole(guild, raw);
	if (mentionRole) return { kind: 'role', role: mentionRole };

	const byId = await tryResolveById(guild, raw);
	if (byId) {
		return 'user' in byId ? { kind: 'member', member: byId as GuildMember } : { kind: 'role', role: byId as Role };
	}

	const byName = tryResolveByName(guild, raw);
	if (byName) {
		return 'user' in byName
			? { kind: 'member', member: byName as GuildMember }
			: { kind: 'role', role: byName as Role };
	}

	return { kind: 'raw', value: raw };
}
