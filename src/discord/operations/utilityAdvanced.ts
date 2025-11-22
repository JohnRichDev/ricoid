import type {
	RemindMeData,
	StealEmojiData,
	EnlargeEmojiData,
	AvatarData,
	ServerIconData,
	ChannelHistoryData,
	TranslateData,
	WeatherData,
	DefineData,
	WikipediaData,
} from '../../types/index.js';
import { findServer } from './core.js';
import { createAIClient } from '../../ai/index.js';

export async function remindMe({ message, delay, recurring }: RemindMeData): Promise<string> {
	return JSON.stringify({
		note: 'Enhanced reminders with recurrence requires persistent storage',
		message,
		delay,
		recurring: recurring || false,
		suggestion: 'Store in data/reminders.json and check periodically',
	});
}

export async function stealEmoji({ server, emojiUrl, name }: StealEmojiData): Promise<string> {
	const guild = await findServer(server);

	try {
		const emoji = await guild.emojis.create({ attachment: emojiUrl, name });

		return JSON.stringify({
			action: 'emoji_stolen',
			name: emoji.name,
			id: emoji.id,
			url: emoji.url,
		});
	} catch (error) {
		throw new Error(`Failed to steal emoji: ${error}`);
	}
}

export async function enlargeEmoji({ emojiId }: EnlargeEmojiData): Promise<string> {
	try {
		const isCustomEmoji = /^\d{17,19}$/.test(emojiId);

		if (isCustomEmoji) {
			const url = `https://cdn.discordapp.com/emojis/${emojiId}.png`;
			return JSON.stringify({ emojiId, url, type: 'custom' });
		} else {
			return JSON.stringify({ error: 'not_custom_emoji', note: 'Unicode emojis cannot be enlarged' });
		}
	} catch (error) {
		throw new Error(`Failed to enlarge emoji: ${error}`);
	}
}

export async function avatar({ server, user }: AvatarData): Promise<string> {
	const guild = await findServer(server);

	try {
		let member;
		if (/^\d{17,19}$/.test(user)) {
			member = await guild.members.fetch(user).catch(() => undefined);
		}

		if (!member) {
			member = guild.members.cache.find(
				(m) =>
					m.user.username.toLowerCase() === user.toLowerCase() || m.displayName.toLowerCase() === user.toLowerCase(),
			);
		}

		if (!member) {
			return JSON.stringify({ error: 'user_not_found', user });
		}

		return JSON.stringify({
			username: member.user.username,
			avatarUrl: member.user.displayAvatarURL({ size: 4096 }),
			serverAvatarUrl: member.avatarURL({ size: 4096 }) || null,
		});
	} catch (error) {
		throw new Error(`Failed to get avatar: ${error}`);
	}
}

export async function serverIcon({ server }: ServerIconData): Promise<string> {
	const guild = await findServer(server);

	try {
		return JSON.stringify({
			serverName: guild.name,
			iconUrl: guild.iconURL({ size: 4096 }) || null,
			bannerUrl: guild.bannerURL({ size: 4096 }) || null,
			splashUrl: guild.splashURL({ size: 4096 }) || null,
		});
	} catch (error) {
		throw new Error(`Failed to get server icon: ${error}`);
	}
}

export async function getChannelHistory({ server, channel }: ChannelHistoryData): Promise<string> {
	const guild = await findServer(server);

	try {
		const targetChannel = guild.channels.cache.find((c) => c.name.toLowerCase() === channel.toLowerCase());

		if (!targetChannel) {
			return JSON.stringify({ error: 'channel_not_found', channel });
		}

		return JSON.stringify({
			name: targetChannel.name,
			id: targetChannel.id,
			created: targetChannel.createdAt?.toISOString() || 'unknown',
			type: targetChannel.type,
			position: 'position' in targetChannel ? targetChannel.position : undefined,
			parentId: targetChannel.parentId,
		});
	} catch (error) {
		throw new Error(`Failed to get channel history: ${error}`);
	}
}

export async function translate({ text, targetLanguage, style }: TranslateData): Promise<string> {
	try {
		const apiKey = process.env.GOOGLE_API_KEY;
		if (!apiKey) {
			throw new Error('GOOGLE_API_KEY not found in environment');
		}

		const aiClient = createAIClient(apiKey);
		const stylePrompt = style ? ` Translate in the style of: ${style}.` : '';

		const prompt = `Translate the following text to ${targetLanguage}.${stylePrompt} Only return the translation, no explanations.

Text to translate: ${text}`;

		const response = await aiClient.models.generateContent({
			model: 'gemini-2.0-flash-exp',
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
		});

		const translation = response.text || 'Translation failed';

		return JSON.stringify({
			originalText: text,
			targetLanguage,
			style: style || 'standard',
			translation,
		});
	} catch (error) {
		throw new Error(`Failed to translate: ${error}`);
	}
}

export async function weather({ location }: WeatherData): Promise<string> {
	try {
		const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
		if (!response.ok) {
			return JSON.stringify({ error: 'weather_api_failed', location });
		}

		const data: any = await response.json();
		const current = data.current_condition[0];

		return JSON.stringify({
			location: location,
			temperature: `${current.temp_C}°C / ${current.temp_F}°F`,
			condition: current.weatherDesc[0].value,
			humidity: `${current.humidity}%`,
			windSpeed: `${current.windspeedKmph} km/h`,
			feelsLike: `${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F`,
		});
	} catch (error) {
		throw new Error(`Failed to get weather: ${error}`);
	}
}

export async function define({ word }: DefineData): Promise<string> {
	try {
		const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
		if (!response.ok) {
			return JSON.stringify({ error: 'word_not_found', word });
		}

		const data: any = await response.json();
		const entry = data[0];

		const definitions = entry.meanings.map((m: any) => ({
			partOfSpeech: m.partOfSpeech,
			definitions: m.definitions.slice(0, 3).map((d: any) => d.definition),
		}));

		return JSON.stringify({
			word: entry.word,
			phonetic: entry.phonetic || 'N/A',
			definitions,
		});
	} catch (error) {
		throw new Error(`Failed to define word: ${error}`);
	}
}

export async function wikipedia({ query, sentences = 3 }: WikipediaData): Promise<string> {
	try {
		const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);

		if (!response.ok) {
			return JSON.stringify({ error: 'article_not_found', query });
		}

		const data: any = await response.json();

		const fullText = data.extract;
		const sentenceArray = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
		const summary = sentenceArray.slice(0, sentences).join(' ');

		return JSON.stringify({
			title: data.title,
			summary,
			url: data.content_urls.desktop.page,
			thumbnail: data.thumbnail?.source || null,
		});
	} catch (error) {
		throw new Error(`Failed to search Wikipedia: ${error}`);
	}
}
