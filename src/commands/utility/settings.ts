import { ApplicationCommandOptionType } from 'discord.js';
import type { Command } from '../index.js';
import { readSettings } from '../../util/settingsStore.js';
import { getAllCategories, getModule } from './settings/registry.js';

export default {
	data: {
		name: 'settings',
		description: "Used to modify the bot's settings.",
		options: [
			{
				name: 'category',
				description: 'Setting category to modify',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: getAllCategories(),
			},
			{
				name: 'action',
				description: 'Action to perform',
				type: ApplicationCommandOptionType.String,
				required: true,
				autocomplete: true,
			},
			{
				name: 'target',
				description: 'Target identifier or value (ID, mention, tag, role, or free text)',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		],
	},
	async execute(interaction) {
		const category = interaction.options.getString('category', true);
		const action = interaction.options.getString('action', true);
		const target = interaction.options.getString('target');

		const settings = await readSettings();
		const module = getModule(category);

		if (!module) {
			await interaction.reply(`Unknown settings category: ${category}`);
			return;
		}

		try {
			const result = await module.execute(interaction, action, target, settings);
			await interaction.reply(result.reply);
		} catch (error) {
			console.error('Settings command error:', error);
			await interaction.reply('An error occurred while processing the settings command.');
		}
	},
} satisfies Command;
