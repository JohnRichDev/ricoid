import { PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { discordClient } from '../client.js';
import { findTextChannel } from './core.js';
import { performSearch, DFINT } from '../../ai/search.js';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import type { WebsiteScreenshotData } from '../../types/index.js';

export async function screenshotWebsite({
	server,
	channel,
	url,
	fullPage,
	width,
	height,
	deviceScaleFactor,
	delayMs,
}: WebsiteScreenshotData): Promise<string> {
	const textChannel = await findTextChannel(channel, server);
	const botUser = discordClient.user;
	if (!botUser) {
		throw new Error('Bot user is not ready.');
	}
	const permissions = textChannel.permissionsFor(botUser.id);
	const hasSend = permissions?.has(PermissionFlagsBits.SendMessages) ?? false;
	const hasAttach = permissions?.has(PermissionFlagsBits.AttachFiles) ?? false;
	if (!hasSend || !hasAttach) {
		throw new Error(`Missing Send Messages or Attach Files permission in #${textChannel.name}.`);
	}
	let normalizedUrl = typeof url === 'string' ? url.trim() : '';
	if (!normalizedUrl) {
		return 'Please provide a URL to capture.';
	}
	if (!/^https?:\/\//i.test(normalizedUrl)) {
		normalizedUrl = `https://${normalizedUrl}`;
	}
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(normalizedUrl);
	} catch {
		return 'Invalid URL. Provide a valid http or https address.';
	}
	const viewportWidth =
		typeof width === 'number' && Number.isFinite(width) ? Math.min(Math.max(Math.round(width), 320), 3840) : 1280;
	const viewportHeight =
		typeof height === 'number' && Number.isFinite(height) ? Math.min(Math.max(Math.round(height), 320), 2160) : 720;
	const scale =
		typeof deviceScaleFactor === 'number' && Number.isFinite(deviceScaleFactor)
			? Math.min(Math.max(deviceScaleFactor, 1), 3)
			: 1;
	const waitAfterLoad =
		typeof delayMs === 'number' && Number.isFinite(delayMs) ? Math.min(Math.max(Math.round(delayMs), 0), 30000) : 0;
	let browser: Browser | null = null;
	try {
		browser = await puppeteer.launch();
		const page = await browser.newPage();
		try {
			await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor: scale });
			await page.setUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			);
			await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
			let response;
			try {
				response = await page.goto(parsedUrl.toString(), { waitUntil: 'networkidle2', timeout: 60000 });
			} catch (error) {
				throw new Error(
					`Failed to load ${parsedUrl.toString()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			}
			if (waitAfterLoad > 0) {
				await new Promise((resolve) => setTimeout(resolve, waitAfterLoad));
			}
			const screenshotResult = await page.screenshot({ type: 'png', fullPage: fullPage ?? true });
			const buffer = Buffer.isBuffer(screenshotResult) ? screenshotResult : Buffer.from(screenshotResult);
			const attachment = new AttachmentBuilder(buffer, {
				name: `screenshot-${Date.now()}.png`,
				description: `Screenshot of ${parsedUrl.toString()}`,
			});
			const message = await textChannel.send({
				content: `Website screenshot for ${parsedUrl.toString()}${
					response && response.status() ? ` (HTTP ${response.status()})` : ''
				}`,
				files: [attachment],
			});
			return `Screenshot sent to #${textChannel.name}. Message ID: ${message.id}`;
		} finally {
			await page.close();
		}
	} catch (error) {
		throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

export async function search(data: {
	query: string;
	type: 'web' | 'images' | 'news';
	limit?: number;
}): Promise<string> {
	try {
		const { query, type, limit } = data;

		if (!query || query.trim().length === 0) {
			return 'Please provide a search query.';
		}

		const result = await performSearch(query, type, limit);
		return result;
	} catch (error: any) {
		console.error('Search operation error:', error);
		return `Search failed: ${error.message || 'Unknown error'}`;
	}
}

function truncateToSentence(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text.trim();
	}
	const pattern = /[.!?]\s+/g;
	let cutIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		const boundary = match.index + 1;
		if (boundary > maxLength) {
			break;
		}
		cutIndex = boundary;
	}
	if (cutIndex > 0) {
		return text.slice(0, cutIndex).trim();
	}
	return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function summarizeDfintResult(raw: string, query: string): string {
	const cleaned = raw.replace(/^🔍 \*\*DFINT Report\*\*\s*/i, '').trim();
	if (!cleaned) {
		return `No information found for "${query}".`;
	}
	const lines = cleaned
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !/^[-=_]{3,}$/.test(line));
	const entries: Array<{ title: string; content: string[] }> = [];
	const sources: string[] = [];
	let currentTitle = 'Key Points';
	let currentContent: string[] = [];
	let currentIsSources = false;
	const pushEntry = () => {
		if (currentIsSources) {
			currentContent = [];
			return;
		}
		if (currentContent.length === 0) {
			return;
		}
		entries.push({ title: currentTitle, content: currentContent.slice() });
		currentContent = [];
	};
	for (const line of lines) {
		if (/^#{2,3}\s+/.test(line)) {
			pushEntry();
			currentTitle = line.replace(/^#{2,3}\s+/, '').trim();
			currentIsSources = /source/i.test(currentTitle);
			continue;
		}
		const normalizedLine = line
			.replace(/^[-*]\s+/, '')
			.replace(/^\d+\.\s+/, '')
			.trim();
		if (!normalizedLine) {
			continue;
		}
		if (currentIsSources) {
			sources.push(normalizedLine);
			continue;
		}
		currentContent.push(normalizedLine);
	}
	pushEntry();
	const formattedEntries = entries
		.map(({ title, content }) => {
			const combined = content.join(' ').replace(/\s+/g, ' ').trim();
			if (!combined) {
				return '';
			}
			return `- ${title}: ${truncateToSentence(combined, 280)}`;
		})
		.filter((entry) => entry.length > 0)
		.slice(0, 4);
	const summaryHeader = `Summary for "${query}"`;
	const summaryBody = formattedEntries.length > 0 ? formattedEntries.join('\n') : 'No notable findings available.';
	if (sources.length === 0) {
		return `${summaryHeader}\n\n${summaryBody}`;
	}
	const formattedSources = sources.slice(0, 5).map((line) => `- ${line}`);
	return `${summaryHeader}\n\n${summaryBody}\n\nSources\n${formattedSources.join('\n')}`;
}

export async function dfint(data: {
	query: string;
	depth?: 'shallow' | 'moderate' | 'deep';
	includeImages?: boolean;
	includeNews?: boolean;
	maxResults?: number;
	engines?: Array<'google' | 'bing' | 'duckduckgo' | 'yahoo'>;
	scrapeResults?: boolean;
}): Promise<string> {
	try {
		const { query, depth, includeImages, includeNews, maxResults, engines, scrapeResults } = data;

		if (!query || query.trim().length === 0) {
			return 'Please provide a search query for DFINT.';
		}

		console.log(`[DFINT] Running intelligence query: "${query}" with options:`, {
			depth,
			includeImages,
			includeNews,
			maxResults,
			engines,
			scrapeResults,
		});

		const result = await DFINT(query, {
			depth,
			includeImages,
			includeNews,
			maxResults,
			engines,
			scrapeResults,
		});

		return summarizeDfintResult(result, query);
	} catch (error: any) {
		console.error('DFINT operation error:', error);
		return `DFINT failed: ${error.message || 'Unknown error'}`;
	}
}
