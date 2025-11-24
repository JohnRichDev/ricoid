import { Guild, TextChannel } from 'discord.js';

export interface ServerIdentifier {
	server?: string;
}

export interface ChannelIdentifier extends ServerIdentifier {
	channel: string;
}

export interface MessageData extends ChannelIdentifier {
	message: string;
}

export interface VoiceChannelData extends ServerIdentifier {
	channelName: string;
	category?: string;
	userLimit?: number;
}

export interface TextChannelData extends ServerIdentifier {
	channelName: string;
	category?: string;
	topic?: string;
}

export interface MessageHistory extends ChannelIdentifier {
	messageCount?: number;
}

export interface ClearMessagesData extends ServerIdentifier {
	channel?: string;
	messageCount?: number;
}

export interface PurgeChannelData extends ServerIdentifier {
	channel: string;
}

export interface CategoryData extends ServerIdentifier {
	categoryName: string;
}

export type ChannelType = 'text' | 'voice' | 'category';

export interface DeleteChannelData extends ServerIdentifier {
	channelName: string;
	channelType?: ChannelType;
}

export interface DeleteAllChannelsData extends ServerIdentifier {
	excludeCategories?: string[];
	excludeChannels?: string[];
}

export interface ListChannelsData extends ServerIdentifier {
	category?: string;
}

export interface MoveChannelData extends ServerIdentifier {
	channelName: string;
	newCategory: string;
	channelType?: 'text' | 'voice';
}

export interface ReorderChannelData extends ServerIdentifier {
	channelName: string;
	position: number;
	channelType?: ChannelType;
}

export interface ReorderChannelsData extends ServerIdentifier {
	channels: Array<{
		name: string;
		position: number;
		type?: ChannelType;
	}>;
}

export interface RenameChannelData extends ServerIdentifier {
	oldName: string;
	newName: string;
	channelType?: ChannelType;
}

export interface SetChannelTopicData extends ServerIdentifier {
	channelName: string;
	topic: string;
	channelType?: 'text' | 'voice';
}

export interface SetAllChannelTopicsData extends ServerIdentifier {
	channelTopics: Record<string, string>;
}

export interface BulkCreateChannelsData extends ServerIdentifier {
	category: string;
	textChannels?: string[];
	voiceChannels?: string[];
}

export interface ServerInfoData extends ServerIdentifier {}

export interface SetChannelPermissionsData extends ServerIdentifier {
	channelName: string;
	roleName: string;
	allow?: string[];
	deny?: string[];
	channelType?: ChannelType;
}
export interface UserInfoData extends ServerIdentifier {
	user: string;
}

export interface RoleManagementData extends ServerIdentifier {
	user: string;
	roleName: string;
	action: 'add' | 'remove';
}

export interface ModerationData extends ServerIdentifier {
	user: string;
	action: 'kick' | 'ban' | 'timeout' | 'untimeout';
	reason?: string;
	duration?: number;
}

export interface ReactionData extends ChannelIdentifier {
	messageId: string;
	emoji: string;
	action: 'add' | 'remove';
}

export interface PinData extends ChannelIdentifier {
	messageId: string;
	action: 'pin' | 'unpin';
}

export interface PollData extends ChannelIdentifier {
	question: string;
	options: string[];
	duration?: number;
}

export interface ReminderData extends ServerIdentifier {
	user?: string;
	message: string;
	delay: number;
	channel?: string;
}

export interface GameData {
	type: 'rps' | 'coinflip' | 'dice' | 'number_guess';
	userChoice?: string;
}

export interface CalculatorData {
	expression: string;
}

export interface WeatherData {
	location: string;
}

export interface TranslateData {
	text: string;
	fromLanguage?: string;
	toLanguage: string;
}

export interface SearchData {
	query: string;
	type: 'web' | 'images' | 'news';
	limit?: number;
}

export interface WebsiteScreenshotData extends ChannelIdentifier {
	url: string;
	fullPage?: boolean;
	width?: number;
	height?: number;
	deviceScaleFactor?: number;
	delayMs?: number;
}

export interface ServerStatsData extends ServerIdentifier {}

export interface DiscordOperations {
	findServer(serverId?: string): Promise<Guild>;
	findTextChannel(channelId: string, serverId?: string): Promise<TextChannel>;
	sendDiscordMessage(data: MessageData): Promise<string>;
	readDiscordMessages(data: MessageHistory): Promise<string>;
	createVoiceChannel(data: VoiceChannelData): Promise<string>;
	createTextChannel(data: TextChannelData): Promise<string>;
	clearDiscordMessages(data: ClearMessagesData): Promise<string>;
	getUserInfo(data: UserInfoData): Promise<string>;
	manageUserRole(data: RoleManagementData): Promise<string>;
	moderateUser(data: ModerationData): Promise<string>;
	manageReaction(data: ReactionData): Promise<string>;
	managePin(data: PinData): Promise<string>;
	createPoll(data: PollData): Promise<string>;
	setReminder(data: ReminderData): Promise<string>;
	playGame(data: GameData): Promise<string>;
	calculate(data: CalculatorData): Promise<string>;
	getWeather(data: WeatherData): Promise<string>;
	translate(data: TranslateData): Promise<string>;
	search(data: SearchData): Promise<string>;
	screenshotWebsite(data: WebsiteScreenshotData): Promise<string>;
	getServerStats(data: ServerStatsData): Promise<string>;
	getAuditLogs(data: AuditLogData): Promise<string>;
	createInvite(data: InviteData): Promise<string>;
	listInvites(data: ListInvitesData): Promise<string>;
	deleteInvite(data: DeleteInviteData): Promise<string>;
	createRole(data: CreateRoleData): Promise<string>;
	editRole(data: EditRoleData): Promise<string>;
	addEmoji(data: EmojiData): Promise<string>;
	removeEmoji(data: RemoveEmojiData): Promise<string>;
	listEmojis(data: ListEmojisData): Promise<string>;
	unbanUser(data: UnbanUserData): Promise<string>;
	listBans(data: ListBansData): Promise<string>;
	updateServerSettings(data: UpdateServerSettingsData): Promise<string>;
	createEvent(data: CreateEventData): Promise<string>;
	cancelEvent(data: CancelEventData): Promise<string>;
	moveVoiceUser(data: MoveVoiceUserData): Promise<string>;
	muteVoiceUser(data: MuteVoiceUserData): Promise<string>;
	createThread(data: CreateThreadData): Promise<string>;
	archiveThread(data: ArchiveThreadData): Promise<string>;
	createWebhook(data: CreateWebhookData): Promise<string>;
	listWebhooks(data: ListWebhooksData): Promise<string>;
	deleteWebhook(data: DeleteWebhookData): Promise<string>;
}

export interface AuditLogData extends ServerIdentifier {
	limit?: number;
	actionType?: string;
}

export interface InviteData extends ServerIdentifier {
	channel: string;
	maxUses?: number;
	maxAge?: number;
}

export interface ListInvitesData extends ServerIdentifier {}

export interface DeleteInviteData extends ServerIdentifier {
	inviteCode: string;
}

export interface CreateRoleData extends ServerIdentifier {
	name: string;
	color?: string;
	permissions?: string[];
}

export interface EditRoleData extends ServerIdentifier {
	roleName: string;
	newName?: string;
	newColor?: string;
}

export interface DeleteRoleData extends ServerIdentifier {
	roleName: string;
}

export interface ListRolesData extends ServerIdentifier {}

export interface EmojiData extends ServerIdentifier {
	name: string;
	imageUrl?: string;
}

export interface RemoveEmojiData extends ServerIdentifier {
	emojiName: string;
}

export interface ListEmojisData extends ServerIdentifier {}

export interface UnbanUserData extends ServerIdentifier {
	userId: string;
	reason?: string;
}

export interface ListBansData extends ServerIdentifier {}

export interface UpdateServerSettingsData extends ServerIdentifier {
	name?: string;
	iconUrl?: string;
	description?: string;
}

export interface CreateEventData extends ServerIdentifier {
	name: string;
	description?: string;
	startTime: string;
	channel?: string;
}

export interface CancelEventData extends ServerIdentifier {
	eventId: string;
}

export interface MoveVoiceUserData extends ServerIdentifier {
	user: string;
	toChannel: string;
}

export interface MuteVoiceUserData extends ServerIdentifier {
	user: string;
	action: 'mute' | 'unmute' | 'deafen' | 'undeafen';
}

export interface CreateThreadData extends ChannelIdentifier {
	name: string;
	messageId?: string;
}

export interface ArchiveThreadData extends ChannelIdentifier {
	threadId: string;
}

export interface CreateWebhookData extends ChannelIdentifier {
	name: string;
}

export interface ListWebhooksData extends ServerIdentifier {}

export interface DeleteWebhookData extends ServerIdentifier {
	webhookId: string;
}

export interface GetBotInfoData extends ServerIdentifier {}

export interface EditMessageData extends ChannelIdentifier {
	messageId: string;
	newContent: string;
}

export interface DeleteMessageData extends ChannelIdentifier {
	messageId: string;
}

export interface SetSlowmodeData extends ChannelIdentifier {
	seconds: number;
}

export interface SetNSFWData extends ChannelIdentifier {
	enabled: boolean;
}

export interface CreateForumChannelData extends ServerIdentifier {
	channelName: string;
	category?: string;
	topic?: string;
	tags?: string[];
}

export interface CreateForumPostData extends ChannelIdentifier {
	title: string;
	message: string;
	tags?: string[];
}

export interface LogEventData extends ServerIdentifier {
	logChannel: string;
	eventType: 'message' | 'member' | 'channel' | 'role' | 'moderation' | 'all';
	enabled: boolean;
}

export interface CreateCustomCommandData extends ServerIdentifier {
	trigger: string;
	response: string;
	description?: string;
}

export interface DeleteCustomCommandData extends ServerIdentifier {
	trigger: string;
}

export interface ListCustomCommandsData extends ServerIdentifier {}

export interface ExecuteCustomCommandData extends ServerIdentifier {
	trigger: string;
	userId: string;
	channelId: string;
}

export interface BulkEditMessagesData extends ChannelIdentifier {
	messageIds: string[];
	newContent: string;
}

export interface SearchMessagesData extends ChannelIdentifier {
	query?: string;
	author?: string;
	limit?: number;
}

export interface PinAllMessagesData extends ChannelIdentifier {
	minReactions?: number;
	authorId?: string;
	containsText?: string;
}

export interface ExportMessagesData extends ChannelIdentifier {
	format?: 'json' | 'txt';
	limit?: number;
}

export interface CopyMessagesData extends ServerIdentifier {
	sourceChannel: string;
	targetChannel: string;
	limit?: number;
}

export interface WarnUserData extends ServerIdentifier {
	user: string;
	reason: string;
	moderator: string;
}

export interface ListWarningsData extends ServerIdentifier {
	user: string;
}

export interface ClearWarningsData extends ServerIdentifier {
	user: string;
	warningId?: string;
}

export interface AutomodData extends ServerIdentifier {
	action: 'enable' | 'disable';
	bannedWords?: string[];
	maxMentions?: number;
}

export interface MuteUserData extends ServerIdentifier {
	user: string;
	reason?: string;
}

export interface LockChannelData extends ChannelIdentifier {
	locked: boolean;
}

export interface MassKickData extends ServerIdentifier {
	criteria: 'bots' | 'no_roles' | 'inactive';
	reason?: string;
}

export interface MassBanData extends ServerIdentifier {
	userIds: string[];
	reason?: string;
}

export interface CloneRoleData extends ServerIdentifier {
	roleName: string;
	newName?: string;
}

export interface GiveRoleToAllData extends ServerIdentifier {
	roleName: string;
	filter?: 'all' | 'bots' | 'humans';
}

export interface RemoveRoleFromAllData extends ServerIdentifier {
	roleName: string;
}

export interface CreateRoleMenuData extends ChannelIdentifier {
	title: string;
	roles: Array<{ emoji: string; roleId: string; label: string }>;
}

export interface SyncPermissionsData extends ServerIdentifier {
	category: string;
}

export interface CloneChannelData extends ServerIdentifier {
	channelName: string;
}

export interface CreateTemplateData extends ServerIdentifier {
	templateName: string;
}

export interface ApplyTemplateData extends ServerIdentifier {
	templateFile: string;
}

export interface BackupServerData extends ServerIdentifier {}

export interface RestoreServerData extends ServerIdentifier {
	backupFile: string;
}

export interface JoinLeaveStatsData extends ServerIdentifier {
	days?: number;
}

export interface NicknameHistoryData extends ServerIdentifier {
	user: string;
}

export interface CreateTempVoiceData extends ServerIdentifier {
	channelName: string;
	category?: string;
}

export interface VoiceStatsData extends ServerIdentifier {}

export interface DisconnectAllData extends ChannelIdentifier {}

export interface MoveAllData extends ServerIdentifier {
	fromChannel: string;
	toChannel: string;
}

export interface RemindMeData extends ServerIdentifier {
	user?: string;
	message: string;
	delay: number;
	channel?: string;
	recurring?: boolean;
}

export interface StealEmojiData extends ServerIdentifier {
	emojiUrl: string;
	name: string;
}

export interface EnlargeEmojiData {
	emojiId: string;
}

export interface AvatarData extends ServerIdentifier {
	user: string;
}

export interface ServerIconData extends ServerIdentifier {}

export interface ChannelHistoryData extends ChannelIdentifier {}

export interface TranslateData {
	text: string;
	targetLanguage: string;
	style?: string;
}

export interface WeatherData {
	location: string;
}

export interface DefineData {
	word: string;
}

export interface WikipediaData {
	query: string;
	sentences?: number;
}

export interface MessageHeatmapData extends ChannelIdentifier {
	days?: number;
}

export interface TopPostersData extends ChannelIdentifier {
	limit?: number;
	days?: number;
}

export interface EmojiStatsData extends ServerIdentifier {
	days?: number;
}

export interface ChannelActivityData extends ServerIdentifier {
	days?: number;
}

export interface MemberGrowthData extends ServerIdentifier {}

export interface GithubIssueData {
	repo: string;
	title: string;
	body?: string;
	labels?: string[];
}

export interface TwitterPostData {
	content: string;
}

export interface YoutubeNotifyData {
	channelId: string;
	discordChannel: string;
}

export interface TwitchNotifyData {
	twitchUsername: string;
	discordChannel: string;
}

export interface ReactOnKeywordData extends ServerIdentifier {
	keyword: string;
	emoji: string;
	action?: 'add' | 'remove' | 'list';
}

export interface AutoRespondData extends ServerIdentifier {
	trigger: string;
	response?: string;
	action?: 'add' | 'remove' | 'list';
}

export interface ChatGPTModeData extends ChannelIdentifier {
	enabled: boolean;
}

export interface PersonalityData {
	trait: string;
	intensity: number;
}

export interface ContextManagementData {
	action: 'clear' | 'summarize' | 'expand';
}
