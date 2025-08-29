import process from 'node:process';
import { discordClient, initializeDiscordClient } from './discord/client.js';
import { handleMessage } from './handlers/index.js';
import { createAIClient } from './ai/index.js';

discordClient.on('messageCreate', async (message) => {
	const aiClient = createAIClient(process.env.GEMINI_API_KEY!);
	await handleMessage(message, aiClient);
});

async function main() {
	try {
		const token = process.env.DISCORD_TOKEN;
		if (!token) {
			throw new Error('DISCORD_TOKEN not set');
		}

		await initializeDiscordClient(token);
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

main();
