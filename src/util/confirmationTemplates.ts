import type { ConfirmationConfig, ConfirmationResult } from './confirmationSystem.js';
import { createAIConfirmation } from './confirmationSystem.js';

export class ConfirmationTemplates {
	static async delete(
		channelId: string,
		userId: string,
		itemName: string,
		itemType: string = 'item',
		additionalInfo?: string,
	): Promise<ConfirmationResult> {
		const additionalInfoText = additionalInfo ? `\n\n${additionalInfo}` : '';
		const description = `Are you sure you want to delete **${itemName}**?${additionalInfoText}\n\nThis action cannot be undone.`;

		return createAIConfirmation(channelId, userId, {
			title: `🗑️ Delete ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`,
			description,
			dangerous: true,
			confirmButtonLabel: 'Delete',
		});
	}

	static async moderate(
		channelId: string,
		userId: string,
		action: string,
		targetUser: string,
		reason?: string,
		duration?: string,
	): Promise<ConfirmationResult> {
		const actionEmojis: Record<string, string> = {
			ban: '🔨',
			kick: '👢',
			timeout: '⏰',
			mute: '🔇',
			warn: '⚠️',
			unban: '🔓',
		};

		const durationText = duration ? `\n**Duration:** ${duration}` : '';
		const reasonText = reason ? `\n**Reason:** ${reason}` : '\n*No reason provided*';

		return createAIConfirmation(channelId, userId, {
			title: `${actionEmojis[action] || '🛡️'} ${action.charAt(0).toUpperCase() + action.slice(1)} User`,
			description: `Are you sure you want to **${action}** **${targetUser}**?${reasonText}${durationText}\n\nThis moderation action will be logged.`,
			dangerous: ['ban', 'kick', 'timeout'].includes(action),
			confirmButtonLabel: action.charAt(0).toUpperCase() + action.slice(1),
		});
	}

	static async manageRole(
		channelId: string,
		userId: string,
		action: 'add' | 'remove',
		roleName: string,
		targetUser: string,
		isAdminRole: boolean = false,
	): Promise<ConfirmationResult> {
		const actionEmoji = action === 'add' ? '➕' : '➖';
		const actionText = action === 'add' ? 'give' : 'remove';
		const preposition = action === 'add' ? 'to' : 'from';
		const roleType = isAdminRole ? ' (admin/moderator role)' : '';

		return createAIConfirmation(channelId, userId, {
			title: `${actionEmoji} ${action === 'add' ? 'Add' : 'Remove'} Role`,
			description: `Are you sure you want to **${actionText}** the role **${roleName}**${roleType} ${preposition} **${targetUser}**?\n\nThis will change their permissions in the server.`,
			dangerous: isAdminRole || action === 'remove',
			confirmButtonLabel: action === 'add' ? 'Add Role' : 'Remove Role',
		});
	}

	static async bulk(
		channelId: string,
		userId: string,
		operation: string,
		count: number,
		details?: string,
		isDestructive: boolean = false,
	): Promise<ConfirmationResult> {
		const emoji = isDestructive ? '🚨' : '📦';
		const urgencyText = count > 20 ? '\n\n⚠️ **This is a large operation!**' : '';

		const timeout = count > 20 ? 45000 : count > 10 ? 40000 : 30000;

		let confirmButtonLabel: string;
		if (isDestructive) {
			confirmButtonLabel = operation.toLowerCase().includes('delete') ? 'Delete All' : 'Confirm';
		} else {
			confirmButtonLabel = 'Create All';
		}

		const detailsText = details ? `\n\n**Details:** ${details}` : '';
		const description = `Are you sure you want to perform **${operation}** on **${count} items**?${detailsText}${urgencyText}\n\nThis will affect multiple items at once.`;

		return createAIConfirmation(channelId, userId, {
			title: `${emoji} Bulk ${operation}`,
			description,
			dangerous: isDestructive || count > 20,
			timeout,
			confirmButtonLabel,
		});
	}

	static async serverWide(
		channelId: string,
		userId: string,
		operation: string,
		description: string,
		isDestructive: boolean = true,
	): Promise<ConfirmationResult> {
		return createAIConfirmation(channelId, userId, {
			title: `🌐 Server-wide ${operation}`,
			description: `${description}\n\n⚠️ **This will affect the entire server!**`,
			dangerous: isDestructive,
			timeout: 45000,
			confirmButtonLabel: isDestructive ? 'Proceed' : 'Apply Changes',
		});
	}

	static async permissions(
		channelId: string,
		userId: string,
		target: string,
		permission: string,
		action: 'grant' | 'revoke',
		scope: string = 'channel',
	): Promise<ConfirmationResult> {
		const actionEmoji = action === 'grant' ? '🔓' : '🔒';
		const actionText = action === 'grant' ? 'grant' : 'revoke';

		return createAIConfirmation(channelId, userId, {
			title: `${actionEmoji} ${action === 'grant' ? 'Grant' : 'Revoke'} Permission`,
			description: `Are you sure you want to **${actionText}** the **${permission}** permission ${action === 'grant' ? 'to' : 'from'} **${target}** in this ${scope}?\n\nThis will change their access level.`,
			dangerous: action === 'grant' && permission.toLowerCase().includes('admin'),
			confirmButtonLabel: action === 'grant' ? 'Grant' : 'Revoke',
		});
	}

	static async custom(
		channelId: string,
		userId: string,
		title: string,
		description: string,
		options: Partial<ConfirmationConfig> = {},
	): Promise<ConfirmationResult> {
		const dangerousKeywords = ['delete', 'remove', 'ban', 'kick', 'clear', 'reset', 'destroy'];
		const isDangerous =
			options.dangerous ??
			dangerousKeywords.some(
				(keyword) => title.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword),
			);

		return createAIConfirmation(channelId, userId, {
			title,
			description,
			dangerous: isDangerous,
			...options,
		});
	}
}

export function withConfirmation<T extends any[], R>(
	originalFunction: (...args: T) => Promise<R>,
	getConfirmation: (channelId: string, userId: string, ...args: T) => Promise<ConfirmationResult>,
	getContextualizedArgs?: (...args: T) => T,
) {
	return async function (this: any, channelId: string, userId: string, ...args: T): Promise<R | string> {
		const confirmation = await getConfirmation(channelId, userId, ...args);

		if (!confirmation.confirmed) {
			if (confirmation.timedOut) {
				return 'Operation timed out - no changes were made.' as R;
			}
			return 'Operation cancelled - no changes were made.' as R;
		}

		const finalArgs = getContextualizedArgs ? getContextualizedArgs(...args) : args;
		return await originalFunction.apply(this, finalArgs);
	};
}
