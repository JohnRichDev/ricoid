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

export interface DiscordOperations {
	findServer(serverId?: string): Promise<Guild>;
	findTextChannel(channelId: string, serverId?: string): Promise<TextChannel>;
	sendDiscordMessage(data: MessageData): Promise<string>;
	readDiscordMessages(data: MessageHistory): Promise<string>;
	createVoiceChannel(data: VoiceChannelData): Promise<string>;
	createTextChannel(data: TextChannelData): Promise<string>;
}
