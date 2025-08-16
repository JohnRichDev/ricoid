import { ApplicationCommandOptionType } from 'discord.js';
import type { Command } from '../index.js';
import { resolveTarget } from '../../util/resolveTarget.js';
import { readSettings, writeSettings } from '../../util/settingsStore.js';

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
				choices: [
					{
						name: 'Access Permissions',
						value: 'access',
					},
					{
						name: 'Bot Prompt',
						value: 'prompt',
					},
				],
			},
			{
				name: 'action',
				description: 'Action to perform',
				type: ApplicationCommandOptionType.String,
				required: true,
				choices: [
					{
						name: 'View',
						value: 'view',
					},
					{
						name: 'Add',
						value: 'add',
					},
					{
						name: 'Remove',
						value: 'remove',
					},
					{
						name: 'Set',
						value: 'set',
					},
					{
						name: 'Reset',
						value: 'reset',
					},
				],
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

		if (category === 'access') {
			if (!['add', 'remove', 'view'].includes(action)) {
				await interaction.reply('Access permissions only support **add**, **remove**, and **view** actions.');
				return;
			}

			if (['add', 'remove'].includes(action) && !target) {
				await interaction.reply('Target is required for access permission changes.');
				return;
			}

			if (action === 'add') {
				const resolved = await resolveTarget(interaction.guild, target!);
				const display =
					resolved.kind === 'member'
						? `${resolved.member.user.tag}`
						: resolved.kind === 'role'
							? `@${resolved.role.name}`
							: target;

				settings.access = settings.access ?? [];
				if (!settings.access.includes(target!)) {
					settings.access.push(target!);
					await writeSettings(settings);
					await interaction.reply(`Added ${display} to access list.`);
				} else {
					await interaction.reply(`${display} is already in the access list.`);
				}
			} else if (action === 'remove') {
				settings.access = settings.access ?? [];
				const resolved = await resolveTarget(interaction.guild, target!);
				const display =
					resolved.kind === 'member'
						? `${resolved.member.user.tag}`
						: resolved.kind === 'role'
							? `@${resolved.role.name}`
							: target;

				const idx = settings.access.indexOf(target!);
				if (idx !== -1) {
					settings.access.splice(idx, 1);
					await writeSettings(settings);
					await interaction.reply(`Removed ${display} from access list.`);
				} else {
					await interaction.reply(`${display} was not found in the access list.`);
				}
			} else if (action === 'view') {
				const list = settings.access ?? [];
				if (list.length === 0) await interaction.reply('Access list is empty.');
				else await interaction.reply(`Access list:\n${list.join('\n')}`);
			}
		} else if (category === 'prompt') {
			if (!['set', 'reset', 'view'].includes(action)) {
				await interaction.reply('Bot prompt only supports **set**, **reset**, and **view** actions.');
				return;
			}

			if (action === 'set') {
				if (!target) {
					await interaction.reply('Value is required when setting the prompt.');
					return;
				}
				settings.prompt = target;
				await writeSettings(settings);
				await interaction.reply(`Bot prompt set to: "${target}"`);
			} else if (action === 'reset') {
				delete settings.prompt;
				await writeSettings(settings);
				await interaction.reply('Bot prompt reset to default.');
			} else if (action === 'view') {
				await interaction.reply(`Current prompt: ${settings.prompt ?? '*not set*'}`);
			}
		}
	},
} satisfies Command;
