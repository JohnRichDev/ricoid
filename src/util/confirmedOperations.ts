import { Message } from 'discord.js';
import { createAIConfirmation } from './confirmationSystem.js';
import { ConfirmationTemplates } from './confirmationTemplates.js';
import {
	deleteChannel as originalDeleteChannel,
	deleteAllChannels as originalDeleteAllChannels,
	clearDiscordMessages as originalClearDiscordMessages,
	moderateUser as originalModerateUser,
	manageUserRole as originalManageUserRole,
	bulkCreateChannels as originalBulkCreateChannels,
	createRole as originalCreateRole,
	editRole as originalEditRole,
	deleteRole as originalDeleteRole,
} from '../discord/operations.js';
import type {
	DeleteChannelData,
	DeleteAllChannelsData,
	ClearMessagesData,
	ModerationData,
	RoleManagementData,
	BulkCreateChannelsData,
	CreateRoleData,
	EditRoleData,
	DeleteRoleData,
} from '../types/index.js';
import { readSettings } from './settingsStore.js';
import { shouldShowConfirmation } from '../commands/utility/settings/confirmationModule.js';

interface OperationContext {
	message?: Message;
	userId?: string;
	channelId?: string;
}

let currentContext: OperationContext = {};

export function setOperationContext(context: OperationContext) {
	currentContext = context;
}

export function clearOperationContext() {
	currentContext = {};
}

export async function deleteChannel(args: DeleteChannelData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalDeleteChannel(args);
	}

	const confirmation = await ConfirmationTemplates.delete(
		currentContext.channelId,
		currentContext.userId,
		args.channelName,
		'channel',
		'This action cannot be undone.',
	);

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Channel deletion timed out - **${args.channelName}** was not deleted.`;
		}
		return `Channel deletion cancelled - **${args.channelName}** was not deleted.`;
	}

	return await originalDeleteChannel(args);
}

export async function deleteAllChannels(args: DeleteAllChannelsData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalDeleteAllChannels(args);
	}

	const excludeText =
		args.excludeChannels && args.excludeChannels.length > 0
			? `\n\n**Excluded channels:** ${args.excludeChannels.join(', ')}`
			: '';

	const excludeCatText =
		args.excludeCategories && args.excludeCategories.length > 0
			? `\n\n**Excluded categories:** ${args.excludeCategories.join(', ')}`
			: '';

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: '🚨 Delete ALL Channels',
		description: `Are you sure you want to delete **ALL** channels in the server?${excludeText}${excludeCatText}\n\n⚠️ **This action cannot be undone and will remove ALL channels!**`,
		dangerous: true,
		timeout: 45000,
		confirmButtonLabel: 'Delete All',
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return 'Mass channel deletion timed out - no channels were deleted.';
		}
		return 'Mass channel deletion cancelled - no channels were deleted.';
	}

	return await originalDeleteAllChannels(args);
}

export async function clearDiscordMessages(args: ClearMessagesData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalClearDiscordMessages(args);
	}

	const messageCount = args.messageCount || 100;
	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: '🧹 Clear Messages',
		description: `Are you sure you want to clear **${messageCount}** messages from **#${args.channel}**?\n\nThis action cannot be undone.`,
		dangerous: true,
		confirmButtonLabel: 'Clear Messages',
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Message clearing timed out - no messages were deleted from #${args.channel}.`;
		}
		return `Message clearing cancelled - no messages were deleted from #${args.channel}.`;
	}

	return await originalClearDiscordMessages(args);
}

export async function moderateUser(args: ModerationData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalModerateUser(args);
	}

	const seriousActions = ['ban', 'kick', 'timeout'];
	if (!seriousActions.includes(args.action)) {
		return await originalModerateUser(args);
	}

	const actionEmojis: { [key: string]: string } = {
		ban: '🔨',
		kick: '👢',
		timeout: '⏰',
	};

	const actionDescriptions: { [key: string]: string } = {
		ban: 'permanently ban',
		kick: 'kick',
		timeout: 'timeout',
	};

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: `${actionEmojis[args.action]} ${args.action.charAt(0).toUpperCase() + args.action.slice(1)} User`,
		description: `Are you sure you want to **${actionDescriptions[args.action]}** **${args.user}**?\n\n${args.reason ? `**Reason:** ${args.reason}` : 'No reason provided.'}\n\nThis moderation action will be logged.`,
		dangerous: true,
		confirmButtonLabel: args.action.charAt(0).toUpperCase() + args.action.slice(1),
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `${args.action} action timed out - no action was taken against ${args.user}.`;
		}
		return `${args.action} action cancelled - no action was taken against ${args.user}.`;
	}

	return await originalModerateUser(args);
}

export async function manageUserRole(args: RoleManagementData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalManageUserRole(args);
	}

	const dangerousRoles = ['admin', 'administrator', 'moderator', 'mod', 'owner', 'staff'];
	const isDangerousRole = dangerousRoles.some((role) => args.roleName.toLowerCase().includes(role));

	if (!isDangerousRole && args.action === 'add') {
		return await originalManageUserRole(args);
	}

	const actionEmoji = args.action === 'add' ? '➕' : '➖';
	const actionText = args.action === 'add' ? 'give' : 'remove';
	const roleTypeText = isDangerousRole ? ' (admin/mod role)' : '';

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: `${actionEmoji} ${args.action === 'add' ? 'Add' : 'Remove'} Role`,
		description: `Are you sure you want to **${actionText}** the role **${args.roleName}**${roleTypeText} ${args.action === 'add' ? 'to' : 'from'} **${args.user}**?\n\nThis will change their permissions in the server.`,
		dangerous: isDangerousRole || args.action === 'remove',
		confirmButtonLabel: args.action === 'add' ? 'Add Role' : 'Remove Role',
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Role ${args.action} timed out - no changes made to ${args.user}'s roles.`;
		}
		return `Role ${args.action} cancelled - no changes made to ${args.user}'s roles.`;
	}

	return await originalManageUserRole(args);
}

export async function bulkCreateChannels(args: BulkCreateChannelsData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalBulkCreateChannels(args);
	}

	const totalChannels = (args.textChannels?.length || 0) + (args.voiceChannels?.length || 0);

	if (totalChannels <= 3) {
		return await originalBulkCreateChannels(args);
	}

	const textChannelsList = args.textChannels?.length ? `\n**Text channels:** ${args.textChannels.join(', ')}` : '';
	const voiceChannelsList = args.voiceChannels?.length ? `\n**Voice channels:** ${args.voiceChannels.join(', ')}` : '';

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: '📁 Create Multiple Channels',
		description: `Are you sure you want to create **${totalChannels} channels** in the **${args.category}** category?${textChannelsList}${voiceChannelsList}\n\nThis will create multiple channels at once.`,
		dangerous: false,
		confirmButtonLabel: 'Create Channels',
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Bulk channel creation timed out - no channels were created.`;
		}
		return `Bulk channel creation cancelled - no channels were created.`;
	}

	return await originalBulkCreateChannels(args);
}

export async function createRole(args: CreateRoleData): Promise<string> {
	const settings = await readSettings();

	if (!currentContext.channelId || !currentContext.userId || !shouldShowConfirmation(settings, 'role-create')) {
		return await originalCreateRole(args);
	}

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: '✨ Create Role',
		description: `Are you sure you want to create the role **${args.name}**?${args.color ? `\n**Color:** ${args.color}` : ''}${args.permissions?.length ? `\n**Permissions:** ${args.permissions.join(', ')}` : ''}\n\nThis will create a new role in the server.`,
		dangerous: false,
		confirmButtonLabel: 'Create Role',
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Role creation timed out - **${args.name}** was not created.`;
		}
		return `Role creation cancelled - **${args.name}** was not created.`;
	}

	return await originalCreateRole(args);
}

export async function editRole(args: EditRoleData): Promise<string> {
	const settings = await readSettings();

	if (!currentContext.channelId || !currentContext.userId || !shouldShowConfirmation(settings, 'role-edit')) {
		return await originalEditRole(args);
	}

	const changes: string[] = [];
	if (args.newName) changes.push(`Name: **${args.newName}**`);
	if (args.newColor) changes.push(`Color: **${args.newColor}**`);
	const changesText = changes.length ? `\n**Changes:**\n${changes.map((c) => `• ${c}`).join('\n')}` : '';

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: '✏️ Edit Role',
		description: `Are you sure you want to edit the role **${args.roleName}**?${changesText}\n\nThis will modify the role settings.`,
		dangerous: false,
		confirmButtonLabel: 'Edit Role',
	});

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Role editing timed out - **${args.roleName}** was not modified.`;
		}
		return `Role editing cancelled - **${args.roleName}** was not modified.`;
	}

	return await originalEditRole(args);
}

export async function deleteRole(args: DeleteRoleData): Promise<string> {
	const settings = await readSettings();

	if (!currentContext.channelId || !currentContext.userId || !shouldShowConfirmation(settings, 'role-delete')) {
		return await originalDeleteRole(args);
	}

	const confirmation = await ConfirmationTemplates.delete(
		currentContext.channelId,
		currentContext.userId,
		args.roleName,
		'role',
		'This action cannot be undone. Users with this role will lose it permanently.',
	);

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `Role deletion timed out - **${args.roleName}** was not deleted.`;
		}
		return `Role deletion cancelled - **${args.roleName}** was not deleted.`;
	}

	return await originalDeleteRole(args);
}
