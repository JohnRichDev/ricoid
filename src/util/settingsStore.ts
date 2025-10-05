import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export type CustomCommand = {
	trigger: string;
	response: string;
	description: string;
	createdAt: string;
};

export type PendingReminder = {
	id: string;
	server?: string;
	user?: string;
	message: string;
	triggerTime: number;
	channel?: string;
};

export type StoredSettings = {
	prompt?: string;
	access?: string[];
	channel?: string;
	confirmations?: {
		enabled: boolean;
		types: Record<string, boolean>;
	};
	customCommands?: Record<string, Record<string, CustomCommand>>;
	pendingReminders?: PendingReminder[];
};

const filePath = resolve(process.cwd(), 'data', 'settings.json');

async function ensureDirAndFile() {
	const dir = dirname(filePath);

	try {
		await mkdir(dir, { recursive: true });
	} catch (error) {
		console.warn('Failed to create directory:', dir, error);
	}

	try {
		await access(filePath);
	} catch (error) {
		await writeFile(filePath, JSON.stringify({}, null, 2), 'utf8');
	}
}

export async function readSettings(): Promise<StoredSettings> {
	try {
		const raw = await readFile(filePath, 'utf8');
		return JSON.parse(raw) as StoredSettings;
	} catch (error) {
		console.warn('Failed to read settings file, using defaults:', error);
		return {};
	}
}

export async function writeSettings(settings: StoredSettings): Promise<void> {
	try {
		await mkdir(dirname(filePath), { recursive: true });
	} catch (error) {
		console.warn('Failed to create directory for settings file:', error);
	}
	await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

ensureDirAndFile().catch(() => undefined);

export type ConversationMessage = {
	role: 'user' | 'model';
	parts: Array<{
		text: string;
	}>;
	timestamp: number;
};

export type ConversationHistory = {
	channelId: string;
	messages: ConversationMessage[];
	lastUpdated: number;
};

export type ConversationStore = {
	[key: string]: ConversationHistory;
};

const conversationFilePath = resolve(process.cwd(), 'data', 'conversations.json');

async function ensureConversationFile() {
	const dir = dirname(conversationFilePath);

	try {
		await mkdir(dir, { recursive: true });
	} catch (error) {
		console.warn('Failed to create conversation directory:', dir, error);
	}

	try {
		await access(conversationFilePath);
	} catch (error) {
		await writeFile(conversationFilePath, JSON.stringify({}, null, 2), 'utf8');
	}
}

export async function readConversations(): Promise<ConversationStore> {
	try {
		const raw = await readFile(conversationFilePath, 'utf8');
		return JSON.parse(raw) as ConversationStore;
	} catch (error) {
		console.warn('Failed to read conversations file, using empty store:', error);
		return {};
	}
}

export async function writeConversations(conversations: ConversationStore): Promise<void> {
	try {
		await mkdir(dirname(conversationFilePath), { recursive: true });
	} catch (error) {
		console.warn('Failed to create directory for conversation file:', error);
	}
	await writeFile(conversationFilePath, JSON.stringify(conversations, null, 2), 'utf8');
}

export async function getConversationHistory(channelId: string): Promise<ConversationHistory | null> {
	const conversations = await readConversations();
	return conversations[channelId] || null;
}

export async function saveConversationHistory(channelId: string, history: ConversationHistory): Promise<void> {
	const conversations = await readConversations();
	conversations[channelId] = history;
	await writeConversations(conversations);
}

export async function addMessageToConversation(channelId: string, message: ConversationMessage): Promise<void> {
	const conversations = await readConversations();

	if (!conversations[channelId]) {
		conversations[channelId] = {
			channelId,
			messages: [],
			lastUpdated: Date.now(),
		};
	}

	conversations[channelId].messages.push(message);
	conversations[channelId].lastUpdated = Date.now();

	if (conversations[channelId].messages.length > 20) {
		conversations[channelId].messages = conversations[channelId].messages.slice(-20);
	}

	await writeConversations(conversations);
}

ensureConversationFile().catch(() => undefined);

export async function getCustomCommands(guildId: string): Promise<Record<string, CustomCommand>> {
	const settings = await readSettings();
	return settings.customCommands?.[guildId] || {};
}

export async function saveCustomCommand(guildId: string, command: CustomCommand): Promise<void> {
	const settings = await readSettings();

	if (!settings.customCommands) {
		settings.customCommands = {};
	}

	if (!settings.customCommands[guildId]) {
		settings.customCommands[guildId] = {};
	}

	const normalizedTrigger = command.trigger.toLowerCase();
	settings.customCommands[guildId][normalizedTrigger] = command;

	await writeSettings(settings);
}

export async function deleteCustomCommand(guildId: string, trigger: string): Promise<boolean> {
	const settings = await readSettings();

	if (!settings.customCommands?.[guildId]) {
		return false;
	}

	const normalizedTrigger = trigger.toLowerCase();
	const existed = normalizedTrigger in settings.customCommands[guildId];

	if (existed) {
		delete settings.customCommands[guildId][normalizedTrigger];
		await writeSettings(settings);
	}

	return existed;
}

export async function getPendingReminders(): Promise<PendingReminder[]> {
	const settings = await readSettings();
	return settings.pendingReminders || [];
}

export async function saveReminder(reminder: PendingReminder): Promise<void> {
	const settings = await readSettings();

	if (!settings.pendingReminders) {
		settings.pendingReminders = [];
	}

	settings.pendingReminders.push(reminder);
	await writeSettings(settings);
}

export async function deleteReminder(reminderId: string): Promise<void> {
	const settings = await readSettings();

	if (!settings.pendingReminders) {
		return;
	}

	settings.pendingReminders = settings.pendingReminders.filter((r) => r.id !== reminderId);
	await writeSettings(settings);
}
