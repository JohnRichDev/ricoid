import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer';

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	source?: string;
}

interface ScrapedData {
	title?: string;
	content: string;
	links: string[];
	images: string[];
}

async function performWebScraping(
	query: string,
	engines: Array<'google' | 'bing' | 'duckduckgo' | 'yahoo'>,
	maxResults: number,
): Promise<{ searchResults: SearchResult[]; scrapedContent: string }> {
	let searchResults: SearchResult[] = [];
	let scrapedContent = '';

	console.log(`[DFINT] Web scraping enabled. Searching across ${engines.length} engine(s): ${engines.join(', ')}`);

	for (const engine of engines) {
		try {
			const results = await searchWithEngine(query, engine, Math.ceil(maxResults / engines.length));
			searchResults.push(...results);
			console.log(`[DFINT] Successfully retrieved ${results.length} results from ${engine}`);
		} catch (error: any) {
			console.warn(`[DFINT] Failed to search ${engine}: ${error.message}`);
		}
	}

	if (searchResults.length > 0) {
		console.log(`[DFINT] Scraping content from ${Math.min(3, searchResults.length)} top results...`);
		const topResults = searchResults.slice(0, 3);

		for (const result of topResults) {
			try {
				const scraped = await scrapeWebpage(result.url);
				scrapedContent += `\n\n### ${result.title}\nSource: ${result.url}\n${scraped.content.slice(0, 500)}...\n`;
				console.log(`[DFINT] Successfully scraped ${result.url}`);
			} catch (error: any) {
				console.warn(`[DFINT] Failed to scrape ${result.url}: ${error.message}`);
			}
		}
	} else {
		console.log(`[DFINT] No results from search engines. Falling back to AI-only search.`);
	}

	return { searchResults, scrapedContent };
}

function createDfintConfig(depth: string, includeNews: boolean, includeImages: boolean, maxResults: number): any {
	let thinkingBudget = 0;
	if (depth === 'deep') {
		thinkingBudget = 10000;
	} else if (depth === 'moderate') {
		thinkingBudget = 5000;
	}

	const tools = [{ codeExecution: {}, googleSearch: {} }];

	return {
		thinkingConfig: { thinkingBudget },
		tools,
		systemInstruction: [
			{
				text: `You are DFINT - Digital Footprint Intelligence, an advanced research assistant.
				
Perform comprehensive web intelligence gathering on the given query.
Conduct a ${depth} analysis.
${includeNews ? 'Include recent news and developments.\n' : ''}${includeImages ? 'Include relevant visual content.\n' : ''}
Search depth: ${depth}
Maximum results: ${maxResults}`,
			},
		],
	};
}

function buildDfintPrompt(
	query: string,
	depth: string,
	includeImages: boolean,
	includeNews: boolean,
	maxResults: number,
	scrapedContent: string,
	searchResults: SearchResult[],
	engines: Array<'google' | 'bing' | 'duckduckgo' | 'yahoo'>,
): string {
	const includeImagesLine = includeImages ? 'Include images.\n' : '';
	const includeNewsLine = includeNews ? 'Include news.\n' : '';
	const scrapedSection = scrapedContent ? `Scraped content:\n${scrapedContent}\n\n` : '';
	const resultsSection =
		searchResults.length > 0
			? `Results from ${engines.join(', ')}:\n${searchResults.map((r) => `- ${r.title} (${r.url})\n  ${r.snippet}`).join('\n\n')}\n\n`
			: '';

	return `Conduct digital footprint intelligence on: "${query}"
	
Depth: ${depth}
${includeImagesLine}${includeNewsLine}Max results: ${maxResults}

${scrapedSection}${resultsSection}
Provide organized, actionable intelligence.`;
}

async function processStreamChunk(
	chunk: any,
	resultText: string,
	codeOutput: string,
): Promise<{ resultText: string; codeOutput: string }> {
	if (!chunk.candidates?.[0]?.content?.parts) {
		return { resultText, codeOutput };
	}

	const part = chunk.candidates[0].content.parts[0];

	if (part.text) {
		resultText += part.text;
	}

	if (part.executableCode) {
		console.log('[DFINT] Code executed:', part.executableCode);
	}

	if (part.codeExecutionResult) {
		codeOutput += JSON.stringify(part.codeExecutionResult);
	}

	return { resultText, codeOutput };
}

async function executeDfintStreamRequest(
	ai: GoogleGenAI,
	model: string,
	config: any,
	contents: any[],
): Promise<string> {
	const response = await ai.models.generateContentStream({ model, config, contents });

	let resultText = '';
	let codeOutput = '';

	for await (const chunk of response) {
		const result = await processStreamChunk(chunk, resultText, codeOutput);
		resultText = result.resultText;
		codeOutput = result.codeOutput;
	}

	const finalResult = resultText || codeOutput || 'No intelligence gathered for the specified query.';
	return `🔍 **DFINT Report**\n\n${finalResult}`;
}

function isDfintRetriable(error: any): boolean {
	const statusCode = error?.status || 0;
	return statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;
}

function extractDfintError(error: any): string {
	return error?.message || error?.error?.message || 'Unknown error';
}

async function executeDfintQuery(ai: GoogleGenAI, config: any, searchPrompt: string, model: string): Promise<string> {
	const contents = [
		{
			role: 'user',
			parts: [{ text: searchPrompt }],
		},
	];

	const maxRetries = 3;
	const baseRetryDelay = 2000;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await executeDfintStreamRequest(ai, model, config, contents);
		} catch (error: any) {
			if (isDfintRetriable(error) && attempt < maxRetries) {
				const delay = baseRetryDelay * Math.pow(2, attempt - 1);
				console.log(`[DFINT] Search failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			console.error('[DFINT] Search error:', error);
			const errorMessage = extractDfintError(error);
			throw new Error(
				`DFINT temporarily unavailable (server error). Please try again in a moment. Details: ${errorMessage}`,
			);
		}
	}

	throw new Error('DFINT service is currently experiencing issues. Please try again later.');
}

export async function DFINT(
	query: string,
	options?: {
		depth?: 'shallow' | 'moderate' | 'deep';
		includeImages?: boolean;
		includeNews?: boolean;
		maxResults?: number;
		engines?: Array<'google' | 'bing' | 'duckduckgo' | 'yahoo'>;
		scrapeResults?: boolean;
	},
): Promise<string> {
	const depth = options?.depth || 'moderate';
	const includeImages = options?.includeImages || false;
	const includeNews = options?.includeNews || false;
	const maxResults = options?.maxResults || 10;
	const engines = options?.engines || (options?.scrapeResults ? ['google', 'bing', 'duckduckgo', 'yahoo'] : []);
	const scrapeResults = options?.scrapeResults || false;

	let searchResults: SearchResult[] = [];
	let scrapedContent = '';

	if (scrapeResults && engines.length > 0) {
		const scraped = await performWebScraping(query, engines, maxResults);
		searchResults = scraped.searchResults;
		scrapedContent = scraped.scrapedContent;
	} else {
		console.log(`[DFINT] Using AI-powered search only (no web scraping)`);
	}

	const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('Missing API key: set GOOGLE_API_KEY (preferred) or GEMINI_API_KEY');
	}

	const ai = new GoogleGenAI({ apiKey });
	const config = createDfintConfig(depth, includeNews, includeImages, maxResults);
	const searchPrompt = buildDfintPrompt(
		query,
		depth,
		includeImages,
		includeNews,
		maxResults,
		scrapedContent,
		searchResults,
		engines,
	);

	return await executeDfintQuery(ai, config, searchPrompt, 'gemini-flash-latest');
}

export async function performSearch(query: string, type: 'web' | 'images' | 'news', limit?: number): Promise<string> {
	const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('Missing API key: set GOOGLE_API_KEY (preferred) or GEMINI_API_KEY');
	}

	const ai = new GoogleGenAI({ apiKey });
	const config = buildSearchConfig(type, limit);
	const searchPrompt = generateSearchPrompt(query, type, limit);
	const contents = [{ role: 'user', parts: [{ text: searchPrompt }] }];

	const maxRetries = 3;
	const baseRetryDelay = 2000;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await ai.models.generateContentStream({
				model: 'gemini-flash-latest',
				config,
				contents,
			});

			return await processSearchStream(response);
		} catch (error: any) {
			if (isSearchRetriable(error) && attempt < maxRetries) {
				await retrySearchWithDelay(attempt, maxRetries, baseRetryDelay);
				continue;
			}

			console.error('Search error:', error);
			const errorMessage = extractSearchError(error);
			throw new Error(
				`Search temporarily unavailable (server error). Please try again in a moment. Details: ${errorMessage}`,
			);
		}
	}

	throw new Error('Search service is currently experiencing issues. Please try again later.');
}

function generateSearchPrompt(query: string, type: 'web' | 'images' | 'news', limit?: number): string {
	const limitText = limit ? ` (limit to ${limit} results)` : '';
	return `Search for: "${query}"${limitText}. Type: ${type}.`;
}

function isSearchRetriable(error: any): boolean {
	const statusCode = error?.status || 0;
	return statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;
}

async function retrySearchWithDelay(attempt: number, maxRetries: number, baseDelay: number): Promise<void> {
	const delay = baseDelay * Math.pow(2, attempt - 1);
	console.log(`Search failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
	await new Promise((resolve) => setTimeout(resolve, delay));
}

function extractSearchError(error: any): string {
	return error?.message || error?.error?.message || 'Unknown error';
}

function buildSearchConfig(type: string, limit?: number): any {
	return {
		thinkingConfig: { thinkingBudget: 0 },
		tools: [{ codeExecution: {}, googleSearch: {} }],
		systemInstruction: [
			{
				text: `You are a search assistant. Perform the requested search and provide relevant results.
				Search type: ${type}
				${limit ? `Limit results to approximately ${limit} items.` : ''}
				If no meaningful results exist, say "No results found".`,
			},
		],
	};
}

async function processSearchStream(response: any): Promise<string> {
	let resultText = '';
	let codeOutput = '';

	for await (const chunk of response) {
		if (!chunk.candidates?.[0]?.content?.parts) {
			continue;
		}

		const part = chunk.candidates[0].content.parts[0];

		if (part.text) {
			resultText += part.text;
		}

		if (part.executableCode) {
			console.log('Code executed:', part.executableCode);
		}

		if (part.codeExecutionResult) {
			codeOutput += JSON.stringify(part.codeExecutionResult);
		}
	}

	return resultText || codeOutput || 'No results found for your search query.';
}

async function searchWithEngine(
	query: string,
	engine: 'google' | 'bing' | 'duckduckgo' | 'yahoo',
	limit: number = 10,
): Promise<SearchResult[]> {
	const browser = await puppeteer.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-blink-features=AutomationControlled',
			'--disable-dev-shm-usage',
			'--disable-gpu',
			'--window-size=1920,1080',
		],
	});

	try {
		const page = await browser.newPage();

		await page.setViewport({ width: 1920, height: 1080 });

		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		);

		await page.setExtraHTTPHeaders({
			'Accept-Language': 'en-US,en;q=0.9',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		});

		let searchUrl = '';
		let selectors = {
			resultContainer: '',
			titleSelector: '',
			linkSelector: '',
			snippetSelector: '',
		};

		switch (engine) {
			case 'google':
				searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}`;
				selectors = {
					resultContainer: 'div.g',
					titleSelector: 'h3',
					linkSelector: 'a',
					snippetSelector: 'div.VwiC3b',
				};
				break;

			case 'bing':
				searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${limit}`;
				selectors = {
					resultContainer: 'li.b_algo',
					titleSelector: 'h2',
					linkSelector: 'a',
					snippetSelector: 'p',
				};
				break;

			case 'duckduckgo':
				searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
				selectors = {
					resultContainer: 'article[data-testid="result"]',
					titleSelector: 'h2',
					linkSelector: 'a',
					snippetSelector: 'div[data-result="snippet"]',
				};
				break;

			case 'yahoo':
				searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&n=${limit}`;
				selectors = {
					resultContainer: 'div.dd',
					titleSelector: 'h3',
					linkSelector: 'a',
					snippetSelector: 'p',
				};
				break;
		}

		console.log(`[DFINT] Searching ${engine}: ${searchUrl}`);

		try {
			await page.goto(searchUrl, {
				waitUntil: 'domcontentloaded',
				timeout: 60000,
			});
		} catch (error: any) {
			throw new Error(`Failed to load ${engine} search page: ${error.message}`);
		}

		await new Promise((resolve) => setTimeout(resolve, 2000));

		const results = await page.evaluate(
			(sel, engineName) => {
				// @ts-ignore
				const doc = document;
				const items: any[] = [];
				const containers = doc.querySelectorAll(sel.resultContainer);

				containers.forEach((container: any) => {
					try {
						const titleElem = container.querySelector(sel.titleSelector);
						const linkElem = container.querySelector(sel.linkSelector);
						const snippetElem = container.querySelector(sel.snippetSelector);

						if (titleElem && linkElem) {
							let url = linkElem.href || '';

							if (engineName === 'bing' && url.includes('/ck/a?')) {
								try {
									const urlObj = new URL(url);
									const actualUrl = urlObj.searchParams.get('u');
									if (actualUrl) {
										url = decodeURIComponent(actualUrl.replace(/^a1/, ''));
									}
								} catch (e) {
									console.warn('Failed to decode Bing URL:', e);
								}
							}
							items.push({
								title: titleElem.textContent?.trim() || '',
								url: url,
								snippet: snippetElem?.textContent?.trim() || '',
							});
						}
					} catch (e) {
						console.warn('Failed to parse search result:', e);
					}
				});

				return items;
			},
			selectors as any,
			engine,
		);

		console.log(`[DFINT] Found ${results.length} results from ${engine}`);
		return results.slice(0, limit).map((r) => ({ ...r, source: engine }));
	} catch (error) {
		console.error(`[DFINT] Error searching ${engine}:`, error);
		return [];
	} finally {
		await browser.close();
	}
}

async function scrapeWebpage(url: string): Promise<ScrapedData> {
	const browser = await puppeteer.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-blink-features=AutomationControlled',
			'--disable-dev-shm-usage',
		],
	});

	try {
		const page = await browser.newPage();

		await page.setViewport({ width: 1920, height: 1080 });

		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		);

		console.log(`[DFINT] Scraping: ${url}`);

		try {
			const isRedirectUrl = url.includes('/ck/a?') || url.includes('redirect');

			await page.goto(url, {
				waitUntil: isRedirectUrl ? 'networkidle0' : 'domcontentloaded',
				timeout: 60000,
			});

			if (isRedirectUrl) {
				await new Promise((resolve) => setTimeout(resolve, 3000));
			}
		} catch (error: any) {
			throw new Error(`Failed to load page: ${error.message}`);
		}

		const data = await page.evaluate(() => {
			// @ts-ignore
			const doc = document;

			const scripts = doc.querySelectorAll('script, style, nav, footer, header');
			scripts.forEach((s: any) => s.remove());

			const main = doc.querySelector('main, article, [role="main"]') || doc.body;

			const content = main.textContent?.replace(/\s+/g, ' ').trim().slice(0, 2000);

			const links = Array.from(doc.querySelectorAll('a[href]'))
				.map((a: any) => a.href)
				.filter((href: string) => href.startsWith('http'))
				.slice(0, 20);

			const images = Array.from(doc.querySelectorAll('img[src]'))
				.map((img: any) => img.src)
				.filter((src: string) => src.startsWith('http'))
				.slice(0, 10);

			return {
				title: doc.title,
				content: content || '',
				links,
				images,
			};
		});

		console.log(`[DFINT] Scraped ${data.content.length} chars from ${url}`);
		return data;
	} catch (error) {
		console.error(`[DFINT] Error scraping ${url}:`, error);
		return {
			content: '',
			links: [],
			images: [],
		};
	} finally {
		await browser.close();
	}
}
