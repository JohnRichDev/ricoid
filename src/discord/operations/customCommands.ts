import {
	getCustomCommands,
	saveCustomCommand as saveCustomCommandToStore,
	deleteCustomCommand as deleteCustomCommandFromStore,
} from '../../util/settingsStore.js';
import { validateMessageContent } from '../../util/helpers.js';
import { findServer } from './core.js';
import type { CreateCustomCommandData, DeleteCustomCommandData, ListCustomCommandsData } from '../../types/index.js';

export async function createCustomCommand({
	server,
	trigger,
	response,
	description,
}: CreateCustomCommandData): Promise<string> {
	const guild = await findServer(server);

	try {
		const existingCommands = await getCustomCommands(guild.id);
		const normalizedTrigger = trigger.toLowerCase();

		if (normalizedTrigger in existingCommands) {
			return `Custom command "${trigger}" already exists in ${guild.name}.`;
		}

		const validation = validateMessageContent(response);
		if (!validation.valid) {
			return `Invalid response: ${validation.error}`;
		}

		await saveCustomCommandToStore(guild.id, {
			trigger,
			response,
			description: description || `Custom command: ${trigger}`,
			createdAt: new Date().toISOString(),
		});

		return `Custom command "${trigger}" created successfully in ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to create custom command: ${error}`);
	}
}

export async function deleteCustomCommand({ server, trigger }: DeleteCustomCommandData): Promise<string> {
	const guild = await findServer(server);

	try {
		const deleted = await deleteCustomCommandFromStore(guild.id, trigger);

		if (!deleted) {
			return `Custom command "${trigger}" not found in ${guild.name}.`;
		}

		return `Custom command "${trigger}" deleted successfully from ${guild.name}.`;
	} catch (error) {
		throw new Error(`Failed to delete custom command: ${error}`);
	}
}

export async function listCustomCommands({ server }: ListCustomCommandsData): Promise<string> {
	const guild = await findServer(server);

	try {
		const commands = await getCustomCommands(guild.id);
		const commandList = Object.values(commands);

		if (commandList.length === 0) {
			return `No custom commands found in ${guild.name}.`;
		}

		return JSON.stringify(commandList, null, 2);
	} catch (error) {
		throw new Error(`Failed to list custom commands: ${error}`);
	}
}

export async function executeCustomCommand(guildId: string, trigger: string): Promise<string | null> {
	const commands = await getCustomCommands(guildId);
	const normalizedTrigger = trigger.toLowerCase();
	const command = commands[normalizedTrigger];

	return command ? command.response : null;
}
