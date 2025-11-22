import type {
	CloneRoleData,
	GiveRoleToAllData,
	RemoveRoleFromAllData,
	CreateRoleMenuData,
	SyncPermissionsData,
} from '../../types/index.js';
import { findServer } from './core.js';

export async function cloneRole({ server, roleName, newName }: CloneRoleData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return JSON.stringify({ error: 'role_not_found', roleName });
		}

		const clonedRole = await guild.roles.create({
			name: newName || `${role.name} (Copy)`,
			color: role.color,
			permissions: role.permissions,
			hoist: role.hoist,
			mentionable: role.mentionable,
			reason: `Cloned from ${role.name}`,
		});

		return JSON.stringify({
			action: 'role_cloned',
			originalRole: role.name,
			newRole: clonedRole.name,
			newRoleId: clonedRole.id,
		});
	} catch (error) {
		throw new Error(`Failed to clone role: ${error}`);
	}
}

export async function giveRoleToAll({ server, roleName, filter }: GiveRoleToAllData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return JSON.stringify({ error: 'role_not_found', roleName });
		}

		await guild.members.fetch();
		let members = Array.from(guild.members.cache.values());

		if (filter === 'bots') {
			members = members.filter((m) => m.user.bot);
		} else if (filter === 'humans') {
			members = members.filter((m) => !m.user.bot);
		}

		const added = [];
		for (const member of members) {
			if (!member.roles.cache.has(role.id)) {
				try {
					await member.roles.add(role);
					added.push(member.user.username);
				} catch {
					continue;
				}
			}
		}

		return JSON.stringify({
			action: 'role_given_to_all',
			role: role.name,
			added: added.length,
			filter: filter || 'all',
		});
	} catch (error) {
		throw new Error(`Failed to give role to all: ${error}`);
	}
}

export async function removeRoleFromAll({ server, roleName }: RemoveRoleFromAllData): Promise<string> {
	const guild = await findServer(server);

	try {
		const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
		if (!role) {
			return JSON.stringify({ error: 'role_not_found', roleName });
		}

		const removed = [];
		for (const member of role.members.values()) {
			try {
				await member.roles.remove(role);
				removed.push(member.user.username);
			} catch {
				continue;
			}
		}

		return JSON.stringify({
			action: 'role_removed_from_all',
			role: role.name,
			removed: removed.length,
		});
	} catch (error) {
		throw new Error(`Failed to remove role from all: ${error}`);
	}
}

export async function createRoleMenu({ server, channel, title, roles }: CreateRoleMenuData): Promise<string> {
	return JSON.stringify({
		note: 'Role menu creation requires button interaction handlers. Store configuration in settings.',
		server,
		channel,
		title,
		roles: roles.length,
	});
}

export async function syncPermissions({ server, category }: SyncPermissionsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const categoryChannel = guild.channels.cache.find(
			(c) => c.name.toLowerCase() === category.toLowerCase() && c.type === 4,
		);

		if (!categoryChannel) {
			return JSON.stringify({ error: 'category_not_found', category });
		}

		const children = guild.channels.cache.filter((c) => c.parentId === categoryChannel.id);

		let synced = 0;
		for (const child of children.values()) {
			try {
				if ('lockPermissions' in child && typeof child.lockPermissions === 'function') {
					await child.lockPermissions();
					synced++;
				}
			} catch {
				continue;
			}
		}

		return JSON.stringify({
			action: 'permissions_synced',
			category: categoryChannel.name,
			channelsSynced: synced,
			totalChildren: children.size,
		});
	} catch (error) {
		throw new Error(`Failed to sync permissions: ${error}`);
	}
}
