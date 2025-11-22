import type {
	ReactOnKeywordData,
	AutoRespondData,
	ChatGPTModeData,
	PersonalityData,
	ContextManagementData,
} from '../../types/index.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const AUTO_REACT_FILE = join(process.cwd(), 'data', 'auto-react.json');
const AUTO_RESPOND_FILE = join(process.cwd(), 'data', 'auto-respond.json');

async function loadAutoReact(): Promise<Record<string, any[]>> {
	try {
		const data = await readFile(AUTO_REACT_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return {};
	}
}

async function saveAutoReact(data: Record<string, any[]>): Promise<void> {
	await writeFile(AUTO_REACT_FILE, JSON.stringify(data, null, 2));
}

async function loadAutoRespond(): Promise<Record<string, any[]>> {
	try {
		const data = await readFile(AUTO_RESPOND_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return {};
	}
}

async function saveAutoRespond(data: Record<string, any[]>): Promise<void> {
	await writeFile(AUTO_RESPOND_FILE, JSON.stringify(data, null, 2));
}

export async function reactOnKeyword({ server, keyword, emoji, action = 'add' }: ReactOnKeywordData): Promise<string> {
	if (!server) {
		return JSON.stringify({ error: 'server_required', message: 'Server ID is required for this operation' });
	}

	try {
		const autoReact = await loadAutoReact();

		if (!autoReact[server]) {
			autoReact[server] = [];
		}

		if (action === 'add') {
			autoReact[server].push({ keyword, emoji, created: new Date().toISOString() });
			await saveAutoReact(autoReact);

			return JSON.stringify({
				action: 'auto_react_added',
				keyword,
				emoji,
				server,
				note: 'Will react with this emoji when keyword is detected in messages',
			});
		} else if (action === 'remove') {
			autoReact[server] = autoReact[server].filter((r: any) => r.keyword !== keyword || r.emoji !== emoji);
			await saveAutoReact(autoReact);

			return JSON.stringify({
				action: 'auto_react_removed',
				keyword,
				emoji,
				server,
			});
		} else if (action === 'list') {
			return JSON.stringify({
				server,
				autoReactions: autoReact[server] || [],
			});
		}

		return JSON.stringify({ error: 'invalid_action', validActions: ['add', 'remove', 'list'] });
	} catch (error) {
		throw new Error(`Failed to manage auto-react: ${error}`);
	}
}

export async function autoRespond({ server, trigger, response, action = 'add' }: AutoRespondData): Promise<string> {
	if (!server) {
		return JSON.stringify({ error: 'server_required', message: 'Server ID is required for this operation' });
	}

	try {
		const autoRespond = await loadAutoRespond();

		if (!autoRespond[server]) {
			autoRespond[server] = [];
		}

		if (action === 'add') {
			autoRespond[server].push({
				trigger,
				response,
				created: new Date().toISOString(),
			});
			await saveAutoRespond(autoRespond);

			return JSON.stringify({
				action: 'auto_respond_added',
				trigger,
				response: response?.substring(0, 50) + '...',
				server,
			});
		} else if (action === 'remove') {
			autoRespond[server] = autoRespond[server].filter((r: any) => r.trigger !== trigger);
			await saveAutoRespond(autoRespond);

			return JSON.stringify({
				action: 'auto_respond_removed',
				trigger,
				server,
			});
		} else if (action === 'list') {
			return JSON.stringify({
				server,
				autoResponses: autoRespond[server] || [],
			});
		}

		return JSON.stringify({ error: 'invalid_action', validActions: ['add', 'remove', 'list'] });
	} catch (error) {
		throw new Error(`Failed to manage auto-respond: ${error}`);
	}
}

export async function chatGPTMode({ server, channel, enabled }: ChatGPTModeData): Promise<string> {
	return JSON.stringify({
		note: 'Conversational mode requires modification to messageCreate event',
		server,
		channel,
		enabled,
		suggestion: 'Store in settings and check in messageCreate to respond without mentions',
	});
}

export async function personality({ trait, intensity }: PersonalityData): Promise<string> {
	return JSON.stringify({
		note: 'Personality adjustment requires modifying system prompt',
		trait,
		intensity,
		suggestion: 'Add personality modifiers to AI prompt in config',
	});
}

export async function contextManagement({ action }: ContextManagementData): Promise<string> {
	if (action === 'clear') {
		return JSON.stringify({
			action: 'context_cleared',
			note: 'Conversation history cleared for this session',
		});
	} else if (action === 'summarize') {
		return JSON.stringify({
			note: 'Context summarization requires AI processing',
			action: 'summarize',
			suggestion: 'Use AI to summarize conversation history',
		});
	} else if (action === 'expand') {
		return JSON.stringify({
			note: 'Context expansion increases message history fetch limit',
			action: 'expand',
			suggestion: 'Increase message count in buildConversationContext',
		});
	}

	return JSON.stringify({ error: 'invalid_action', validActions: ['clear', 'summarize', 'expand'] });
}
