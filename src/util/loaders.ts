import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Client } from 'discord.js';
import type { Command } from '../commands/index.js';
import { predicate as commandPredicate } from '../commands/index.js';
import type { Event } from '../events/index.js';
import { predicate as eventPredicate } from '../events/index.js';

/**
 * A predicate to check if the structure is valid
 */
export type StructurePredicate<T> = (structure: unknown) => structure is T;

export async function loadStructures<T>(dir: string, predicate: StructurePredicate<T>, recursive = true): Promise<T[]> {
	// Get the stats of the directory
	const statDir = await stat(dir);

	// If the provided directory path is not a directory, throw an error
	if (!statDir.isDirectory()) {
		throw new Error(`The directory '${dir}' is not a directory.`);
	}

	// Get all the files in the directory
	const files = await readdir(dir);

	// Create an empty array to store the structures
	const structures: T[] = [];

	// Loop through all the files in the directory
	for (const file of files) {
		const filePath = path.join(dir, file);

		// Get the stats of the file
		const statFile = await stat(filePath);

		// If the file is a directory and recursive is true, recursively load the structures in the directory
		if (statFile.isDirectory() && recursive) {
			structures.push(...(await loadStructures(filePath, predicate, recursive)));
			continue;
		}

		// If the file is index.js or the file does not end with .js, skip the file
		if (file === 'index.js' || !file.endsWith('.js')) {
			continue;
		}

		// Import the structure dynamically from the file
		const structure = (await import(pathToFileURL(filePath).href)).default;

		// If the structure is a valid structure, add it
		if (predicate(structure)) structures.push(structure);
	}

	return structures;
}

export async function loadCommands(dir: string, recursive = true): Promise<Map<string, Command>> {
	return (await loadStructures(dir, commandPredicate, recursive)).reduce(
		(acc, cur) => acc.set(cur.data.name, cur),
		new Map<string, Command>(),
	);
}

export async function loadEvents(dir: string, recursive = true): Promise<Event[]> {
	return loadStructures(dir, eventPredicate, recursive);
}

export function registerEvents(client: Client, events: Event[]): void {
	for (const event of events) {
		if (event.once) {
			client.once(event.name, event.execute as any);
		} else {
			client.on(event.name, event.execute as any);
		}
	}
	console.log(`Registered ${events.length} events`);
}
