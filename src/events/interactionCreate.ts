import { URL } from 'node:url';
import { Events } from 'discord.js';
import { loadCommands } from '../util/loaders.js';
import { handleSettingsAutocomplete } from './utility/settingsAutocomplete.js';
import type { Event } from './index.js';

const commands = await loadCommands(new URL('../commands/', import.meta.url));

export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
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

		if (interaction.isChatInputCommand()) {
			const command = commands.get(interaction.commandName);

			if (!command) {
				throw new Error(`Command '${interaction.commandName}' not found.`);
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
