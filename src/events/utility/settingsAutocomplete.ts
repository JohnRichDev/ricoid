import type { AutocompleteInteraction } from 'discord.js';
import { encodeChoiceValue, decodeChoiceValue } from '../../util/choiceEncoding.js';

export async function handleSettingsAutocomplete(interaction: AutocompleteInteraction) {
	const focused = interaction.options.getFocused(true);

	if (focused.name === 'action') {
		const rawCategory = interaction.options.getString('category');
		const category = rawCategory ? decodeChoiceValue(rawCategory) : undefined;

		const allActions = [
			{ name: 'View', value: 'view' },
			{ name: 'Add', value: 'add' },
			{ name: 'Remove', value: 'remove' },
			{ name: 'Set', value: 'set' },
			{ name: 'Reset', value: 'reset' },
		];

		let allowed = allActions;
		if (category === 'access') {
			allowed = allActions.filter((a) => ['view', 'add', 'remove'].includes(a.value));
		} else if (category === 'prompt') {
			allowed = allActions.filter((a) => ['view', 'set', 'reset'].includes(a.value));
		}

		const input = String(focused.value ?? '').toLowerCase();
		const suggestions = allowed
			.filter((a) => a.name.toLowerCase().includes(input) || a.value.toLowerCase().includes(input))
			.slice(0, 25)
			.map((a) => ({ name: a.name, value: encodeChoiceValue(a.value) }));

		await interaction.respond(suggestions);
	}
}
