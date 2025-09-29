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

export interface ClearMessagesData extends ChannelIdentifier {
	messageCount?: number;
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
