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

export interface DeleteChannelData extends ServerIdentifier {
	channelName: string;
	channelType?: 'text' | 'voice' | 'category';
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

export interface RenameChannelData extends ServerIdentifier {
	oldName: string;
	newName: string;
	channelType?: 'text' | 'voice' | 'category';
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
	channelType?: 'text' | 'voice' | 'category';
}

export interface DiscordOperations {
	findServer(serverId?: string): Promise<Guild>;
	findTextChannel(channelId: string, serverId?: string): Promise<TextChannel>;
	sendDiscordMessage(data: MessageData): Promise<string>;
	readDiscordMessages(data: MessageHistory): Promise<string>;
	createVoiceChannel(data: VoiceChannelData): Promise<string>;
	createTextChannel(data: TextChannelData): Promise<string>;
	clearDiscordMessages(data: ClearMessagesData): Promise<string>;
}
