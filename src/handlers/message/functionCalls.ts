import { Message } from 'discord.js';
import { functionHandlers } from './functionHandlers.js';
import { normalizeChannelArgs } from './normalize.js';
import { setOperationContext, clearOperationContext } from '../../util/confirmedOperations.js';
import { createChecklistEmbed } from './checklist.js';
import type { FunctionExecutionLogEntry, FunctionExecutionStatus } from './executionTypes.js';
export const SINGLE_EXECUTION_FUNCTIONS = new Set<string>([
	'search',
	'createEmbed',
	'sendDiscordMessage',
	'executeCode',
]);
function isDestructiveOperation(entry: FunctionExecutionLogEntry): boolean {
	const destructivePatterns = /^(delete|remove|clear|purge|ban|kick|timeout|moderate)/i;
	if (destructivePatterns.test(entry.name)) return true;
	if (entry.name === 'executeCode' && entry.args?.risky === true) return true;
	const creationPatterns = /^(create|add|set|update|edit|modify|rename|move)(?!Embed)/i;
	if (creationPatterns.test(entry.name)) return true;
	return false;
}
export const DUPLICATE_LOOP_THRESHOLD = 2;
const FUNCTION_LOG_PREFIX = '[FunctionAction]';
function serializeForLog(value: any): string {
	try {
		return JSON.stringify(value, (_key, val) => {
			if (typeof val === 'string' && val.length > 300) return `${val.slice(0, 300)}...`;
			return val;
		});
	} catch {
		return '[unserializable]';
	}
}
function logFunctionAction(message: Message, event: string, payload: Record<string, any>): void {
	const entry = {
		event,
		guild: message.guildId ?? 'DM',
		channel: message.channelId,
		user: message.author.id,
		payload,
	};
	console.log(`${FUNCTION_LOG_PREFIX} ${serializeForLog(entry)}`);
}
function stableStringify(value: any): string {
	if (value === undefined) return 'undefined';
	if (value === null) return 'null';
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
	if (typeof value === 'object') {
		const keys = Object.keys(value).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as any)[key])}`).join(',')}}`;
	}
	return JSON.stringify(String(value));
}
export function createCallSignature(name: string, args: any): string {
	return `${name}:${stableStringify(args)}`;
}
export function formatDuplicateMessage(name: string, previousResult: any): string {
	let formattedResult: string;
	if (typeof previousResult === 'string') formattedResult = previousResult;
	else {
		try {
			formattedResult = JSON.stringify(previousResult);
		} catch {
			formattedResult = String(previousResult);
		}
	}
	return `Duplicate call for ${name} skipped. This function already succeeded for the current request—stop calling ${name} again and finish your final response using the previous result: ${formattedResult}`;
}
export function extractNewChannelId(result: string): { newChannelId: string | null; cleanedResult: string } {
	const regex = /NEW_CHANNEL_ID:(\d+)/;
	const newChannelMatch = regex.exec(result);
	if (newChannelMatch)
		return { newChannelId: newChannelMatch[1], cleanedResult: result.replace(/\s*NEW_CHANNEL_ID:\d+/, '') };
	return { newChannelId: null, cleanedResult: result };
}
export function shouldShowChecklist(executionLog: FunctionExecutionLogEntry[]): boolean {
	if (executionLog.length === 0) return false;
	return executionLog.some((entry) => isDestructiveOperation(entry));
}
function pushLogEntry(
	executionLog: FunctionExecutionLogEntry[],
	entry: Omit<FunctionExecutionLogEntry, 'plannedOrder'> & { plannedOrder?: number },
): void {
	executionLog.push({ ...entry, plannedOrder: entry.plannedOrder ?? executionLog.length });
}
function markEntryResult(
	entry: FunctionExecutionLogEntry,
	status: FunctionExecutionStatus,
	result: any,
	sequenceCounterRef: { current: number },
): void {
	entry.status = status;
	entry.result = result;
	if (status !== 'pending' && entry.sequence === undefined) entry.sequence = sequenceCounterRef.current++;
}
async function executeFunctionHandler(
	call: any,
	message: Message,
	handler: Function,
	normalizedArgs?: any,
): Promise<any> {
	const argsToUse =
		normalizedArgs ?? normalizeChannelArgs(call.args, message.channelId, message.guildId || '', call.name);
	if (call.name === 'executeCode') return await handler(argsToUse, message);
	return await handler(argsToUse);
}

async function updateChecklistEmbed(
	checklistMessage: Message | null,
	executionLog: FunctionExecutionLogEntry[],
): Promise<void> {
	if (!checklistMessage) return;
	try {
		const embed = createChecklistEmbed(executionLog);
		await checklistMessage.edit({ embeds: [embed] });
	} catch {}
}

function handleMissingHandler(
	call: any,
	message: Message,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	logEntryIndex: number,
	sequenceCounterRef: { current: number },
): void {
	logFunctionAction(message, 'handler-missing', { name: call.name });
	const availableFunctions = Object.keys(functionHandlers as any);
	const normalizedCallName = call.name.toLowerCase().replace(/_/g, '');
	const suggestion = availableFunctions.find((fn) => fn.toLowerCase().replace(/_/g, '') === normalizedCallName);
	let errorMessage = `Unknown function: ${call.name}`;
	if (suggestion) errorMessage += `. Did you mean '${suggestion}'? Use exact function names from your tools.`;
	const errorResult = { error: errorMessage };
	functionResults.push({ name: call.name, result: errorResult });
	allFunctionResults.push({ name: call.name, result: errorResult });
	if (logEntryIndex >= 0) markEntryResult(executionLog[logEntryIndex], 'error', errorResult, sequenceCounterRef);
	else
		pushLogEntry(executionLog, {
			name: call.name,
			args: call.args ?? null,
			status: 'error',
			result: errorResult,
			sequence: sequenceCounterRef.current++,
		});
}

function handleScreenshotRepeat(
	call: any,
	message: Message,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	logEntryIndex: number,
	sequenceCounterRef: { current: number },
	attemptCount: number,
): boolean {
	if (call.name !== 'screenshotWebsite' || attemptCount <= 1) return false;
	logFunctionAction(message, 'screenshot-repeat-skip', { name: call.name, attempt: attemptCount });
	const info =
		'Screenshot already captured for this request. Ask for another screenshot explicitly in a new message if you need a fresh capture.';
	functionResults.push({ name: call.name, result: info });
	allFunctionResults.push({ name: call.name, result: info });
	if (logEntryIndex >= 0) markEntryResult(executionLog[logEntryIndex], 'skipped', info, sequenceCounterRef);
	else
		pushLogEntry(executionLog, {
			name: call.name,
			args: call.args ?? null,
			status: 'skipped',
			result: info,
			sequence: sequenceCounterRef.current++,
		});
	return true;
}

function handleSingleExecutionSkip(
	call: any,
	message: Message,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	logEntryIndex: number,
	normalizedArgs: any,
	executedResultsByName: Map<string, any>,
	sequenceCounterRef: { current: number },
	loopGuardRef: { current: number },
): boolean {
	if (!SINGLE_EXECUTION_FUNCTIONS.has(call.name) || !executedResultsByName.has(call.name)) return false;
	logFunctionAction(message, 'single-execution-skip', { name: call.name });
	const previousResultByName = executedResultsByName.get(call.name);
	const duplicateMessage = formatDuplicateMessage(call.name, previousResultByName);
	functionResults.push({ name: call.name, result: duplicateMessage });
	allFunctionResults.push({ name: call.name, result: duplicateMessage });
	if (logEntryIndex >= 0) markEntryResult(executionLog[logEntryIndex], 'skipped', duplicateMessage, sequenceCounterRef);
	else
		pushLogEntry(executionLog, {
			name: call.name,
			args: normalizedArgs,
			status: 'skipped',
			result: duplicateMessage,
			sequence: sequenceCounterRef.current++,
		});
	loopGuardRef.current++;
	return true;
}

function handleSignatureDuplicateSkip(
	call: any,
	message: Message,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	logEntryIndex: number,
	normalizedArgs: any,
	executedCallCache: Map<string, any>,
	callSignature: string,
	sequenceCounterRef: { current: number },
	loopGuardRef: { current: number },
): boolean {
	if (!executedCallCache.has(callSignature)) return false;
	logFunctionAction(message, 'signature-duplicate-skip', { name: call.name });
	const previousResult = executedCallCache.get(callSignature);
	const duplicateMessage = formatDuplicateMessage(call.name, previousResult);
	functionResults.push({ name: call.name, result: duplicateMessage });
	allFunctionResults.push({ name: call.name, result: duplicateMessage });
	if (logEntryIndex >= 0) markEntryResult(executionLog[logEntryIndex], 'skipped', duplicateMessage, sequenceCounterRef);
	else
		pushLogEntry(executionLog, {
			name: call.name,
			args: normalizedArgs,
			status: 'skipped',
			result: duplicateMessage,
			sequence: sequenceCounterRef.current++,
		});
	loopGuardRef.current++;
	return true;
}

async function executeFunction(
	call: any,
	message: Message,
	handler: Function,
	normalizedArgs: any,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	logEntryIndex: number,
	executedCallCache: Map<string, any>,
	executedResultsByName: Map<string, any>,
	callSignature: string,
	sequenceCounterRef: { current: number },
	newChannelIdRef: { current: string | null },
): Promise<void> {
	logFunctionAction(message, 'execute-start', { name: call.name, args: normalizedArgs });
	let result = await executeFunctionHandler(call, message, handler, normalizedArgs);
	if (call.name === 'purgeChannel' && typeof result === 'string') {
		const { newChannelId, cleanedResult } = extractNewChannelId(result);
		if (newChannelId) {
			newChannelIdRef.current = newChannelId;
			result = cleanedResult;
		}
	}
	functionResults.push({ name: call.name, result });
	allFunctionResults.push({ name: call.name, result });
	executedCallCache.set(callSignature, result);
	executedResultsByName.set(call.name, result);
	logFunctionAction(message, 'execute-success', { name: call.name, result });
	if (logEntryIndex >= 0) markEntryResult(executionLog[logEntryIndex], 'success', result, sequenceCounterRef);
	else
		pushLogEntry(executionLog, {
			name: call.name,
			args: normalizedArgs,
			status: 'success',
			result,
			sequence: sequenceCounterRef.current++,
		});
}

type ProcessFunctionCallParams = {
	call: any;
	message: Message;
	functionResults: Array<{ name: string; result: any }>;
	allFunctionResults: Array<{ name: string; result: any }>;
	executionLog: FunctionExecutionLogEntry[];
	executedCallCache: Map<string, any>;
	executedResultsByName: Map<string, any>;
	functionAttemptCounts: Map<string, number>;
	loopGuardRef: { current: number };
	checklistMessage: Message | null;
	newChannelIdRef: { current: string | null };
	sequenceCounterRef: { current: number };
};

export async function processFunctionCall(params: ProcessFunctionCallParams): Promise<void> {
	const {
		call,
		message,
		functionResults,
		allFunctionResults,
		executionLog,
		executedCallCache,
		executedResultsByName,
		functionAttemptCounts,
		loopGuardRef,
		checklistMessage,
		newChannelIdRef,
		sequenceCounterRef,
	} = params;
	let callSignature: string | null = null;
	let logEntryIndex: number = -1;
	try {
		if (!call.args || !call.name) return;
		const clonedArgs =
			typeof call.args === 'object' && call.args !== null && !Array.isArray(call.args) ? { ...call.args } : call.args;
		const normalizedArgs = normalizeChannelArgs(clonedArgs, message.channelId, message.guildId || '', call.name);
		callSignature = createCallSignature(call.name, normalizedArgs);
		logEntryIndex = executionLog.findIndex((e) => {
			if (e.name !== call.name) return false;
			if (e.status !== 'pending') return false;
			const entrySignature = createCallSignature(e.name, e.args);
			return entrySignature === callSignature;
		});
		if (logEntryIndex < 0)
			logEntryIndex = executionLog.findIndex(
				(e) => e.name === call.name && e.status === 'pending' && e.args && (e.args as any).__planned === true,
			);
		const handler = (functionHandlers as any)[call.name];
		if (!handler) {
			handleMissingHandler(
				call,
				message,
				functionResults,
				allFunctionResults,
				executionLog,
				logEntryIndex,
				sequenceCounterRef,
			);
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}
		const attemptCount = (functionAttemptCounts.get(call.name) ?? 0) + 1;
		functionAttemptCounts.set(call.name, attemptCount);
		if (
			handleScreenshotRepeat(
				call,
				message,
				functionResults,
				allFunctionResults,
				executionLog,
				logEntryIndex,
				sequenceCounterRef,
				attemptCount,
			)
		) {
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}
		if (
			handleSingleExecutionSkip(
				call,
				message,
				functionResults,
				allFunctionResults,
				executionLog,
				logEntryIndex,
				normalizedArgs,
				executedResultsByName,
				sequenceCounterRef,
				loopGuardRef,
			)
		) {
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}
		if (
			handleSignatureDuplicateSkip(
				call,
				message,
				functionResults,
				allFunctionResults,
				executionLog,
				logEntryIndex,
				normalizedArgs,
				executedCallCache,
				callSignature,
				sequenceCounterRef,
				loopGuardRef,
			)
		) {
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}
		setOperationContext({ message, userId: message.author.id, channelId: message.channelId });
		try {
			await executeFunction(
				call,
				message,
				handler,
				normalizedArgs,
				functionResults,
				allFunctionResults,
				executionLog,
				logEntryIndex,
				executedCallCache,
				executedResultsByName,
				callSignature,
				sequenceCounterRef,
				newChannelIdRef,
			);
			await updateChecklistEmbed(checklistMessage, executionLog);
			await new Promise((r) => setTimeout(r, 500));
		} finally {
			clearOperationContext();
		}
	} catch (error) {
		if (call.name) {
			const errorResult = { error: error instanceof Error ? error.message : 'Unknown error' };
			functionResults.push({ name: call.name, result: errorResult });
			allFunctionResults.push({ name: call.name, result: errorResult });
			if (callSignature) executedCallCache.set(callSignature, errorResult);
			logFunctionAction(message, 'execute-error', { name: call.name, error: errorResult });
			if (logEntryIndex >= 0) markEntryResult(executionLog[logEntryIndex], 'error', errorResult, sequenceCounterRef);
			else
				pushLogEntry(executionLog, {
					name: call.name,
					args: call.args ?? null,
					status: 'error',
					result: errorResult,
					sequence: sequenceCounterRef.current++,
				});
			await updateChecklistEmbed(checklistMessage, executionLog);
		}
	}

	if (logEntryIndex >= 0 && executionLog[logEntryIndex].status === 'skipped') {
		const skippedInfo = executionLog[logEntryIndex].result ?? 'Skipped';
		functionResults.push({ name: call.name, result: skippedInfo });
		allFunctionResults.push({ name: call.name, result: skippedInfo });
		logFunctionAction(message, 'post-process-skip', { name: call.name, info: skippedInfo });
		await updateChecklistEmbed(checklistMessage, executionLog);
	}
}
export async function processFunctionCalls(
	response: any,
	message: Message,
	conversation: any[],
	allFunctionResults: Array<{ name: string; result: any }>,
	executionLog: FunctionExecutionLogEntry[],
	executedCallCache: Map<string, any>,
	executedResultsByName: Map<string, any>,
	checklistMessage: Message | null,
	newChannelIdRef: { current: string | null },
	loopGuardRef: { current: number },
	sequenceCounterRef: { current: number },
): Promise<{ hasFunctionCalls: boolean; functionResults: Array<{ name: string; result: any }> }> {
	if (!response.functionCalls?.length) return { hasFunctionCalls: false, functionResults: [] };
	const functionResults: Array<{ name: string; result: any }> = [];
	const functionAttemptCounts = new Map<string, number>();
	for (const call of response.functionCalls) {
		await processFunctionCall({
			call,
			message,
			functionResults,
			allFunctionResults,
			executionLog,
			executedCallCache,
			executedResultsByName,
			functionAttemptCounts,
			loopGuardRef,
			checklistMessage,
			newChannelIdRef,
			sequenceCounterRef,
		});
	}
	for (const funcResult of functionResults)
		conversation.push({
			role: 'user',
			parts: [
				{
					text: (() => {
						if (typeof funcResult.result === 'string')
							return `FUNCTION RESULT FOR ${funcResult.name.toUpperCase()}:\n${funcResult.result}\n\nIMPORTANT: Use this data in your response. Do NOT say you don't have access to this information.`;
						try {
							const pretty = JSON.stringify(funcResult.result, null, 2);
							return `FUNCTION RESULT FOR ${funcResult.name.toUpperCase()}:\n${pretty}\n\nIMPORTANT: Use this data in your response. Do NOT say you don't have access to this information.`;
						} catch {
							return `FUNCTION RESULT FOR ${funcResult.name.toUpperCase()}: ${String(funcResult.result)}\n\nIMPORTANT: Use this data in your response. Do NOT say you don't have access to this information.`;
						}
					})(),
				},
			],
		});
	return { hasFunctionCalls: true, functionResults };
}
export { stableStringify };
