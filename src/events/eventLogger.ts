import { Events, type ClientEvents } from 'discord.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const LOG_DIR = path.join(process.cwd(), 'logs', 'events');

const EXCLUDED_EVENTS = new Set([
	Events.Raw,
	Events.Debug,
	Events.CacheSweep,
	Events.ShardReady,
	Events.ShardResume,
	Events.ShardReconnecting,
	Events.ShardDisconnect,
	Events.ShardError,
]);

async function ensureLogDirectory(): Promise<void> {
	try {
		await mkdir(LOG_DIR, { recursive: true });
	} catch (error) {
		console.error('Failed to create log directory:', error);
	}
}

export async function logEvent(eventName: string, ...args: any[]): Promise<void> {
	if (EXCLUDED_EVENTS.has(eventName as Events)) {
		return;
	}

	const timestamp = new Date().toISOString();
	const date = timestamp.split('T')[0];
	const logFile = path.join(LOG_DIR, `${date}.log`);

	const logEntry = {
		timestamp,
		event: eventName,
		data: args.map((arg) => {
			try {
				if (arg === null || arg === undefined) {
					return arg;
				}
				if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
					return arg;
				}
				if (arg instanceof Error) {
					return {
						name: arg.name,
						message: arg.message,
						stack: arg.stack,
					};
				}
				if (arg.id) {
					return {
						id: arg.id,
						type: arg.constructor.name,
						...(arg.name && { name: arg.name }),
						...(arg.tag && { tag: arg.tag }),
						...(arg.username && { username: arg.username }),
						...(arg.content && { content: arg.content }),
					};
				}
				return JSON.parse(JSON.stringify(arg));
			} catch (error) {
				return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
			}
		}),
	};

	const logLine = JSON.stringify(logEntry) + '\n';

	try {
		await ensureLogDirectory();
		await writeFile(logFile, logLine, { flag: 'a' });
	} catch (error) {
		console.error('Failed to write event log:', error);
	}
}

export function createEventLoggers(): Array<{
	name: keyof ClientEvents;
	execute: (...args: any[]) => void;
}> {
	const allEvents = Object.values(Events) as Array<keyof ClientEvents>;

	return allEvents.map((eventName) => ({
		name: eventName,
		execute: (...args: any[]) => {
			logEvent(eventName, ...args).catch((error) => {
				console.error(`Failed to log event ${eventName}:`, error);
			});
		},
	}));
}
