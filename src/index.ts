import process from 'node:process';
import path from 'node:path';
import { discordClient, initializeDiscordClient } from './discord/client.js';
import { loadEvents, registerEvents } from './util/loaders.js';
import { appConfig } from './config/app.js';
import { createEventLoggers } from './events/eventLogger.js';

async function main() {
	try {
		const token = process.env[appConfig.env.discordToken];
		if (!token) {
			throw new Error(`${appConfig.env.discordToken} not set`);
		}

		const events = await loadEvents(path.join(process.cwd(), appConfig.paths.events));
		registerEvents(discordClient, events);

		const eventLoggers = createEventLoggers();
		registerEvents(discordClient, eventLoggers);

		await initializeDiscordClient(token);
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

main();
