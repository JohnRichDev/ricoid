import { Message } from 'discord.js';
import { createAIConfirmation } from './confirmationSystem.js';
import { ConfirmationTemplates } from './confirmationTemplates.js';
import { generateConfirmationContent } from '../ai/responseGenerator.js';
import {
	deleteChannel as originalDeleteChannel,
	deleteAllChannels as originalDeleteAllChannels,
	clearDiscordMessages as originalClearDiscordMessages,
	purgeChannel as originalPurgeChannel,
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
	PurgeChannelData,
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

async function withAIConfirmation<T>(
	args: any,
	originalOperation: (args: T) => Promise<string>,
	confirmationType: string,
	confirmationDetails: Record<string, any>,
	cancelMessage: string,
	timeoutMessage: string,
): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalOperation(args);
	}

	const content = await generateConfirmationContent(confirmationType, confirmationDetails);
	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: content.title,
		description: content.description,
		dangerous: confirmationDetails.dangerous ?? true,
		timeout: confirmationDetails.timeout ?? 30000,
		confirmButtonLabel: content.confirmButtonLabel,
		cancelButtonLabel: content.cancelButtonLabel,
	});

	if (!confirmation.confirmed) {
		return confirmation.timedOut ? timeoutMessage : cancelMessage;
	}

	return await originalOperation(args);
}

export async function deleteChannel(args: DeleteChannelData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalDeleteChannel(args);
	}

	const itemType = args.channelType === 'category' ? 'category' : 'channel';

	const confirmation = await ConfirmationTemplates.delete(
		currentContext.channelId,
		currentContext.userId,
		args.channelName,
		itemType,
		'This action cannot be undone.',
	);

	if (!confirmation.confirmed) {
		if (confirmation.timedOut) {
			return `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deletion timed out - **${args.channelName}** was not deleted.`;
		}
		return `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deletion cancelled - **${args.channelName}** was not deleted.`;
	}

	return await originalDeleteChannel(args);
}

export async function deleteAllChannels(args: DeleteAllChannelsData): Promise<string> {
	return withAIConfirmation(
		args,
		originalDeleteAllChannels,
		'delete_all_channels',
		{
			scope: 'all channels in server',
			excludeChannels: args.excludeChannels || [],
			excludeCategories: args.excludeCategories || [],
			permanent: true,
			dangerous: true,
			massiveDeletion: true,
			timeout: 45000,
		},
		'Mass channel deletion cancelled - no channels were deleted.',
		'Mass channel deletion timed out - no channels were deleted.',
	);
}

export async function clearDiscordMessages(args: ClearMessagesData): Promise<string> {
	const messageCount = args.messageCount || 100;
	return withAIConfirmation(
		args,
		originalClearDiscordMessages,
		'clear_messages',
		{
			channel: args.channel,
			messageCount,
			permanent: true,
			dangerous: true,
		},
		`Message clearing cancelled - no messages were deleted from #${args.channel}.`,
		`Message clearing timed out - no messages were deleted from #${args.channel}.`,
	);
}

export async function purgeChannel(args: PurgeChannelData): Promise<string> {
	return withAIConfirmation(
		args,
		originalPurgeChannel,
		'purge_channel',
		{
			channel: args.channel,
			operation: 'clone and delete original',
			removesAllMessages: true,
			bypassesAgeLimit: true,
			permanent: true,
			dangerous: true,
			criticalOperation: true,
			timeout: 45000,
		},
		`Channel purge cancelled - #${args.channel} was not purged.`,
		`Channel purge timed out - #${args.channel} was not purged.`,
	);
}

export async function moderateUser(args: ModerationData): Promise<string> {
	if (!currentContext.channelId || !currentContext.userId) {
		return await originalModerateUser(args);
	}

	const isSeriousAction = /^(ban|kick|timeout|mute|warn)$/i.test(args.action);
	if (!isSeriousAction) {
		return await originalModerateUser(args);
	}

	const content = await generateConfirmationContent('moderation', {
		action: args.action,
		user: args.user,
		reason: args.reason || 'No reason provided',
		willBeLogged: true,
		dangerous: true,
	});

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: content.title,
		description: content.description,
		dangerous: true,
		confirmButtonLabel: content.confirmButtonLabel,
		cancelButtonLabel: content.cancelButtonLabel,
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

	const isDangerousRole = /\b(admin|administrator|moderator|mod|owner|staff|manage)\b/i.test(args.roleName);

	if (!isDangerousRole && args.action === 'add') {
		return await originalManageUserRole(args);
	}

	const content = await generateConfirmationContent('role_management', {
		action: args.action,
		roleName: args.roleName,
		user: args.user,
		isAdminRole: isDangerousRole,
		affectsPermissions: true,
	});

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: content.title,
		description: content.description,
		dangerous: isDangerousRole || args.action === 'remove',
		confirmButtonLabel: content.confirmButtonLabel,
		cancelButtonLabel: content.cancelButtonLabel,
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

	const content = await generateConfirmationContent('bulk_create_channels', {
		totalChannels,
		category: args.category,
		textChannels: args.textChannels || [],
		voiceChannels: args.voiceChannels || [],
		bulkOperation: true,
	});

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: content.title,
		description: content.description,
		dangerous: false,
		confirmButtonLabel: content.confirmButtonLabel,
		cancelButtonLabel: content.cancelButtonLabel,
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

	const content = await generateConfirmationContent('create_role', {
		name: args.name,
		color: args.color,
		permissions: args.permissions || [],
		operation: 'create new role',
	});

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: content.title,
		description: content.description,
		dangerous: false,
		confirmButtonLabel: content.confirmButtonLabel,
		cancelButtonLabel: content.cancelButtonLabel,
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

	const content = await generateConfirmationContent('edit_role', {
		roleName: args.roleName,
		newName: args.newName,
		newColor: args.newColor,
		operation: 'modify role settings',
	});

	const confirmation = await createAIConfirmation(currentContext.channelId, currentContext.userId, {
		title: content.title,
		description: content.description,
		dangerous: false,
		confirmButtonLabel: content.confirmButtonLabel,
		cancelButtonLabel: content.cancelButtonLabel,
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
