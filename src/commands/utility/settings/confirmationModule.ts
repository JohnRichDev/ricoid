import type { SettingsCategoryModule, SettingsAction } from './types.js';
import type { ChatInputCommandInteraction } from 'discord.js';

const ACTIONS: SettingsAction[] = [
	{ name: 'View', value: 'view' },
	{ name: 'Enable', value: 'enable' },
	{ name: 'Disable', value: 'disable' },
	{ name: 'Enable All', value: 'enable-all' },
	{ name: 'Disable All', value: 'disable-all' },
];

const ALLOWED_ACTIONS = ['view', 'enable', 'disable', 'enable-all', 'disable-all'];

const CONFIRMATION_TYPES = [
	'role-create',
	'role-edit',
	'role-delete',
	'channel-create',
	'channel-delete',
	'channel-edit',
	'user-moderation',
	'bulk-operations',
	'dangerous-operations',
] as const;

type ConfirmationType = (typeof CONFIRMATION_TYPES)[number];

interface ConfirmationSettings {
	enabled: boolean;
	types: Record<ConfirmationType, boolean>;
}

function getDefaultConfirmationSettings(): ConfirmationSettings {
	const types = {} as Record<ConfirmationType, boolean>;
	CONFIRMATION_TYPES.forEach((type) => {
		types[type] = type.includes('delete') || type.includes('moderation') || type.includes('dangerous');
	});

	return {
		enabled: true,
		types,
	};
}

function getConfirmationSettings(settings: any): ConfirmationSettings {
	if (!settings.confirmations) {
		return getDefaultConfirmationSettings();
	}

	const defaultSettings = getDefaultConfirmationSettings();
	return {
		enabled: settings.confirmations.enabled ?? defaultSettings.enabled,
		types: { ...defaultSettings.types, ...(settings.confirmations.types || {}) },
	};
}

function formatConfirmationsList(confirmationSettings: ConfirmationSettings): string {
	if (!confirmationSettings.enabled) {
		return '❌ **All confirmations are globally disabled**';
	}

	const lines: string[] = ['**Confirmation Settings:**'];

	const groupedTypes = {
		'Role Operations': ['role-create', 'role-edit', 'role-delete'],
		'Channel Operations': ['channel-create', 'channel-edit', 'channel-delete'],
		'User & Safety': ['user-moderation', 'dangerous-operations'],
		'Bulk Operations': ['bulk-operations'],
	} as const;

	for (const [group, types] of Object.entries(groupedTypes)) {
		lines.push(`\n**${group}:**`);
		for (const type of types) {
			const status = confirmationSettings.types[type as ConfirmationType] ? '✅' : '❌';
			const displayName = type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
			lines.push(`${status} ${displayName}`);
		}
	}

	lines.push('\n*Use `/settings confirmations enable/disable <type>` to change individual settings*');
	lines.push('*Use `/settings confirmations enable-all/disable-all` to change all at once*');

	return lines.join('\n');
}

async function handleEnableAction(
	target: string | null,
	updatedSettings: any,
): Promise<{ settings: any; reply: string }> {
	const confirmationSettings = getConfirmationSettings(updatedSettings);

	if (!target) {
		return {
			settings: updatedSettings,
			reply:
				'❌ Please specify which confirmation type to enable. Valid types:\n' +
				CONFIRMATION_TYPES.map((type) => `• \`${type}\``).join('\n'),
		};
	}

	const normalizedTarget = target.toLowerCase().replace(/\s+/g, '-');

	if (!CONFIRMATION_TYPES.includes(normalizedTarget as ConfirmationType)) {
		return {
			settings: updatedSettings,
			reply:
				`❌ Invalid confirmation type: \`${target}\`\n\nValid types:\n` +
				CONFIRMATION_TYPES.map((type) => `• \`${type}\``).join('\n'),
		};
	}

	confirmationSettings.types[normalizedTarget as ConfirmationType] = true;
	updatedSettings.confirmations = confirmationSettings;

	const displayName = normalizedTarget.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	return {
		settings: updatedSettings,
		reply: `✅ **${displayName}** confirmations have been **enabled**.`,
	};
}

async function handleDisableAction(
	target: string | null,
	updatedSettings: any,
): Promise<{ settings: any; reply: string }> {
	const confirmationSettings = getConfirmationSettings(updatedSettings);

	if (!target) {
		return {
			settings: updatedSettings,
			reply:
				'❌ Please specify which confirmation type to disable. Valid types:\n' +
				CONFIRMATION_TYPES.map((type) => `• \`${type}\``).join('\n'),
		};
	}

	const normalizedTarget = target.toLowerCase().replace(/\s+/g, '-');

	if (!CONFIRMATION_TYPES.includes(normalizedTarget as ConfirmationType)) {
		return {
			settings: updatedSettings,
			reply:
				`❌ Invalid confirmation type: \`${target}\`\n\nValid types:\n` +
				CONFIRMATION_TYPES.map((type) => `• \`${type}\``).join('\n'),
		};
	}

	confirmationSettings.types[normalizedTarget as ConfirmationType] = false;
	updatedSettings.confirmations = confirmationSettings;

	const displayName = normalizedTarget.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	return {
		settings: updatedSettings,
		reply: `❌ **${displayName}** confirmations have been **disabled**.`,
	};
}

async function handleEnableAllAction(updatedSettings: any): Promise<{ settings: any; reply: string }> {
	const confirmationSettings = getConfirmationSettings(updatedSettings);

	confirmationSettings.enabled = true;
	CONFIRMATION_TYPES.forEach((type) => {
		confirmationSettings.types[type] = true;
	});

	updatedSettings.confirmations = confirmationSettings;

	return {
		settings: updatedSettings,
		reply: '✅ **All confirmations have been enabled**.',
	};
}

async function handleDisableAllAction(updatedSettings: any): Promise<{ settings: any; reply: string }> {
	const confirmationSettings = getConfirmationSettings(updatedSettings);

	confirmationSettings.enabled = false;
	CONFIRMATION_TYPES.forEach((type) => {
		confirmationSettings.types[type] = false;
	});

	updatedSettings.confirmations = confirmationSettings;

	return {
		settings: updatedSettings,
		reply: '❌ **All confirmations have been disabled**.',
	};
}

export const confirmationModule: SettingsCategoryModule = {
	name: 'Confirmations',
	value: 'confirmations',
	actions: ACTIONS,

	async execute(
		_interaction: ChatInputCommandInteraction,
		action: string,
		target: string | null,
		settings: any,
	): Promise<{ settings: any; reply: string }> {
		const updatedSettings = { ...settings };

		switch (action) {
			case 'view': {
				const confirmationSettings = getConfirmationSettings(settings);
				return { settings, reply: formatConfirmationsList(confirmationSettings) };
			}

			case 'enable':
				return await handleEnableAction(target, updatedSettings);

			case 'disable':
				return await handleDisableAction(target, updatedSettings);

			case 'enable-all':
				return await handleEnableAllAction(updatedSettings);

			case 'disable-all':
				return await handleDisableAllAction(updatedSettings);

			default:
				return { settings, reply: `❌ Unknown action: \`${action}\`` };
		}
	},

	isActionAllowed(action: string): boolean {
		return ALLOWED_ACTIONS.includes(action);
	},
};

export function shouldShowConfirmation(settings: any, type: ConfirmationType): boolean {
	const confirmationSettings = getConfirmationSettings(settings);
	return confirmationSettings.enabled && confirmationSettings.types[type];
}

export { CONFIRMATION_TYPES };
export type { ConfirmationType };
