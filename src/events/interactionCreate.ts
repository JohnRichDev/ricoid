import path from 'node:path';
import { Events } from 'discord.js';
import { loadCommands } from '../util/loaders.js';
import { handleSettingsAutocomplete } from './utility/settingsAutocomplete.js';
import { appConfig } from '../config/app.js';
import type { Event } from './index.js';

export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
		const commands = await loadCommands(path.join(process.cwd(), appConfig.paths.commands));

		if (interaction.isAutocomplete()) {
			if (interaction.commandName === 'settings') {
				try {
					await handleSettingsAutocomplete(interaction);
				} catch (error) {
					console.error('Error executing autocomplete for settings:', error);
				}
			}
			return;
		}

		if (interaction.isButton()) {
			return;
		}

		if (interaction.isChatInputCommand()) {
			const command = commands.get(interaction.commandName);

			if (!command) {
				console.error(`Command '${interaction.commandName}' not found.`);
				if (!interaction.replied && !interaction.deferred) {
					try {
						await interaction.reply('Command not found.');
					} catch (replyError) {
						console.error('Error sending command not found reply:', replyError);
					}
				}
				return;
			}

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
	},
} satisfies Event<Events.InteractionCreate>;
