import { Client } from 'discord.js';
import { clientConfig } from './config.js';

export const discordClient = new Client(clientConfig);

export async function initializeDiscordClient(token: string): Promise<void> {
	await discordClient.login(token);
}
