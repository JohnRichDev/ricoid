import { GoogleGenAI } from '@google/genai';
import { normalizeChannelArgs } from './normalize.js';
import { functionHandlers } from './functionHandlers.js';
import { createChecklistEmbed } from './checklist.js';
import {
	SINGLE_EXECUTION_FUNCTIONS,
	processFunctionCalls,
	createCallSignature,
	DUPLICATE_LOOP_THRESHOLD,
	shouldShowChecklist,
} from './functionCalls.js';
import type { FunctionExecutionLogEntry } from './executionTypes.js';
import { extractResponseText } from './conversation.js';
async function generateFallbackResponse(aiClient: GoogleGenAI, latestUserMessage: string): Promise<string> {
	try {
		const fallback = await aiClient.models.generateContent({
			model: 'gemini-flash-latest',
			contents: [
				{
					role: 'user',
					parts: [
						{
							text: `The previous response was empty. Provide a concise, helpful reply (max two sentences) to this request: ${latestUserMessage}`,
						},
					],
				},
			],
		});
		const text = fallback.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
		if (text) return text;
	} catch {}
	return `I received your request: ${latestUserMessage}. I could not retrieve additional context, but I am ready to help if you can clarify or provide more details.`;
}
function finalizePendingEntries(
	executionLog: FunctionExecutionLogEntry[],
	sequenceCounterRef: { current: number },
): boolean {
	let changed = false;
	for (const entry of executionLog) {
		if (entry.status === 'pending') {
			entry.status = 'skipped';
			entry.result = 'Not required after processing';
			if (entry.sequence === undefined) entry.sequence = sequenceCounterRef.current++;
			changed = true;
		}
	}
	return changed;
}
async function generateAIContent(
	aiClient: GoogleGenAI,
	modelName: string,
	config: any,
	conversation: any[],
	message: any,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	executedCallCache: Map<string, any>,
	executedResultsByName: Map<string, any>,
	checklistMessageRef: { current: any },
	newChannelIdRef: { current: string | null },
	loopGuardRef: { current: number },
	sequenceCounterRef: { current: number },
): Promise<{ hasMoreFunctionCalls: boolean; responseText: string }> {
	const maxRetries = 5;
	const baseRetryDelay = 3000;
	let lastError;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await aiClient.models.generateContent({ model: modelName, config, contents: conversation });
			if (response.functionCalls?.length && !checklistMessageRef.current) {
				try {
					for (const call of response.functionCalls) {
						if (call.name) {
							const callArgs =
								typeof call.args === 'object' && call.args !== null && !Array.isArray(call.args)
									? { ...call.args }
									: call.args;
							const normalizedCallArgs = normalizeChannelArgs(
								callArgs,
								message.channelId,
								message.guildId || '',
								call.name,
							);
							let shouldAdd = true;
							if (SINGLE_EXECUTION_FUNCTIONS.has(call.name)) {
								const existsByName = executionLog.some((e) => e.name === call.name);
								if (existsByName) shouldAdd = false;
							}
							if (shouldAdd) {
								const plannedIndex = executionLog.findIndex(
									(e) => e.name === call.name && e.status === 'pending' && e.args && e.args.__planned === true,
								);
								if (plannedIndex !== -1) {
									executionLog[plannedIndex].args = normalizedCallArgs;
									shouldAdd = false;
								}
							}
							if (shouldAdd)
								executionLog.push({
									name: call.name,
									args: normalizedCallArgs,
									status: 'pending',
									result: null,
									plannedOrder: executionLog.length,
								});
						}
					}
					if (shouldShowChecklist(executionLog)) {
						const embed = createChecklistEmbed(executionLog);
						checklistMessageRef.current = await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
						await new Promise((r) => setTimeout(r, 300));
					}
				} catch {}
			} else if (response.functionCalls?.length && checklistMessageRef.current) {
				for (const call of response.functionCalls) {
					if (call.name) {
						const callArgs =
							typeof call.args === 'object' && call.args !== null && !Array.isArray(call.args)
								? { ...call.args }
								: call.args;
						const normalizedCallArgs = normalizeChannelArgs(
							callArgs,
							message.channelId,
							message.guildId || '',
							call.name,
						);
						const callSig = createCallSignature(call.name, normalizedCallArgs);
						let existingIndex = executionLog.findIndex((e) => {
							if (e.name !== call.name) return false;
							const entrySig = createCallSignature(e.name, e.args);
							return entrySig === callSig;
						});
						if (existingIndex === -1 && SINGLE_EXECUTION_FUNCTIONS.has(call.name))
							existingIndex = executionLog.findIndex((e) => e.name === call.name);
						if (existingIndex === -1) {
							const plannedIndex = executionLog.findIndex(
								(e) => e.name === call.name && e.status === 'pending' && e.args && e.args.__planned === true,
							);
							if (plannedIndex !== -1) {
								executionLog[plannedIndex].args = normalizedCallArgs;
								existingIndex = plannedIndex;
							}
						}
						if (existingIndex === -1)
							executionLog.push({
								name: call.name,
								args: normalizedCallArgs,
								status: 'pending',
								result: null,
								plannedOrder: executionLog.length,
							});
					}
				}
				try {
					const embed = createChecklistEmbed(executionLog);
					await checklistMessageRef.current.edit({ embeds: [embed] });
					await new Promise((r) => setTimeout(r, 300));
				} catch {}
			}
			const { hasFunctionCalls: hasCurrentFunctionCalls } = await processFunctionCalls(
				response,
				message,
				conversation,
				allFunctionResults,
				executionLog,
				executedCallCache,
				executedResultsByName,
				checklistMessageRef.current,
				newChannelIdRef,
				loopGuardRef,
				sequenceCounterRef,
			);
			const loopGuardTriggered = loopGuardRef.current >= DUPLICATE_LOOP_THRESHOLD;
			return {
				hasMoreFunctionCalls: loopGuardTriggered ? false : hasCurrentFunctionCalls,
				responseText: loopGuardTriggered || hasCurrentFunctionCalls ? '' : extractResponseText(response),
			};
		} catch (error: any) {
			lastError = error;
			const statusCode = error && typeof error === 'object' && 'status' in error ? (error as any).status : null;
			const isRetriable = statusCode === 502 || statusCode === 503 || statusCode === 504 || statusCode === 429;
			if (isRetriable && attempt < maxRetries) {
				const delayMs = baseRetryDelay * Math.pow(2, attempt - 1);
				await new Promise((r) => setTimeout(r, delayMs));
			} else {
				throw error;
			}
		}
	}
	throw lastError;
}
export async function processAIResponse(
	aiClient: GoogleGenAI,
	modelName: string,
	config: any,
	conversation: any[],
	message: any,
	latestUserMessage: string,
	checklistMessageRef: { current: any },
	newChannelIdRef: { current: string | null },
): Promise<{
	responseText: string;
	allFunctionResults: Array<{ name: string; result: any }>;
	executionLog: FunctionExecutionLogEntry[];
}> {
	let responseText = '';
	const maxRounds = 10;
	let round = 0;
	const allFunctionResults: Array<{ name: string; result: any }> = [];
	const executedCallCache = new Map<string, any>();
	const executedResultsByName = new Map<string, any>();
	const executionLog: FunctionExecutionLogEntry[] = [];
	const sequenceCounterRef = { current: 1 };
	const loopGuardRef = { current: 0 };
	try {
		if (!checklistMessageRef.current) {
			const availableFns = Object.keys(functionHandlers);
			const planningPrompt = `Analyze this request and list ALL function calls you will need to make, in the exact order you'll execute them.

Available tools: ${availableFns.join(', ')}

Request: "${latestUserMessage}"

Think through the COMPLETE workflow:
- If creating multiple items (channels, roles, etc.), list each creation separately
- If setting permissions on multiple channels, list each setChannelPermissions call
- Include the final message/response function if needed
- Count all steps: if user asks for 3 channels + 1 role + permissions on 3 channels + 1 message = that's 8+ function calls minimum

Rules:
- Use createEmbed for rich formatting/embeds
- Use sendDiscordMessage for final messages
- Avoid executeCode unless user explicitly wants custom code
- List EVERY function call, don't summarize

Respond with ONLY a JSON array of function names in execution order, e.g., ["createCategory","createChannel","createChannel","createChannel","createRole","setChannelPermissions","setChannelPermissions","setChannelPermissions","sendDiscordMessage"]`;
			const planResp = await aiClient.models.generateContent({
				model: 'gemini-flash-latest',
				contents: [{ role: 'user', parts: [{ text: planningPrompt }] }],
			});
			const planText = planResp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
			let planList: string[] = [];
			try {
				const parsed = JSON.parse(planText);
				if (Array.isArray(parsed)) planList = parsed.filter((n) => typeof n === 'string');
			} catch {}
			const wantsEmbedOrFormatting =
				/\b(embed|rich\s*embed|format(?:ted|ting)?|layout|table|grid|card|presentation|styled)\b/i.test(
					latestUserMessage,
				);
			const wantSearch = /\bsearch|news|find|look up/i.test(latestUserMessage);
			if (wantSearch && !planList.includes('search')) planList.unshift('search');
			if (wantsEmbedOrFormatting) {
				if (!planList.includes('createEmbed')) planList.push('createEmbed');
				if (!planList.includes('sendDiscordMessage')) planList.push('sendDiscordMessage');
			}
			planList = Array.from(new Set(planList));
			if (planList.length) {
				const planLogEntry = {
					messageId: message?.id ?? 'unknown',
					userId: message?.author?.id ?? 'unknown',
					plan: planList,
					flags: { structured: wantsEmbedOrFormatting, search: wantSearch },
					requestPreview: latestUserMessage.slice(0, 140),
				};
				console.log(`[ActionPlan] ${JSON.stringify(planLogEntry)}`);
			}
			for (const name of planList) {
				if (!functionHandlers[name]) continue;
				if (SINGLE_EXECUTION_FUNCTIONS.has(name) && executionLog.some((e) => e.name === name)) continue;
				executionLog.push({
					name,
					args: { __planned: true },
					status: 'pending',
					result: null,
					plannedOrder: executionLog.length,
				});
			}
			if (shouldShowChecklist(executionLog)) {
				const embed = createChecklistEmbed(executionLog);
				checklistMessageRef.current = await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
				await new Promise((r) => setTimeout(r, 300));
			}
		}
	} catch {}
	while (round < maxRounds) {
		round++;
		const { hasMoreFunctionCalls, responseText: currentResponseText } = await generateAIContent(
			aiClient,
			modelName,
			config,
			conversation,
			message,
			allFunctionResults,
			executionLog,
			executedCallCache,
			executedResultsByName,
			checklistMessageRef,
			newChannelIdRef,
			loopGuardRef,
			sequenceCounterRef,
		);
		if (!hasMoreFunctionCalls) {
			responseText = currentResponseText;
			break;
		}
	}
	if (round >= maxRounds) {
		const completedActions = executionLog
			.filter((e) => e.status === 'success')
			.map((e) => {
				const resultPreview =
					typeof e.result === 'string'
						? e.result.length > 100
							? `${e.result.slice(0, 100)}...`
							: e.result
						: JSON.stringify(e.result).slice(0, 100);
				return `✅ **${e.name}**: ${resultPreview}`;
			});
		const failedActions = executionLog
			.filter((e) => e.status === 'error')
			.map((e) => {
				const errorMsg =
					typeof e.result === 'object' && e.result?.error ? e.result.error : String(e.result || 'Unknown error');
				return `❌ **${e.name}**: ${errorMsg}`;
			});
		const skippedActions = executionLog.filter((e) => e.status === 'skipped' || e.status === 'pending').length;
		const summary: string[] = [
			`⚠️ Hit processing limit (${maxRounds} rounds). Here's what completed:`,
			'',
			'**Completed:**',
			...completedActions,
		];
		if (failedActions.length > 0) {
			summary.push('', '**Failed:**', ...failedActions);
		}
		if (skippedActions > 0) {
			summary.push('', `**Skipped:** ${skippedActions} operation(s) not completed`);
		}
		responseText = summary.join('\n');
	}
	const finalizedPending = finalizePendingEntries(executionLog, sequenceCounterRef);
	if (finalizedPending && checklistMessageRef.current) {
		try {
			const embed = createChecklistEmbed(executionLog);
			await checklistMessageRef.current.edit({ embeds: [embed] });
		} catch {}
	}
	if (!responseText.trim()) responseText = await generateFallbackResponse(aiClient, latestUserMessage);
	return { responseText, allFunctionResults, executionLog };
}
export { generateFallbackResponse };
