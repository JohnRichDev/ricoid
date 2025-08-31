import type { ClientEvents } from 'discord.js';
import { z } from 'zod';
import type { StructurePredicate } from '../util/loaders.js';

export type Event<T extends keyof ClientEvents = keyof ClientEvents> = {
	execute(...parameters: ClientEvents[T]): Promise<void> | void;
	name: T;
	once?: boolean;
};

export const schema = z.object({
	name: z.string(),
	once: z.boolean().optional().default(false),
	execute: z.function(),
});

export const predicate: StructurePredicate<Event> = (structure: unknown): structure is Event =>
	schema.safeParse(structure).success;
