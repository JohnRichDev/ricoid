export type SearchEngine = 'google' | 'bing' | 'duckduckgo' | 'yahoo';

interface SearchSelectors {
	resultContainer: string;
	titleSelector: string;
	linkSelector: string;
	snippetSelector: string;
}

interface EngineConfig {
	url: (query: string, limit: number) => string;
	selectors: SearchSelectors;
}

export const ENGINE_CONFIGS: Record<SearchEngine, EngineConfig> = {
	google: {
		url: (query, limit) => `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${limit}`,
		selectors: {
			resultContainer: 'div.g',
			titleSelector: 'h3',
			linkSelector: 'a',
			snippetSelector: 'div.VwiC3b',
		},
	},
	bing: {
		url: (query, limit) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${limit}`,
		selectors: {
			resultContainer: 'li.b_algo',
			titleSelector: 'h2',
			linkSelector: 'a',
			snippetSelector: 'p',
		},
	},
	duckduckgo: {
		url: (query, _limit) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
		selectors: {
			resultContainer: 'article[data-testid="result"]',
			titleSelector: 'h2',
			linkSelector: 'a',
			snippetSelector: 'div[data-result="snippet"]',
		},
	},
	yahoo: {
		url: (query, limit) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&n=${limit}`,
		selectors: {
			resultContainer: 'div.dd',
			titleSelector: 'h3',
			linkSelector: 'a',
			snippetSelector: 'p',
		},
	},
};

export const PUPPETEER_LAUNCH_OPTIONS = {
	headless: true,
	args: [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-blink-features=AutomationControlled',
		'--disable-dev-shm-usage',
		'--disable-gpu',
		'--window-size=1920,1080',
	],
};

export const BROWSER_VIEWPORT = { width: 1920, height: 1080 };

export const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const SCRAPE_LIMITS = {
	contentLength: 2000,
	maxLinks: 20,
	maxImages: 10,
};
