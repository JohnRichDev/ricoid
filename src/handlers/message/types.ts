export type ConversationPart =
	| { text: string }
	| { inlineData: { mimeType: string; data: string } }
	| { fileData: { mimeType: string; fileUri: string; displayName?: string } };

export type ConversationHistoryEntry = {
	role: 'user' | 'model';
	parts: ConversationPart[];
	timestamp: number;
};
