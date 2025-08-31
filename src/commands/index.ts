import type { RESTPostAPIApplicationCommandsJSONBody, ChatInputCommandInteraction } from 'discord.js';
import { z } from 'zod';
import type { StructurePredicate } from '../util/loaders.js';

export interface Command {
	name: string;
	category: string;
	aliases?: string[];
	cooldown?: number;
	permissions?: string[];
	data: RESTPostAPIApplicationCommandsJSONBody;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
}

export const schema = z.object({
	name: z.string(),
	category: z.string(),
	aliases: z.array(z.string()).optional(),
	cooldown: z.number().optional(),
	permissions: z.array(z.string()).optional(),
	data: z.record(z.any()),
	execute: z.function(),
});

export const predicate: StructurePredicate<Command> = (structure: unknown): structure is Command =>
	schema.safeParse(structure).success;

export function createCommand(
	config: Omit<Command, 'data'> & { data: RESTPostAPIApplicationCommandsJSONBody },
): Command {
	return {
		...config,
	};
}

export function isValidCommand(command: unknown): command is Command {
	return predicate(command);
}
