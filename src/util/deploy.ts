import process from 'node:process';
import path from 'node:path';
import { API } from '@discordjs/core/http-only';
import { REST } from 'discord.js';
import { loadCommands } from './loaders.js';
import { appConfig } from '../config/app.js';

const commands = await loadCommands(path.join(process.cwd(), appConfig.paths.commands));
const commandData = [...commands.values()].map((command) => command.data);

const discordToken = process.env[appConfig.env.discordToken];
const applicationId = process.env[appConfig.env.applicationId];

if (!discordToken) {
	throw new Error(`Missing required environment variable: ${appConfig.env.discordToken}`);
}

if (!applicationId) {
	throw new Error(`Missing required environment variable: ${appConfig.env.applicationId}`);
}

const rest = new REST({ version: appConfig.discord.restVersion }).setToken(discordToken);
const api = new API(rest);

const result = await api.applicationCommands.bulkOverwriteGlobalCommands(applicationId, commandData);

console.log(`Successfully registered ${result.length} commands.`);
