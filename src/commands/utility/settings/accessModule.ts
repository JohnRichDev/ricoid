import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { resolveTarget, type ResolvedTarget } from '../../../util/resolveTarget.js';
import { writeSettings } from '../../../util/settingsStore.js';

const ACTIONS: SettingsAction[] = [
	{ name: 'View', value: 'view' },
	{ name: 'Add', value: 'add' },
	{ name: 'Remove', value: 'remove' },
];

const ALLOWED_ACTIONS = ['view', 'add', 'remove'];

function getDisplayName(resolved: ResolvedTarget, target: string): string {
	if (resolved.kind === 'member') {
		return resolved.member.user.tag;
	}

	if (resolved.kind === 'role') {
		return `@${resolved.role.name}`;
	}

	return target;
}

function initializeAccessList(settings: any): string[] {
	return settings.access ?? [];
}

function createResult(settings: any, reply: string): { settings: any; reply: string } {
	return { settings, reply };
}

async function handleAddAction(
	interaction: ChatInputCommandInteraction,
	target: string,
	updatedSettings: any,
): Promise<{ settings: any; reply: string }> {
	const resolved = await resolveTarget(interaction.guild, target);
	const display = getDisplayName(resolved, target);

	if (updatedSettings.access.includes(target)) {
		return createResult(updatedSettings, `${display} is already in the access list.`);
	}

	updatedSettings.access.push(target);
	await writeSettings(updatedSettings);
	return createResult(updatedSettings, `Added ${display} to access list.`);
}

async function handleRemoveAction(
	interaction: ChatInputCommandInteraction,
	target: string,
	updatedSettings: any,
): Promise<{ settings: any; reply: string }> {
	const resolved = await resolveTarget(interaction.guild, target);
	const display = getDisplayName(resolved, target);

	const targetIndex = updatedSettings.access.indexOf(target);
	if (targetIndex === -1) {
		return createResult(updatedSettings, `${display} was not found in the access list.`);
	}

	updatedSettings.access.splice(targetIndex, 1);
	await writeSettings(updatedSettings);
	return createResult(updatedSettings, `Removed ${display} from access list.`);
}

function handleViewAction(updatedSettings: any): { settings: any; reply: string } {
	const accessList = updatedSettings.access ?? [];
	const reply = accessList.length === 0 ? 'Access list is empty.' : `Access list:\n${accessList.join('\n')}`;

	return createResult(updatedSettings, reply);
}

function validateTargetRequirement(action: string, target: string | null): string | null {
	if (['add', 'remove'].includes(action) && !target) {
		return 'Target is required for access permission changes.';
	}
	return null;
}

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
			return createResult(settings, 'Access permissions only support **add**, **remove**, and **view** actions.');
		}

		const targetValidationError = validateTargetRequirement(action, target);
		if (targetValidationError) {
			return createResult(settings, targetValidationError);
		}

		const updatedSettings = { ...settings };
		updatedSettings.access = initializeAccessList(updatedSettings);

		switch (action) {
			case 'add':
				return handleAddAction(interaction, target as string, updatedSettings);
			case 'remove':
				return handleRemoveAction(interaction, target as string, updatedSettings);
			case 'view':
				return handleViewAction(updatedSettings);
			default:
				return createResult(settings, 'Unknown action.');
		}
	},
};
