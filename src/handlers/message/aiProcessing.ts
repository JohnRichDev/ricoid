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

const FALLBACK_MODEL = 'gemini-flash-latest';
const FALLBACK_MAX_SENTENCES = 2;

type FunctionResult = { name: string; result: any };

type GenerateAIContentParams = {
	aiClient: GoogleGenAI;
	modelName: string;
	config: any;
	conversation: any[];
	message: any;
	allFunctionResults: FunctionResult[];
	executionLog: FunctionExecutionLogEntry[];
	executedCallCache: Map<string, any>;
	executedResultsByName: Map<string, any>;
	checklistMessageRef: { current: any };
	newChannelIdRef: { current: string | null };
	loopGuardRef: { current: number };
	sequenceCounterRef: { current: number };
	functionAttemptCounts: Map<string, number>;
};

type ProcessAIParams = {
	aiClient: GoogleGenAI;
	modelName: string;
	config: any;
	conversation: any[];
	message: any;
	latestUserMessage: string;
	checklistMessageRef: { current: any };
	newChannelIdRef: { current: string | null };
};
async function generateFallbackResponse(aiClient: GoogleGenAI, latestUserMessage: string): Promise<string> {
	try {
		const fallback = await aiClient.models.generateContent({
			model: FALLBACK_MODEL,
			contents: [
				{
					role: 'user',
					parts: [
						{
							text: `The previous response was empty. Provide a concise, helpful reply (max ${FALLBACK_MAX_SENTENCES} sentences) to this request: ${latestUserMessage}`,
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
			entry.sequence ??= sequenceCounterRef.current++;
			changed = true;
		}
	}
	return changed;
}

function normalizeCallArguments(call: any, message: any): any {
	const callArgs =
		typeof call.args === 'object' && call.args !== null && !Array.isArray(call.args) ? { ...call.args } : call.args;
	return normalizeChannelArgs(callArgs, message.channelId, message.guildId || '', call.name);
}

function shouldAddNewCall(call: any, executionLog: FunctionExecutionLogEntry[]): boolean {
	if (SINGLE_EXECUTION_FUNCTIONS.has(call.name)) {
		return !executionLog.some((e) => e.name === call.name);
	}
	return true;
}

function updatePlannedCall(executionLog: FunctionExecutionLogEntry[], callName: string, normalizedArgs: any): boolean {
	const plannedIndex = executionLog.findIndex(
		(e) => e.name === callName && e.status === 'pending' && e.args && e.args.__planned === true,
	);
	if (plannedIndex !== -1) {
		executionLog[plannedIndex].args = normalizedArgs;
		return true;
	}
	return false;
}

function addNewCallToLog(executionLog: FunctionExecutionLogEntry[], callName: string, normalizedArgs: any): void {
	executionLog.push({
		name: callName,
		args: normalizedArgs,
		status: 'pending',
		result: null,
		plannedOrder: executionLog.length,
	});
}

async function updateChecklistMessage(checklistMessage: any, executionLog: FunctionExecutionLogEntry[]): Promise<void> {
	try {
		const embed = createChecklistEmbed(executionLog);
		await checklistMessage.edit({ embeds: [embed] });
		await new Promise((r) => setTimeout(r, 300));
	} catch {}
}

async function processInitialFunctionCalls(
	response: any,
	message: any,
	executionLog: FunctionExecutionLogEntry[],
	checklistMessageRef: { current: any },
): Promise<void> {
	if (!response.functionCalls?.length) return;

	for (const call of response.functionCalls) {
		if (!call.name) continue;

		const normalizedArgs = normalizeCallArguments(call, message);
		let shouldAdd = shouldAddNewCall(call, executionLog);

		if (shouldAdd && updatePlannedCall(executionLog, call.name, normalizedArgs)) {
			shouldAdd = false;
		}

		if (shouldAdd) {
			addNewCallToLog(executionLog, call.name, normalizedArgs);
		}
	}

	if (shouldShowChecklist(executionLog)) {
		const embed = createChecklistEmbed(executionLog);
		checklistMessageRef.current = await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
		await new Promise((r) => setTimeout(r, 300));
	}
}

async function processSubsequentFunctionCalls(
	response: any,
	message: any,
	executionLog: FunctionExecutionLogEntry[],
	checklistMessage: any,
): Promise<void> {
	if (!response.functionCalls?.length) return;

	for (const call of response.functionCalls) {
		if (!call.name) continue;

		const normalizedArgs = normalizeCallArguments(call, message);
		const callSig = createCallSignature(call.name, normalizedArgs);

		let existingIndex = executionLog.findIndex((e) => {
			if (e.name !== call.name) return false;
			return createCallSignature(e.name, e.args) === callSig;
		});

		if (existingIndex === -1 && SINGLE_EXECUTION_FUNCTIONS.has(call.name)) {
			existingIndex = executionLog.findIndex((e) => e.name === call.name);
		}

		if (existingIndex === -1 && updatePlannedCall(executionLog, call.name, normalizedArgs)) {
			continue;
		}

		if (existingIndex === -1) {
			addNewCallToLog(executionLog, call.name, normalizedArgs);
		}
	}

	await updateChecklistMessage(checklistMessage, executionLog);
}

function isRetriableError(error: any): { isRetriable: boolean; statusCode: number | null } {
	const statusCode = error && typeof error === 'object' && 'status' in error ? (error as any).status : null;
	const isRetriable = statusCode === 502 || statusCode === 503 || statusCode === 504 || statusCode === 429;
	return { isRetriable, statusCode };
}

async function retryWithBackoff(attempt: number, baseDelay: number): Promise<void> {
	const delayMs = baseDelay * Math.pow(2, attempt - 1);
	await new Promise((r) => setTimeout(r, delayMs));
}
async function generateAIContent(params: GenerateAIContentParams): Promise<{
	hasMoreFunctionCalls: boolean;
	responseText: string;
}> {
	const {
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
		functionAttemptCounts,
	} = params;
	const maxRetries = 5;
	const baseRetryDelay = 3000;
	let lastError;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await aiClient.models.generateContent({ model: modelName, config, contents: conversation });

			if (!checklistMessageRef.current) {
				await processInitialFunctionCalls(response, message, executionLog, checklistMessageRef);
			} else {
				await processSubsequentFunctionCalls(response, message, executionLog, checklistMessageRef.current);
			}

			const functionResults: FunctionResult[] = [];
			const { hasFunctionCalls: hasCurrentFunctionCalls } = await processFunctionCalls({
				response,
				conversation,
				message,
				functionResults,
				allFunctionResults,
				executionLog,
				executedCallCache,
				executedResultsByName,
				functionAttemptCounts,
				loopGuardRef,
				checklistMessage: checklistMessageRef.current,
				newChannelIdRef,
				sequenceCounterRef,
			});

			const loopGuardTriggered = loopGuardRef.current >= DUPLICATE_LOOP_THRESHOLD;
			return {
				hasMoreFunctionCalls: loopGuardTriggered ? false : hasCurrentFunctionCalls,
				responseText: loopGuardTriggered || hasCurrentFunctionCalls ? '' : extractResponseText(response),
			};
		} catch (error: any) {
			lastError = error;
			const { isRetriable } = isRetriableError(error);

			if (isRetriable && attempt < maxRetries) {
				await retryWithBackoff(attempt, baseRetryDelay);
			} else {
				throw error;
			}
		}
	}

	throw lastError;
}

async function generatePlanningPrompt(latestUserMessage: string, availableFns: string[]): Promise<string> {
	return `Analyze this request and list ALL function calls you will need to make, in the exact order you'll execute them.

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
}

function parsePlanResponse(planText: string): string[] {
	try {
		const parsed = JSON.parse(planText);
		if (Array.isArray(parsed)) {
			return parsed.filter((n) => typeof n === 'string');
		}
	} catch {}
	return [];
}

function detectUserIntent(latestUserMessage: string): { wantsEmbedOrFormatting: boolean; wantSearch: boolean } {
	const wantsEmbedOrFormatting =
		/\b(embed|rich\s*embed|format(?:ted|ting)?|layout|table|grid|card|presentation|styled)\b/i.test(latestUserMessage);
	const wantSearch = /\bsearch|news|find|look up/i.test(latestUserMessage);
	return { wantsEmbedOrFormatting, wantSearch };
}

function enrichPlanWithIntent(planList: string[], wantsEmbedOrFormatting: boolean, wantSearch: boolean): string[] {
	if (wantSearch && !planList.includes('search')) {
		planList.unshift('search');
	}
	if (wantsEmbedOrFormatting) {
		if (!planList.includes('createEmbed')) planList.push('createEmbed');
		if (!planList.includes('sendDiscordMessage')) planList.push('sendDiscordMessage');
	}
	return Array.from(new Set(planList));
}

function logActionPlan(
	message: any,
	planList: string[],
	wantsEmbedOrFormatting: boolean,
	wantSearch: boolean,
	latestUserMessage: string,
): void {
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
}

function populateExecutionLog(planList: string[], executionLog: FunctionExecutionLogEntry[]): void {
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
}

async function createInitialChecklist(
	message: any,
	executionLog: FunctionExecutionLogEntry[],
	checklistMessageRef: { current: any },
): Promise<void> {
	if (shouldShowChecklist(executionLog)) {
		const embed = createChecklistEmbed(executionLog);
		checklistMessageRef.current = await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
		await new Promise((r) => setTimeout(r, 300));
	}
}

async function initializePlanningPhase(
	aiClient: GoogleGenAI,
	latestUserMessage: string,
	message: any,
	executionLog: FunctionExecutionLogEntry[],
	checklistMessageRef: { current: any },
): Promise<void> {
	const availableFns = Object.keys(functionHandlers);
	const planningPrompt = await generatePlanningPrompt(latestUserMessage, availableFns);

	const planResp = await aiClient.models.generateContent({
		model: 'gemini-flash-latest',
		contents: [{ role: 'user', parts: [{ text: planningPrompt }] }],
	});

	const planText = planResp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
	let planList = parsePlanResponse(planText);

	const { wantsEmbedOrFormatting, wantSearch } = detectUserIntent(latestUserMessage);
	planList = enrichPlanWithIntent(planList, wantsEmbedOrFormatting, wantSearch);

	logActionPlan(message, planList, wantsEmbedOrFormatting, wantSearch, latestUserMessage);
	populateExecutionLog(planList, executionLog);
	await createInitialChecklist(message, executionLog, checklistMessageRef);
}

function buildCompletionSummary(executionLog: FunctionExecutionLogEntry[], maxRounds: number): string {
	const completedActions = executionLog
		.filter((e) => e.status === 'success')
		.map((e) => {
			let resultPreview: string;
			if (typeof e.result === 'string') {
				resultPreview = e.result.length > 100 ? `${e.result.slice(0, 100)}...` : e.result;
			} else {
				resultPreview = JSON.stringify(e.result).slice(0, 100);
			}
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

	return summary.join('\n');
}

async function finalizeChecklistIfNeeded(
	executionLog: FunctionExecutionLogEntry[],
	checklistMessageRef: { current: any },
	sequenceCounterRef: { current: number },
): Promise<void> {
	const finalizedPending = finalizePendingEntries(executionLog, sequenceCounterRef);
	if (finalizedPending && checklistMessageRef.current) {
		try {
			const embed = createChecklistEmbed(executionLog);
			await checklistMessageRef.current.edit({ embeds: [embed] });
		} catch {}
	}
}

export async function processAIResponse(params: ProcessAIParams): Promise<{
	responseText: string;
	allFunctionResults: Array<{ name: string; result: any }>;
	executionLog: FunctionExecutionLogEntry[];
}> {
	const {
		aiClient,
		modelName,
		config,
		conversation,
		message,
		latestUserMessage,
		checklistMessageRef,
		newChannelIdRef,
	} = params;
	let responseText = '';
	const maxRounds = 10;
	let round = 0;
	const allFunctionResults: Array<{ name: string; result: any }> = [];
	const executedCallCache = new Map<string, any>();
	const executedResultsByName = new Map<string, any>();
	const executionLog: FunctionExecutionLogEntry[] = [];
	const sequenceCounterRef = { current: 1 };
	const loopGuardRef = { current: 0 };
	const functionAttemptCounts = new Map<string, number>();

	try {
		if (!checklistMessageRef.current) {
			await initializePlanningPhase(aiClient, latestUserMessage, message, executionLog, checklistMessageRef);
		}
	} catch {}

	while (round < maxRounds) {
		round++;
		const { hasMoreFunctionCalls, responseText: currentResponseText } = await generateAIContent({
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
			functionAttemptCounts,
		});

		if (!hasMoreFunctionCalls) {
			responseText = currentResponseText;
			break;
		}
	}

	if (round >= maxRounds) {
		responseText = buildCompletionSummary(executionLog, maxRounds);
	}

	await finalizeChecklistIfNeeded(executionLog, checklistMessageRef, sequenceCounterRef);

	if (!responseText.trim()) {
		responseText = await generateFallbackResponse(aiClient, latestUserMessage);
	}

	return { responseText, allFunctionResults, executionLog };
}
export { generateFallbackResponse };
