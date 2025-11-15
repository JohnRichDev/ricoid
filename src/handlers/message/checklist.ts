import { EmbedBuilder } from 'discord.js';
import type { FunctionExecutionLogEntry, FunctionExecutionStatus } from './executionTypes.js';
function normalizeSummaryText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}
function truncateSummary(value: string, maxLength: number = 160): string {
	return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
function summarizeObject(result: Record<string, any>): string {
	if ('error' in result && typeof result.error === 'string') return truncateSummary(normalizeSummaryText(result.error));
	const label = typeof result.title === 'string' ? result.title : typeof result.name === 'string' ? result.name : null;
	const valueField = ['value', 'description', 'content', 'message', 'text', 'summary', 'result']
		.map((key) => result[key])
		.find((val) => typeof val === 'string' && val.trim().length > 0);
	if (label && valueField) return `${label}: ${truncateSummary(normalizeSummaryText(valueField))}`;
	if (valueField) return truncateSummary(normalizeSummaryText(valueField));
	const fallbackPairs = Object.entries(result)
		.filter(([, val]) => typeof val === 'string' && val.trim().length > 0)
		.slice(0, 2)
		.map(([key, val]) => `${key}: ${truncateSummary(normalizeSummaryText(val as string))}`);
	return fallbackPairs.join('; ');
}
function formatResultSummary(result: any): string {
	if (result === undefined || result === null) return '';
	if (typeof result === 'string') return truncateSummary(normalizeSummaryText(result));
	if (Array.isArray(result)) {
		const items = result
			.map((entry) => formatResultSummary(entry))
			.filter((entry) => entry.length > 0)
			.slice(0, 3);
		return items.join('\n   • ');
	}
	if (typeof result === 'object') return summarizeObject(result);
	return truncateSummary(normalizeSummaryText(String(result)));
}
function getStatusEmoji(status: FunctionExecutionStatus): string {
	if (status === 'success') return '✅';
	if (status === 'error') return '❌';
	if (status === 'pending') return '⏳';
	return '⚠️';
}
function sortExecutionLog(executionLog: FunctionExecutionLogEntry[]): FunctionExecutionLogEntry[] {
	return [...executionLog].sort((a, b) => {
		const aSeq = a.sequence ?? Number.MAX_SAFE_INTEGER;
		const bSeq = b.sequence ?? Number.MAX_SAFE_INTEGER;
		if (aSeq !== bSeq) return aSeq - bSeq;
		const aPlan = a.plannedOrder ?? Number.MAX_SAFE_INTEGER;
		const bPlan = b.plannedOrder ?? Number.MAX_SAFE_INTEGER;
		return aPlan - bPlan;
	});
}
export function createChecklistEmbed(executionLog: FunctionExecutionLogEntry[]): EmbedBuilder {
	if (!executionLog.length)
		return new EmbedBuilder()
			.setColor(0x3498db)
			.setTitle('📋 Action Checklist')
			.setDescription('No actions to display.')
			.setTimestamp();
	const completedCount = executionLog.filter((e) => e.status === 'success').length;
	const errorCount = executionLog.filter((e) => e.status === 'error').length;
	const pendingCount = executionLog.filter((e) => e.status === 'pending').length;
	const skippedCount = executionLog.filter((e) => e.status === 'skipped').length;
	let color = 0x3498db;
	let footerText = 'Actions in progress...';
	if (errorCount === 0 && pendingCount === 0) {
		color = 0x2ecc71;
		footerText = 'All actions completed successfully!';
	} else if (errorCount > 0 && pendingCount === 0) {
		color = 0xe74c3c;
		footerText = 'Some actions failed - check details above';
	}
	const statusParts: string[] = [];
	if (completedCount > 0) statusParts.push(`✅ ${completedCount} completed`);
	if (pendingCount > 0) statusParts.push(`⏳ ${pendingCount} pending`);
	if (errorCount > 0) statusParts.push(`❌ ${errorCount} failed`);
	if (skippedCount > 0) statusParts.push(`⚠️ ${skippedCount} skipped`);
	const statusLine = statusParts.join(' • ');
	const sortedEntries = sortExecutionLog(executionLog);
	const actionLines = sortedEntries.map((entry, index) => {
		const emoji = getStatusEmoji(entry.status);
		const summary = formatResultSummary(entry.result);
		const statusText = summary || (entry.status === 'pending' ? 'Processing...' : 'Completed');
		return summary
			? `${index + 1}. ${emoji} **${entry.name}**\n   └ ${statusText}`
			: `${index + 1}. ${emoji} **${entry.name}** ${statusText}`;
	});
	const description = `${statusLine}\n\n${actionLines.join('\n')}`;
	const truncatedDescription = description.length > 4096 ? `${description.slice(0, 4093)}...` : description;
	return new EmbedBuilder()
		.setColor(color)
		.setTitle('📋 Action Checklist')
		.setDescription(truncatedDescription)
		.setFooter({ text: footerText })
		.setTimestamp();
}
