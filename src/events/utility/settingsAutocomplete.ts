import type { AutocompleteInteraction } from 'discord.js';
import { encodeChoiceValue, decodeChoiceValue } from '../../util/choiceEncoding.js';
import { getAllActions, getActionsForCategory } from '../../commands/utility/settings/registry.js';

export async function handleSettingsAutocomplete(interaction: AutocompleteInteraction) {
	const focused = interaction.options.getFocused(true);

	if (focused.name === 'action') {
		const rawCategory = interaction.options.getString('category');
		const category = rawCategory ? decodeChoiceValue(rawCategory) : undefined;

		const allActions = getAllActions();

		let allowed = allActions;
		if (category) {
			allowed = getActionsForCategory(category);
		}

		const input = String(focused.value ?? '').toLowerCase();
		const suggestions = allowed
			.filter((a) => a.name.toLowerCase().includes(input) || a.value.toLowerCase().includes(input))
			.slice(0, 25)
			.map((a) => ({ name: a.name, value: encodeChoiceValue(a.value) }));

		await interaction.respond(suggestions);
	}
}
