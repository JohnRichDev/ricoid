import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { resolveTarget } from '../../../util/resolveTarget.js';
import { writeSettings } from '../../../util/settingsStore.js';

const ACTIONS: SettingsAction[] = [
	{ name: 'View', value: 'view' },
	{ name: 'Add', value: 'add' },
	{ name: 'Remove', value: 'remove' },
];

const ALLOWED_ACTIONS = ['view', 'add', 'remove'];

export const accessModule: SettingsCategoryModule = {
	name: 'Access Permissions',
	value: 'access',
	actions: ACTIONS,

	isActionAllowed(action: string): boolean {
		return ALLOWED_ACTIONS.includes(action);
	},

	async execute(
		interaction: ChatInputCommandInteraction,
		action: string,
		target: string | null,
		settings: any,
	): Promise<{ settings: any; reply: string }> {
		if (!this.isActionAllowed(action)) {
			return {
				settings,
				reply: 'Access permissions only support **add**, **remove**, and **view** actions.',
			};
		}

		if (['add', 'remove'].includes(action) && !target) {
			return {
				settings,
				reply: 'Target is required for access permission changes.',
			};
		}

		const updatedSettings = { ...settings };
		updatedSettings.access = updatedSettings.access ?? [];

		if (action === 'add') {
			const resolved = await resolveTarget(interaction.guild, target!);
			const display =
				resolved.kind === 'member'
					? `${resolved.member.user.tag}`
					: resolved.kind === 'role'
						? `@${resolved.role.name}`
						: target;

			if (!updatedSettings.access.includes(target!)) {
				updatedSettings.access.push(target!);
				await writeSettings(updatedSettings);
				return {
					settings: updatedSettings,
					reply: `Added ${display} to access list.`,
				};
			} else {
				return {
					settings,
					reply: `${display} is already in the access list.`,
				};
			}
		} else if (action === 'remove') {
			const resolved = await resolveTarget(interaction.guild, target!);
			const display =
				resolved.kind === 'member'
					? `${resolved.member.user.tag}`
					: resolved.kind === 'role'
						? `@${resolved.role.name}`
						: target;

			const idx = updatedSettings.access.indexOf(target!);
			if (idx !== -1) {
				updatedSettings.access.splice(idx, 1);
				await writeSettings(updatedSettings);
				return {
					settings: updatedSettings,
					reply: `Removed ${display} from access list.`,
				};
			} else {
				return {
					settings,
					reply: `${display} was not found in the access list.`,
				};
			}
		} else if (action === 'view') {
			const list = updatedSettings.access ?? [];
			const reply = list.length === 0 ? 'Access list is empty.' : `Access list:\n${list.join('\n')}`;
			return {
				settings,
				reply,
			};
		}

		return { settings, reply: 'Unknown action.' };
	},
};
