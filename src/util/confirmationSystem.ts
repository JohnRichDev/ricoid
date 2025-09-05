import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ComponentType,
	ChatInputCommandInteraction,
	Message,
	ButtonInteraction,
} from 'discord.js';
import { discordClient } from '../discord/client.js';

export interface ConfirmationConfig {
	title: string;
	description: string;
	color?: number;
	confirmButtonLabel?: string;
	cancelButtonLabel?: string;
	confirmButtonStyle?: ButtonStyle;
	cancelButtonStyle?: ButtonStyle;
	timeout?: number;
	dangerous?: boolean;
}

export interface ConfirmationResult {
	confirmed: boolean;
	timedOut: boolean;
	interaction?: ButtonInteraction;
}

const DEFAULT_CONFIG: Partial<ConfirmationConfig> = {
	confirmButtonLabel: 'Confirm',
	cancelButtonLabel: 'Cancel',
	confirmButtonStyle: ButtonStyle.Primary,
	cancelButtonStyle: ButtonStyle.Secondary,
	timeout: 30000,
	color: 0x0099ff,
};

const DANGEROUS_CONFIG: Partial<ConfirmationConfig> = {
	confirmButtonLabel: 'Confirm',
	cancelButtonLabel: 'Cancel',
	confirmButtonStyle: ButtonStyle.Danger,
	cancelButtonStyle: ButtonStyle.Secondary,
	timeout: 30000,
	color: 0xff0000,
};

export async function createConfirmation(
	interaction: ChatInputCommandInteraction | Message,
	config: ConfirmationConfig,
): Promise<ConfirmationResult> {
	const finalConfig = {
		...DEFAULT_CONFIG,
		...(config.dangerous ? DANGEROUS_CONFIG : {}),
		...config,
	};

	const embed = new EmbedBuilder()
		.setTitle(finalConfig.title)
		.setDescription(finalConfig.description)
		.setColor(finalConfig.color!)
		.setTimestamp()
		.setFooter({ text: `This confirmation will expire in ${finalConfig.timeout! / 1000} seconds` });

	const confirmButton = new ButtonBuilder()
		.setCustomId('confirm')
		.setLabel(finalConfig.confirmButtonLabel!)
		.setStyle(finalConfig.confirmButtonStyle!);

	const cancelButton = new ButtonBuilder()
		.setCustomId('cancel')
		.setLabel(finalConfig.cancelButtonLabel!)
		.setStyle(finalConfig.cancelButtonStyle!);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

	let response: Message;

	if (interaction instanceof Message) {
		response = await interaction.reply({
			embeds: [embed],
			components: [row],
		});
	} else {
		if (interaction.replied || interaction.deferred) {
			response = await interaction.followUp({
				embeds: [embed],
				components: [row],
				ephemeral: true,
			});
		} else {
			const interactionResponse = await interaction.reply({
				embeds: [embed],
				components: [row],
				ephemeral: true,
			});
			response = await interactionResponse.fetch();
		}
	}

	try {
		const buttonInteraction = await response.awaitMessageComponent({
			componentType: ComponentType.Button,
			time: finalConfig.timeout!,
			filter: (i) => {
				const userId = interaction instanceof Message ? interaction.author.id : interaction.user.id;
				return i.user.id === userId;
			},
		});

		const confirmed = buttonInteraction.customId === 'confirm';

		const resultEmbed = new EmbedBuilder()
			.setTitle(finalConfig.title)
			.setDescription(
				confirmed ? `✅ **Confirmed** - ${finalConfig.description}` : `❌ **Cancelled** - ${finalConfig.description}`,
			)
			.setColor(confirmed ? 0x00ff00 : 0xff9900)
			.setTimestamp();

		await buttonInteraction.update({
			embeds: [resultEmbed],
			components: [],
		});

		return {
			confirmed,
			timedOut: false,
			interaction: buttonInteraction,
		};
	} catch (error) {
		const timeoutEmbed = new EmbedBuilder()
			.setTitle(finalConfig.title)
			.setDescription(`⏰ **Timed out** - ${finalConfig.description}`)
			.setColor(0x808080)
			.setTimestamp();

		try {
			await response.edit({
				embeds: [timeoutEmbed],
				components: [],
			});
		} catch (editError) {
			console.error('Failed to edit confirmation message on timeout:', editError);
		}

		return {
			confirmed: false,
			timedOut: true,
		};
	}
}

export async function createDangerousConfirmation(
	interaction: ChatInputCommandInteraction | Message,
	config: Omit<ConfirmationConfig, 'dangerous'>,
): Promise<ConfirmationResult> {
	return createConfirmation(interaction, { ...config, dangerous: true });
}

export async function createDeletionConfirmation(
	channelId: string,
	userId: string,
	itemName: string,
	itemType: string = 'item',
): Promise<ConfirmationResult> {
	return createAIConfirmation(channelId, userId, {
		title: `🗑️ Delete ${itemType}`,
		description: `Are you sure you want to delete **${itemName}**?\n\nThis action cannot be undone.`,
		dangerous: true,
		confirmButtonLabel: 'Delete',
	});
}

export async function createModerationConfirmation(
	channelId: string,
	userId: string,
	action: string,
	target: string,
	reason?: string,
): Promise<ConfirmationResult> {
	const actionEmojis: { [key: string]: string } = {
		ban: '🔨',
		kick: '👢',
		timeout: '⏰',
		mute: '🔇',
		warn: '⚠️',
	};

	return createAIConfirmation(channelId, userId, {
		title: `${actionEmojis[action] || '🛡️'} ${action.charAt(0).toUpperCase() + action.slice(1)} User`,
		description: `Are you sure you want to **${action}** **${target}**?\n\n${reason ? `**Reason:** ${reason}` : 'No reason provided.'}\n\nThis moderation action will be logged.`,
		dangerous: true,
		confirmButtonLabel: action.charAt(0).toUpperCase() + action.slice(1),
	});
}

export async function createBulkOperationConfirmation(
	channelId: string,
	userId: string,
	operation: string,
	count: number,
	details?: string,
): Promise<ConfirmationResult> {
	return createAIConfirmation(channelId, userId, {
		title: `📦 Bulk ${operation}`,
		description: `Are you sure you want to perform **${operation}** on **${count} items**?${details ? `\n\n${details}` : ''}\n\nThis will affect multiple items at once.`,
		dangerous: count > 10,
		timeout: count > 20 ? 45000 : 30000,
		confirmButtonLabel: operation.toLowerCase().includes('delete') ? 'Delete All' : 'Proceed',
	});
}

export async function createAIConfirmation(
	channelId: string,
	userId: string,
	config: ConfirmationConfig,
): Promise<ConfirmationResult> {
	const channel = await discordClient.channels.fetch(channelId);

	if (!channel || !('send' in channel)) {
		throw new Error('Invalid channel for confirmation');
	}

	const finalConfig = {
		...DEFAULT_CONFIG,
		...(config.dangerous ? DANGEROUS_CONFIG : {}),
		...config,
	};

	const embed = new EmbedBuilder()
		.setTitle(finalConfig.title)
		.setDescription(finalConfig.description)
		.setColor(finalConfig.color!)
		.setTimestamp()
		.setFooter({ text: `This confirmation will expire in ${finalConfig.timeout! / 1000} seconds` });

	const confirmButton = new ButtonBuilder()
		.setCustomId('confirm')
		.setLabel(finalConfig.confirmButtonLabel!)
		.setStyle(finalConfig.confirmButtonStyle!);

	const cancelButton = new ButtonBuilder()
		.setCustomId('cancel')
		.setLabel(finalConfig.cancelButtonLabel!)
		.setStyle(finalConfig.cancelButtonStyle!);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

	const response = await channel.send({
		embeds: [embed],
		components: [row],
	});

	try {
		const buttonInteraction = await response.awaitMessageComponent({
			componentType: ComponentType.Button,
			time: finalConfig.timeout!,
			filter: (i: ButtonInteraction) => i.user.id === userId,
		});

		const confirmed = buttonInteraction.customId === 'confirm';

		const resultEmbed = new EmbedBuilder()
			.setTitle(finalConfig.title)
			.setDescription(
				confirmed ? `✅ **Confirmed** - ${finalConfig.description}` : `❌ **Cancelled** - ${finalConfig.description}`,
			)
			.setColor(confirmed ? 0x00ff00 : 0xff9900)
			.setTimestamp();

		await buttonInteraction.update({
			embeds: [resultEmbed],
			components: [],
		});

		return {
			confirmed,
			timedOut: false,
			interaction: buttonInteraction,
		};
	} catch (error) {
		const timeoutEmbed = new EmbedBuilder()
			.setTitle(finalConfig.title)
			.setDescription(`⏰ **Timed out** - ${finalConfig.description}`)
			.setColor(0x808080)
			.setTimestamp();

		try {
			await response.edit({
				embeds: [timeoutEmbed],
				components: [],
			});
		} catch (editError) {
			console.error('Failed to edit confirmation message on timeout:', editError);
		}

		return {
			confirmed: false,
			timedOut: true,
		};
	}
}
