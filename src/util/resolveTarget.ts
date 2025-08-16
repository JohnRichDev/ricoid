import type { GuildMember, Role, Guild } from 'discord.js';

export type ResolvedTarget =
	| { kind: 'member'; member: GuildMember }
	| { kind: 'role'; role: Role }
	| { kind: 'raw'; value: string };

export async function resolveTarget(guild: Guild | null | undefined, raw: string): Promise<ResolvedTarget> {
	raw = raw.trim();

	// user mention <@123> or <@!123>
	const mentionUser = raw.match(/^<@!?(\d+)>$/);
	if (mentionUser && guild) {
		const id = mentionUser[1];
		const member = await guild.members.fetch(id).catch(() => null);
		if (member) return { kind: 'member', member };
	}

	// role mention <@&123>
	const mentionRole = raw.match(/^<@&(\d+)>$/);
	if (mentionRole && guild) {
		const id = mentionRole[1];
		const role = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
		if (role) return { kind: 'role', role };
	}

	// plain id (member or role)
	if (/^\d{17,19}$/.test(raw) && guild) {
		const [member, role] = await Promise.all([
			guild.members.fetch(raw).catch(() => null),
			guild.roles.fetch(raw).catch(() => null),
		]);
		if (member) return { kind: 'member', member };
		if (role) return { kind: 'role', role };
	}

	// exact username or role name
	if (guild) {
		const byName = guild.members.cache.find((m) => m.user.username.toLowerCase() === raw.toLowerCase());
		if (byName) return { kind: 'member', member: byName };
		const byRole = guild.roles.cache.find((r) => r.name.toLowerCase() === raw.toLowerCase());
		if (byRole) return { kind: 'role', role: byRole };
	}

	// fallback to raw string
	return { kind: 'raw', value: raw };
}
