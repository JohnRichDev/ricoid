import { Message } from 'discord.js';
import {
	sendDiscordMessage,
	createEmbed,
	readDiscordMessages,
	createVoiceChannel,
	createTextChannel,
	createCategory,
	listChannels,
	moveChannel,
	reorderChannel,
	reorderChannels,
	renameChannel,
	setChannelTopic,
	setAllChannelTopics,
	getServerInfo,
	setChannelPermissions,
	getUserInfo,
	manageReaction,
	managePin,
	createPoll,
	setReminder,
	playGame,
	calculate,
	getServerStats,
	findSuitableChannel,
	listRoles,
	createWebhook,
	listWebhooks,
	deleteWebhook,
	getBotInfo,
	getAuditLogs,
	createInvite,
	listInvites,
	deleteInvite,
	addEmoji,
	removeEmoji,
	listEmojis,
	unbanUser,
	listBans,
	updateServerSettings,
	createEvent,
	cancelEvent,
	moveVoiceUser,
	muteVoiceUser,
	createThread,
	archiveThread,
	editMessage,
	deleteMessage,
	setSlowmode,
	setNSFW,
	createForumChannel,
	createForumPost,
	setupLogging,
	createCustomCommand,
	deleteCustomCommand,
	listCustomCommands,
	executeCustomCommand,
	screenshotWebsite,
	search,
	dfint,
	bulkEditMessages,
	searchMessages,
	pinAllMessages,
	exportMessages,
	copyMessages,
	warnUser,
	listWarnings,
	clearWarnings,
	muteUser,
	lockChannel,
	massKick,
	massBan,
	cloneRole,
	giveRoleToAll,
	removeRoleFromAll,
	syncPermissions,
	cloneChannel,
	createTemplate,
	applyTemplate,
	backupServer,
	voiceStats,
	disconnectAll,
	moveAll,
	stealEmoji,
	enlargeEmoji,
	avatar,
	serverIcon,
	getChannelHistory,
	translate,
	weather,
	define,
	wikipedia,
	messageHeatmap,
	topPosters,
	emojiStats,
	channelActivity,
	reactOnKeyword,
	autoRespond,
} from '../../discord/operations.js';
import {
	deleteChannel,
	deleteAllChannels,
	clearDiscordMessages,
	purgeChannel,
	moderateUser,
	manageUserRole,
	bulkCreateChannels,
	createRole,
	editRole,
	deleteRole,
} from '../../util/confirmedOperations.js';
import { reloadSettings } from '../../config/index.js';
import { handleCodeExecutionConfirmation, executeCodeWithRetries } from './codeExecution.js';

export type FunctionHandler = (args: any, message?: Message) => Promise<any>;

const createSimpleHandler =
	(fn: (args: any) => any): FunctionHandler =>
	async (args: any, _message?: Message) =>
		await fn(args);

async function fetchAPIHandler(args: { url: string; description: string }): Promise<string> {
	try {
		let url = args.url.trim();
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			url = 'https://' + url;
		}

		const response = await fetch(url);
		if (!response.ok) {
			return `API request failed with status ${response.status}: ${response.statusText}`;
		}
		const data = await response.json();

		return `API Response Data (${args.description}):
${JSON.stringify(data, null, 2)}

IMPORTANT: The above is RAW API data. You MUST:
1. Parse and interpret this data carefully
2. ONLY state information that is ACTUALLY present in the response
3. Do NOT make up or hallucinate additional details
4. If you cannot find specific information in the response, say so
5. Verify any claims you make against the actual data above`;
	} catch (error) {
		return `Error fetching API: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

export const functionHandlers: Record<string, FunctionHandler> = {
	sendDiscordMessage: createSimpleHandler(sendDiscordMessage),
	createEmbed: createSimpleHandler(createEmbed),
	readDiscordMessages: createSimpleHandler(readDiscordMessages),
	createVoiceChannel: createSimpleHandler(createVoiceChannel),
	createTextChannel: createSimpleHandler(createTextChannel),
	createCategory: createSimpleHandler(createCategory),
	deleteChannel: createSimpleHandler(deleteChannel),
	deleteAllChannels: createSimpleHandler(deleteAllChannels),
	listChannels: createSimpleHandler(listChannels),
	moveChannel: createSimpleHandler(moveChannel),
	reorderChannel: createSimpleHandler(reorderChannel),
	reorderChannels: createSimpleHandler(reorderChannels),
	renameChannel: createSimpleHandler(renameChannel),
	setChannelTopic: createSimpleHandler(setChannelTopic),
	setAllChannelTopics: createSimpleHandler(setAllChannelTopics),
	bulkCreateChannels: createSimpleHandler(bulkCreateChannels),
	getServerInfo: createSimpleHandler(getServerInfo),
	setChannelPermissions: createSimpleHandler(setChannelPermissions),
	clearDiscordMessages: createSimpleHandler(clearDiscordMessages),
	purgeChannel: createSimpleHandler(purgeChannel),
	getUserInfo: createSimpleHandler(getUserInfo),
	manageUserRole: createSimpleHandler(manageUserRole),
	moderateUser: createSimpleHandler(moderateUser),
	manageReaction: createSimpleHandler(manageReaction),
	managePin: createSimpleHandler(managePin),
	createPoll: createSimpleHandler(createPoll),
	setReminder: createSimpleHandler(setReminder),
	playGame: createSimpleHandler(playGame),
	calculate: createSimpleHandler(calculate),
	screenshotWebsite: createSimpleHandler(screenshotWebsite),
	search: createSimpleHandler(search),
	DFINT: createSimpleHandler(dfint),
	getServerStats: createSimpleHandler(getServerStats),
	createRole: createSimpleHandler(createRole),
	editRole: createSimpleHandler(editRole),
	deleteRole: createSimpleHandler(deleteRole),
	listRoles: createSimpleHandler(listRoles),
	createWebhook: createSimpleHandler(createWebhook),
	listWebhooks: createSimpleHandler(listWebhooks),
	deleteWebhook: createSimpleHandler(deleteWebhook),
	getBotInfo: createSimpleHandler(getBotInfo),
	getAuditLogs: createSimpleHandler(getAuditLogs),
	createInvite: createSimpleHandler(createInvite),
	listInvites: createSimpleHandler(listInvites),
	deleteInvite: createSimpleHandler(deleteInvite),
	addEmoji: createSimpleHandler(addEmoji),
	removeEmoji: createSimpleHandler(removeEmoji),
	listEmojis: createSimpleHandler(listEmojis),
	unbanUser: createSimpleHandler(unbanUser),
	listBans: createSimpleHandler(listBans),
	updateServerSettings: createSimpleHandler(updateServerSettings),
	createEvent: createSimpleHandler(createEvent),
	cancelEvent: createSimpleHandler(cancelEvent),
	moveVoiceUser: createSimpleHandler(moveVoiceUser),
	muteVoiceUser: createSimpleHandler(muteVoiceUser),
	createThread: createSimpleHandler(createThread),
	archiveThread: createSimpleHandler(archiveThread),
	editMessage: createSimpleHandler(editMessage),
	deleteMessage: createSimpleHandler(deleteMessage),
	setSlowmode: createSimpleHandler(setSlowmode),
	setNSFW: createSimpleHandler(setNSFW),
	createForumChannel: createSimpleHandler(createForumChannel),
	createForumPost: createSimpleHandler(createForumPost),
	setupLogging: createSimpleHandler(setupLogging),
	createCustomCommand: createSimpleHandler(createCustomCommand),
	deleteCustomCommand: createSimpleHandler(deleteCustomCommand),
	listCustomCommands: createSimpleHandler(listCustomCommands),
	findSuitableChannel: createSimpleHandler(findSuitableChannel),
	executeCode: async (args: { code: string; risky?: boolean }, message?: Message) => {
		if (args.risky) {
			const confirmationResult = await handleCodeExecutionConfirmation(args.code, message);
			if (confirmationResult) {
				return confirmationResult;
			}
		}

		return await executeCodeWithRetries(args.code, message);
	},
	fetchAPI: async (args: { url: string; description: string }) => await fetchAPIHandler(args),
	reloadSettings: async () => {
		reloadSettings();
		return 'Settings reloaded successfully! The bot will now use the updated configuration.';
	},
	executeCustomCommand: async (args: { server: string; trigger: string }) =>
		await executeCustomCommand(args.server, args.trigger),
	bulkEditMessages: createSimpleHandler(bulkEditMessages),
	searchMessages: createSimpleHandler(searchMessages),
	pinAllMessages: createSimpleHandler(pinAllMessages),
	exportMessages: createSimpleHandler(exportMessages),
	copyMessages: createSimpleHandler(copyMessages),
	warnUser: createSimpleHandler(warnUser),
	listWarnings: createSimpleHandler(listWarnings),
	clearWarnings: createSimpleHandler(clearWarnings),
	muteUser: createSimpleHandler(muteUser),
	lockChannel: createSimpleHandler(lockChannel),
	massKick: createSimpleHandler(massKick),
	massBan: createSimpleHandler(massBan),
	cloneRole: createSimpleHandler(cloneRole),
	giveRoleToAll: createSimpleHandler(giveRoleToAll),
	removeRoleFromAll: createSimpleHandler(removeRoleFromAll),
	syncPermissions: createSimpleHandler(syncPermissions),
	cloneChannel: createSimpleHandler(cloneChannel),
	createTemplate: createSimpleHandler(createTemplate),
	applyTemplate: createSimpleHandler(applyTemplate),
	backupServer: createSimpleHandler(backupServer),
	voiceStats: createSimpleHandler(voiceStats),
	disconnectAll: createSimpleHandler(disconnectAll),
	moveAll: createSimpleHandler(moveAll),
	stealEmoji: createSimpleHandler(stealEmoji),
	enlargeEmoji: createSimpleHandler(enlargeEmoji),
	avatar: createSimpleHandler(avatar),
	serverIcon: createSimpleHandler(serverIcon),
	getChannelHistory: createSimpleHandler(getChannelHistory),
	translate: createSimpleHandler(translate),
	weather: createSimpleHandler(weather),
	define: createSimpleHandler(define),
	wikipedia: createSimpleHandler(wikipedia),
	messageHeatmap: createSimpleHandler(messageHeatmap),
	topPosters: createSimpleHandler(topPosters),
	emojiStats: createSimpleHandler(emojiStats),
	channelActivity: createSimpleHandler(channelActivity),
	reactOnKeyword: createSimpleHandler(reactOnKeyword),
	autoRespond: createSimpleHandler(autoRespond),
};
