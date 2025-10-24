import { GoogleGenAI } from '@google/genai';

export interface AIConfirmationContent {
	title: string;
	description: string;
	confirmButtonLabel: string;
	cancelButtonLabel?: string;
}

export async function generateConfirmationContent(
	operationType: string,
	operationDetails: Record<string, any>,
): Promise<AIConfirmationContent> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}

	const ai = new GoogleGenAI({ apiKey });

	const systemPrompt = `You are an expert at creating Discord confirmation messages. 
Your task is to generate a confirmation message for a Discord bot operation.

CRITICAL RULES:
1. Keep titles SHORT (3-6 words max) and include ONE relevant emoji at the start
2. Make descriptions clear, concise, and informative (2-3 sentences)
3. Include specific details from the operation (names, numbers, etc.)
4. Use **bold** for important items (like channel names, user names, counts)
5. Add appropriate warnings for dangerous operations
6. Keep confirm button labels SHORT (1-3 words, action-oriented)
7. Be professional but friendly in tone
8. Don't use generic phrases - be specific to the operation

EXAMPLES OF GOOD TITLES:
- "💥 Purge Channel"
- "🗑️ Delete Role"
- "🔨 Ban User"
- "📁 Create Channels"

EXAMPLES OF GOOD DESCRIPTIONS:
- "Are you sure you want to **PURGE** **#general**? This will clone the channel and delete the original, removing ALL messages forever."
- "Are you sure you want to delete the role **Moderator**? Users with this role will lose it permanently."

Return your response in this EXACT JSON format:
{
  "title": "emoji + short title",
  "description": "clear description with **bold** for important items",
  "confirmButtonLabel": "short action verb",
  "cancelButtonLabel": "Cancel"
}`;

	const userPrompt = `Generate a confirmation message for this Discord bot operation:

Operation Type: ${operationType}
Operation Details: ${JSON.stringify(operationDetails, null, 2)}

Consider:
- What is being changed/deleted/created?
- How dangerous is this action?
- What specific details should the user see?
- What's the best emoji to represent this action?
- What's the clearest way to describe what will happen?

Generate the confirmation message now.`;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-flash-latest',
			config: {
				systemInstruction: [{ text: systemPrompt }],
				responseMimeType: 'application/json',
			},
			contents: [
				{
					role: 'user',
					parts: [{ text: userPrompt }],
				},
			],
		});

		const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!responseText) {
			throw new Error('No response from AI');
		}

		const parsed = JSON.parse(responseText);

		if (!parsed.title || !parsed.description || !parsed.confirmButtonLabel) {
			throw new Error('Invalid AI response format');
		}

		return {
			title: parsed.title,
			description: parsed.description,
			confirmButtonLabel: parsed.confirmButtonLabel,
			cancelButtonLabel: parsed.cancelButtonLabel || 'Cancel',
		};
	} catch (error) {
		console.error('Error generating AI confirmation content:', error);

		const fallbackAI = new GoogleGenAI({ apiKey: apiKey! });
		try {
			const fallbackResponse = await fallbackAI.models.generateContent({
				model: 'gemini-flash-lite-latest',
				contents: [
					{
						role: 'user',
						parts: [
							{
								text: `Generate a unique confirmation message for a ${operationType} operation. Keep it brief but unique. Return JSON with: {"title": "emoji + 3-6 word title", "description": "1-2 sentence description", "confirmButtonLabel": "1-2 word action", "cancelButtonLabel": "Cancel"}`,
							},
						],
					},
				],
			});

			const fallbackText = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.text;
			if (fallbackText) {
				const fallbackParsed = JSON.parse(fallbackText);
				if (fallbackParsed.title && fallbackParsed.description && fallbackParsed.confirmButtonLabel) {
					return {
						title: fallbackParsed.title,
						description: fallbackParsed.description,
						confirmButtonLabel: fallbackParsed.confirmButtonLabel,
						cancelButtonLabel: fallbackParsed.cancelButtonLabel || 'Cancel',
					};
				}
			}
		} catch (fallbackError) {
			console.error('Fallback AI also failed:', fallbackError);
		}

		return {
			title: '⚠️ Confirm Action',
			description: `Are you sure you want to proceed with this ${operationType}? This action may not be reversible.`,
			confirmButtonLabel: 'Confirm',
			cancelButtonLabel: 'Cancel',
		};
	}
}

export async function generatePromptQuestion(
	settingType: string,
	currentValue: any,
	context: Record<string, any>,
): Promise<string> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}

	const ai = new GoogleGenAI({ apiKey });

	const systemPrompt = `You are an expert at creating clear, user-friendly prompts for Discord bot settings.
Your task is to generate a question or instruction that helps users configure a setting.

RULES:
1. Be clear and concise
2. Explain what the setting does
3. Mention the current value if relevant
4. Use a friendly, helpful tone
5. Include examples if helpful
6. Keep it to 1-2 sentences

Return just the prompt text, no JSON or formatting.`;

	const userPrompt = `Generate a prompt for this setting:

Setting Type: ${settingType}
Current Value: ${JSON.stringify(currentValue)}
Context: ${JSON.stringify(context, null, 2)}

What should we ask the user?`;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-flash-latest',
			config: {
				systemInstruction: [{ text: systemPrompt }],
			},
			contents: [
				{
					role: 'user',
					parts: [{ text: userPrompt }],
				},
			],
		});

		const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
		if (!responseText) {
			throw new Error('No response from AI');
		}

		return responseText;
	} catch (error) {
		console.error('Error generating AI prompt:', error);

		try {
			const fallbackAI = new GoogleGenAI({ apiKey: apiKey! });
			const fallbackResponse = await fallbackAI.models.generateContent({
				model: 'gemini-flash-lite-latest',
				contents: [
					{
						role: 'user',
						parts: [
							{
								text: `Generate a unique question asking for a setting value. Setting: ${settingType}, Current: ${currentValue}. Keep it 1 sentence, friendly. Make it different each time.`,
							},
						],
					},
				],
			});

			const fallbackText = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
			if (fallbackText) {
				return fallbackText;
			}
		} catch (fallbackError) {
			console.error('Fallback AI also failed:', fallbackError);
		}

		return `Please provide a value for ${settingType}. Current value: ${currentValue}`;
	}
}

export async function generateResponseText(
	context: string,
	userQuery: string,
	additionalInfo?: Record<string, any>,
): Promise<string> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}

	const ai = new GoogleGenAI({ apiKey });

	const systemPrompt = `You are a helpful Discord bot assistant. Generate clear, concise, and friendly responses.
Keep responses SHORT (1-3 sentences) unless more detail is needed.
Use Discord markdown formatting (**bold**, *italic*, \`code\`) where appropriate.`;

	const userPrompt = `Context: ${context}
User Query: ${userQuery}
${additionalInfo ? `Additional Info: ${JSON.stringify(additionalInfo, null, 2)}` : ''}

Generate a helpful response.`;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-flash-latest',
			config: {
				systemInstruction: [{ text: systemPrompt }],
			},
			contents: [
				{
					role: 'user',
					parts: [{ text: userPrompt }],
				},
			],
		});

		const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
		if (!responseText) {
			throw new Error('No response from AI');
		}

		return responseText;
	} catch (error) {
		console.error('Error generating AI response:', error);

		try {
			const fallbackAI = new GoogleGenAI({ apiKey: apiKey! });
			const fallbackResponse = await fallbackAI.models.generateContent({
				model: 'gemini-flash-lite-latest',
				contents: [
					{
						role: 'user',
						parts: [
							{
								text: `Generate a unique, brief error message explaining you had trouble processing a request. Keep it 1 sentence, friendly tone, include emoji. Make it different each time.`,
							},
						],
					},
				],
			});

			const fallbackText = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
			if (fallbackText) {
				return fallbackText;
			}
		} catch (fallbackError) {
			console.error('Fallback AI also failed:', fallbackError);
		}

		return 'I encountered an error processing your request. Please try again.';
	}
}
