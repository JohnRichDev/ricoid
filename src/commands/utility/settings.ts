import { ApplicationCommandOptionType } from 'discord.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'settings',
		description: "Used to modify the bot's settings .",
		options: [
			{
				name: 'access',
				description: 'Manage access roles',
				type: ApplicationCommandOptionType.SubcommandGroup,
				options: [
					{
						name: 'add',
						description: 'Add a role to access',
						type: ApplicationCommandOptionType.Subcommand,
						options: [
							{
								name: 'role',
								description: 'Role to add',
								type: ApplicationCommandOptionType.Role,
								required: true,
							},
						],
					},
					{
						name: 'remove',
						description: 'Remove a role from access',
						type: ApplicationCommandOptionType.Subcommand,
						options: [
							{
								name: 'role',
								description: 'Role to remove',
								type: ApplicationCommandOptionType.Role,
								required: true,
							},
						],
					},
				],
			},
		],
	},
	async execute(interaction) {
		// make it actually work
		await interaction.reply(`This command was run by ${interaction.user.username}.`);
	},
} satisfies Command;
