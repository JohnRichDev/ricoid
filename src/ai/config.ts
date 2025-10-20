export const aiConfig = {
	model: 'gemini-flash-latest',

	maxRecentMessages: 10,

	maxConversationRounds: 5,

	discordIdPattern: /^\d{17,19}$/,

	functionCallPrefix: 'Function ',

	messages: {
		currentChannel: 'Current channel: {channelName} (ID: {channelId})',
		userMessage: 'User message: {message}',
		previousContext: 'Previous conversation context:',
		functionResults: 'Recent function call results (you can reference this data in your responses):',
		functionResultItem: '{index}. {text}',
	},

	history: {
		maxHistoryLength: 50,
	},
} as const;
