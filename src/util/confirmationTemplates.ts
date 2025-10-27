import type { ConfirmationResult } from './confirmationSystem.js';
import { createAIConfirmation } from './confirmationSystem.js';
import { generateConfirmationContent } from '../ai/responseGenerator.js';

export class ConfirmationTemplates {
	static async delete(
		channelId: string,
		userId: string,
		itemName: string,
		itemType: string = 'item',
		additionalInfo?: string,
	): Promise<ConfirmationResult> {
		const content = await generateConfirmationContent('delete', {
			itemName,
			itemType,
			additionalInfo,
			permanent: true,
			dangerous: true,
		});

		return createAIConfirmation(channelId, userId, {
			title: content.title,
			description: content.description,
			dangerous: true,
			confirmButtonLabel: content.confirmButtonLabel,
			cancelButtonLabel: content.cancelButtonLabel,
		});
	}
}
