import { Client, GatewayIntentBits } from 'discord.js';

export const discordClient = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildPresences,
	],
});

export async function initializeDiscordClient(token: string): Promise<void> {
	await discordClient.login(token);
	console.error('Bot ready!');
}
