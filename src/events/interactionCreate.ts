import path from 'node:path';
import { Events } from 'discord.js';
import { loadCommands } from '../util/loaders.js';
import { handleSettingsAutocomplete } from './utility/settingsAutocomplete.js';
import { appConfig } from '../config/app.js';
import type { Event } from './index.js';

async function handleAutocomplete(interaction: any): Promise<void> {
	if (interaction.commandName === 'settings') {
		try {
			await handleSettingsAutocomplete(interaction);
		} catch (error) {
			console.error('Error executing autocomplete for settings:', error);
		}
	}
}

async function handleCommandNotFound(interaction: any): Promise<void> {
	console.error(`Command '${interaction.commandName}' not found.`);
	if (!interaction.replied && !interaction.deferred) {
		try {
			await interaction.reply('Command not found.');
		} catch (replyError) {
			console.error('Error sending command not found reply:', replyError);
		}
	}
}

async function handleCommandExecution(command: any, interaction: any): Promise<void> {
	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing command ${interaction.commandName}:`, error);

		if (!interaction.replied && !interaction.deferred) {
			try {
				await interaction.reply('An error occurred while executing this command.');
			} catch (replyError) {
				console.error('Error sending error reply:', replyError);
			}
		}
	}
}

async function handleChatInputCommand(interaction: any, commands: Map<string, any>): Promise<void> {
	const command = commands.get(interaction.commandName);

	if (!command) {
		await handleCommandNotFound(interaction);
		return;
	}

	await handleCommandExecution(command, interaction);
}

export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
		const commands = await loadCommands(path.join(process.cwd(), appConfig.paths.commands));

		if (interaction.isAutocomplete()) {
			await handleAutocomplete(interaction);
			return;
		}

		if (interaction.isButton()) {
			return;
		}

		if (interaction.isChatInputCommand()) {
			await handleChatInputCommand(interaction, commands);
		}
	},
} satisfies Event<Events.InteractionCreate>;
