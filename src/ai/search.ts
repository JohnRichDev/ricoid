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
	} else {
		console.log(`[DFINT] Using AI-powered search only (no web scraping)`);
	}

	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}

	const ai = new GoogleGenAI({
		apiKey,
	});

	const thinkingBudget = depth === 'deep' ? 10000 : depth === 'moderate' ? 5000 : 0;

	const tools = [{ codeExecution: {}, googleSearch: {} }];

	const config = {
		thinkingConfig: {
			thinkingBudget,
		},
		tools,
		systemInstruction: [
			{
				text: `You are DFINT - Digital Footprint Intelligence, an advanced research assistant.
				
Your mission is to perform comprehensive web intelligence gathering on the given query.
Conduct a ${depth} analysis and provide:
1. Overview and context
2. Key findings and facts
3. Related information and connections
4. Sources and references when available
${includeNews ? '5. Recent news and developments\n' : ''}${includeImages ? '6. Relevant visual content (image URLs)\n' : ''}
Search depth: ${depth}
Maximum results: ${maxResults}

Be thorough, factual, and organize information clearly. Prioritize recent and reliable sources.
When finding information, use the Google Search tool to gather comprehensive results.`,
			},
		],
	};

	const model = 'gemini-flash-lite-latest';

	const searchPrompt = `Conduct digital footprint intelligence on: "${query}"
	
Perform a comprehensive ${depth} search and analysis. 
${includeImages ? 'Include relevant image URLs.\n' : ''}${includeNews ? 'Include recent news and updates.\n' : ''}Limit to approximately ${maxResults} key findings.

${scrapedContent ? `Additional scraped content from web:\n${scrapedContent}\n\n` : ''}
${searchResults.length > 0 ? `Search results from ${engines.join(', ')}:\n${searchResults.map((r) => `- ${r.title} (${r.url})\n  ${r.snippet}`).join('\n\n')}\n\n` : ''}

Provide organized, actionable intelligence.`;

	const contents = [
		{
			role: 'user',
			parts: [
				{
					text: searchPrompt,
				},
			],
		},
	];

	const maxRetries = 3;
	const baseRetryDelay = 2000;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await ai.models.generateContentStream({
				model,
				config,
				contents,
			});

			let resultText = '';
			let codeOutput = '';

			for await (const chunk of response) {
				if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
					continue;
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
			}

			const finalResult = resultText || codeOutput || 'No intelligence gathered for the specified query.';
			return `🔍 **DFINT Report**\n\n${finalResult}`;
		} catch (error: any) {
			const statusCode = error?.status || 0;
			const isRetriable = statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;

			if (isRetriable && attempt < maxRetries) {
				const delay = baseRetryDelay * Math.pow(2, attempt - 1);
				console.log(`[DFINT] Search failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			console.error('[DFINT] Search error:', error);
			const errorMessage = error?.message || error?.error?.message || 'Unknown error';
			throw new Error(
				`DFINT temporarily unavailable (server error). Please try again in a moment. Details: ${errorMessage}`,
			);
		}
	}

	throw new Error('DFINT service is currently experiencing issues. Please try again later.');
}

export async function performSearch(query: string, type: 'web' | 'images' | 'news', limit?: number): Promise<string> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}

	const ai = new GoogleGenAI({
		apiKey,
	});

	const tools = [{ codeExecution: {}, googleSearch: {} }];

	const config = {
		thinkingConfig: {
			thinkingBudget: 0,
		},
		tools,
		systemInstruction: [
			{
				text: `You are a search assistant. When given a search query, provide BRIEF, concise results.
				Keep your response SHORT - aim for 2-4 sentences with only the most essential information.
				Focus on factual, up-to-date information. Be direct and to the point.
				Search type: ${type}
				${limit ? `Limit results to approximately ${limit} items.` : ''}
				${type === 'images' ? '\n**CRITICAL FOR IMAGE SEARCHES**: You MUST provide actual image URLs. Find and return direct links to images (URLs ending in .jpg, .png, .webp, etc.) that the user can view. Format your response as a list of image URLs, one per line. Do NOT just describe what images might look like - provide actual working URLs.' : ''}`,
			},
		],
	};

	const model = 'gemini-flash-lite-latest';

	const searchPrompt = generateSearchPrompt(query, type, limit);

	const contents = [
		{
			role: 'user',
			parts: [
				{
					text: searchPrompt,
				},
			],
		},
	];

	const maxRetries = 3;
	const baseRetryDelay = 2000;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await ai.models.generateContentStream({
				model,
				config,
				contents,
			});

			let resultText = '';
			let codeOutput = '';

			for await (const chunk of response) {
				if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
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
		} catch (error: any) {
			const statusCode = error?.status || 0;
			const isRetriable = statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;

			if (isRetriable && attempt < maxRetries) {
				const delay = baseRetryDelay * Math.pow(2, attempt - 1);
				console.log(`Search failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			console.error('Search error:', error);
			const errorMessage = error?.message || error?.error?.message || 'Unknown error';
			throw new Error(
				`Search temporarily unavailable (server error). Please try again in a moment. Details: ${errorMessage}`,
			);
		}
	}

	throw new Error('Search service is currently experiencing issues. Please try again later.');
}

function generateSearchPrompt(query: string, type: 'web' | 'images' | 'news', limit?: number): string {
	const limitText = limit ? ` (limit to ${limit} results)` : '';

	switch (type) {
		case 'web':
			return `Perform a web search for: "${query}"${limitText}. Provide the most relevant and up-to-date information available. Include key facts, sources if possible, and organize the information clearly.`;

		case 'images':
			return `Search for images of: "${query}"${limitText}. **CRITICAL**: You MUST find and return actual, working image URLs. Use Google Search to find images and extract their direct URLs (links ending in .jpg, .png, .webp, .gif, etc.). Provide a list of image URLs, one per line, that users can click to view the images. Do NOT describe what images would look like - provide ACTUAL URLs. If you find image results, extract and return their direct URLs.`;

		case 'news':
			return `Search for recent news about: "${query}"${limitText}. Focus on current events, recent developments, and the latest information. Provide headlines, key points, and dates when relevant.`;

		default:
			return `Search for information about: "${query}"${limitText}`;
	}
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
									//
								}
							}

							items.push({
								title: titleElem.textContent?.trim() || '',
								url: url,
								snippet: snippetElem?.textContent?.trim() || '',
							});
						}
					} catch (e) {
						//
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
