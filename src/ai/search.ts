import { GoogleGenAI } from '@google/genai';

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
