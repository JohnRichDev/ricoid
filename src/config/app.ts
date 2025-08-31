export const appConfig = {
	name: 'ricoid',
	version: '0.1.0',

	env: {
		discordToken: 'DISCORD_TOKEN',
		applicationId: 'APPLICATION_ID',
		geminiApiKey: 'GEMINI_API_KEY',
		nodeEnv: 'NODE_ENV',
	},

	paths: {
		settings: 'data/settings.json',
		commands: 'dist/commands/',
		events: 'dist/events/',
	},

	discord: {
		restVersion: '10',
	},

	logging: {
		levels: {
			error: 'ERROR',
			warn: 'WARN',
			info: 'INFO',
			debug: 'DEBUG',
		},
	},
} as const;
