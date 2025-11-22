import type {
	CloneChannelData,
	CreateTemplateData,
	ApplyTemplateData,
	BackupServerData,
	RestoreServerData,
	JoinLeaveStatsData,
	NicknameHistoryData,
} from '../../types/index.js';
import { findServer } from './core.js';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

export async function cloneChannel({ server, channelName }: CloneChannelData): Promise<string> {
	const guild = await findServer(server);

	try {
		const channel = guild.channels.cache.find((c) => c.name.toLowerCase() === channelName.toLowerCase());
		if (!channel) {
			return JSON.stringify({ error: 'channel_not_found', channelName });
		}

		if (!('clone' in channel) || typeof channel.clone !== 'function') {
			return JSON.stringify({ error: 'channel_not_cloneable', channelName, type: channel.type });
		}

		const clonedChannel = await channel.clone({
			name: `${channel.name}-copy`,
			reason: `Cloned from ${channel.name}`,
		});

		return JSON.stringify({
			action: 'channel_cloned',
			originalChannel: channel.name,
			newChannel: clonedChannel.name,
			newChannelId: clonedChannel.id,
		});
	} catch (error) {
		throw new Error(`Failed to clone channel: ${error}`);
	}
}

export async function createTemplate({ server, templateName }: CreateTemplateData): Promise<string> {
	const guild = await findServer(server);

	try {
		const template = {
			name: templateName,
			created: new Date().toISOString(),
			serverId: guild.id,
			serverName: guild.name,
			categories: [] as any[],
			roles: [] as any[],
		};

		for (const channel of guild.channels.cache.values()) {
			if (channel.type === 4) {
				template.categories.push({
					name: channel.name,
					position: 'position' in channel ? channel.position : 0,
					children: guild.channels.cache
						.filter((c) => c.parentId === channel.id)
						.map((c) => ({
							name: c.name,
							type: c.type,
							position: 'position' in c ? c.position : 0,
						})),
				});
			}
		}

		for (const role of guild.roles.cache.values()) {
			if (role.id !== guild.id) {
				template.roles.push({
					name: role.name,
					color: role.hexColor,
					permissions: role.permissions.toArray(),
					hoist: role.hoist,
					mentionable: role.mentionable,
				});
			}
		}

		const filename = `template_${templateName}_${Date.now()}.json`;
		const filepath = join(process.cwd(), 'data', filename);
		await writeFile(filepath, JSON.stringify(template, null, 2));

		return JSON.stringify({
			action: 'template_created',
			templateName,
			filename,
			categories: template.categories.length,
			roles: template.roles.length,
		});
	} catch (error) {
		throw new Error(`Failed to create template: ${error}`);
	}
}

export async function applyTemplate({ server, templateFile }: ApplyTemplateData): Promise<string> {
	const guild = await findServer(server);

	try {
		const filepath = join(process.cwd(), 'data', templateFile);
		const templateData = await readFile(filepath, 'utf-8');
		const template = JSON.parse(templateData);

		for (const roleData of template.roles) {
			try {
				await guild.roles.create({
					name: roleData.name,
					color: roleData.color,
					permissions: roleData.permissions,
					hoist: roleData.hoist,
					mentionable: roleData.mentionable,
				});
			} catch {
				continue;
			}
		}

		for (const categoryData of template.categories) {
			try {
				const category = await guild.channels.create({
					name: categoryData.name,
					type: 4,
					position: categoryData.position,
				});

				for (const childData of categoryData.children) {
					await guild.channels.create({
						name: childData.name,
						type: childData.type,
						parent: category.id,
						position: childData.position,
					});
				}
			} catch {
				continue;
			}
		}

		return JSON.stringify({
			action: 'template_applied',
			templateName: template.name,
			server: guild.name,
		});
	} catch (error) {
		throw new Error(`Failed to apply template: ${error}`);
	}
}

export async function backupServer({ server }: BackupServerData): Promise<string> {
	const guild = await findServer(server);

	try {
		const backup = {
			serverId: guild.id,
			serverName: guild.name,
			created: new Date().toISOString(),
			channels: [] as any[],
			roles: [] as any[],
			settings: {
				icon: guild.iconURL(),
				description: guild.description,
				verificationLevel: guild.verificationLevel,
			},
		};

		for (const channel of guild.channels.cache.values()) {
			backup.channels.push({
				id: channel.id,
				name: channel.name,
				type: channel.type,
				position: 'position' in channel ? channel.position : 0,
				parentId: channel.parentId,
				permissions:
					'permissionOverwrites' in channel
						? channel.permissionOverwrites.cache.map((p: any) => ({
								id: p.id,
								type: p.type,
								allow: p.allow.toArray(),
								deny: p.deny.toArray(),
							}))
						: [],
			});
		}

		for (const role of guild.roles.cache.values()) {
			backup.roles.push({
				id: role.id,
				name: role.name,
				color: role.hexColor,
				permissions: role.permissions.toArray(),
				position: role.position,
				hoist: role.hoist,
				mentionable: role.mentionable,
			});
		}

		const filename = `backup_${guild.name}_${Date.now()}.json`;
		const filepath = join(process.cwd(), 'data', filename);
		await writeFile(filepath, JSON.stringify(backup, null, 2));

		return JSON.stringify({
			action: 'backup_created',
			server: guild.name,
			filename,
			channels: backup.channels.length,
			roles: backup.roles.length,
		});
	} catch (error) {
		throw new Error(`Failed to backup server: ${error}`);
	}
}

export async function restoreServer({ backupFile }: RestoreServerData): Promise<string> {
	return JSON.stringify({
		note: 'Full server restore is dangerous and requires manual confirmation',
		backupFile,
		warning: 'This would delete existing channels/roles and recreate from backup',
	});
}

export async function getJoinLeaveStats({ server, days = 7 }: JoinLeaveStatsData): Promise<string> {
	return JSON.stringify({
		note: 'Join/leave tracking requires persistent event logging',
		server,
		days,
		suggestion: 'Implement in guildMemberAdd/guildMemberRemove events',
	});
}

export async function getNicknameHistory({ server, user }: NicknameHistoryData): Promise<string> {
	return JSON.stringify({
		note: 'Nickname history requires persistent event logging',
		server,
		user,
		suggestion: 'Implement in guildMemberUpdate event',
	});
}
