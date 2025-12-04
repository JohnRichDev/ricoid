import { Message } from 'discord.js';
import { functionHandlers } from './functionHandlers.js';
import { normalizeChannelArgs } from './normalize.js';
import { setOperationContext, clearOperationContext } from '../../util/confirmedOperations.js';
import { createChecklistEmbed } from './checklist.js';
import type { FunctionExecutionLogEntry, FunctionExecutionStatus } from './executionTypes.js';

type FunctionResult = { name: string; result: any };

type FunctionProcessingState = {
	message: Message;
	functionResults: FunctionResult[];
	allFunctionResults: FunctionResult[];
	executionLog: FunctionExecutionLogEntry[];
	executedCallCache: Map<string, any>;
	executedResultsByName: Map<string, any>;
	functionAttemptCounts: Map<string, number>;
	loopGuardRef: { current: number };
	checklistMessage: Message | null;
	newChannelIdRef: { current: string | null };
	sequenceCounterRef: { current: number };
};

export type FunctionCallContext = FunctionProcessingState & {
	normalizedArgs: any;
	logEntryIndex: number;
	callSignature: string | null;
};

type FunctionCallBatchParams = FunctionProcessingState & {
	response: any;
	conversation: any[];
};
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
		const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
		const parts = keys.map((key) => {
			const keyStr = JSON.stringify(key);
			const valStr = stableStringify(value[key]);
			return `${keyStr}:${valStr}`;
		});
		return `{${parts.join(',')}}`;
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
	const availableFunctions = Object.keys(functionHandlers);
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

function handleScreenshotRepeat(call: any, context: FunctionCallContext, attemptCount: number): boolean {
	if (call.name !== 'screenshotWebsite' || attemptCount <= 1) return false;
	logFunctionAction(context.message, 'screenshot-repeat-skip', { name: call.name, attempt: attemptCount });
	const info =
		'Screenshot already captured for this request. Ask for another screenshot explicitly in a new message if you need a fresh capture.';
	context.functionResults.push({ name: call.name, result: info });
	context.allFunctionResults.push({ name: call.name, result: info });
	if (context.logEntryIndex >= 0)
		markEntryResult(context.executionLog[context.logEntryIndex], 'skipped', info, context.sequenceCounterRef);
	else
		pushLogEntry(context.executionLog, {
			name: call.name,
			args: call.args ?? null,
			status: 'skipped',
			result: info,
			sequence: context.sequenceCounterRef.current++,
		});
	return true;
}

function handleSingleExecutionSkip(call: any, context: FunctionCallContext): boolean {
	if (!SINGLE_EXECUTION_FUNCTIONS.has(call.name) || !context.executedResultsByName.has(call.name)) return false;
	logFunctionAction(context.message, 'single-execution-skip', { name: call.name });
	const previousResultByName = context.executedResultsByName.get(call.name);
	const duplicateMessage = formatDuplicateMessage(call.name, previousResultByName);
	context.functionResults.push({ name: call.name, result: duplicateMessage });
	context.allFunctionResults.push({ name: call.name, result: duplicateMessage });
	if (context.logEntryIndex >= 0)
		markEntryResult(
			context.executionLog[context.logEntryIndex],
			'skipped',
			duplicateMessage,
			context.sequenceCounterRef,
		);
	else
		pushLogEntry(context.executionLog, {
			name: call.name,
			args: context.normalizedArgs,
			status: 'skipped',
			result: duplicateMessage,
			sequence: context.sequenceCounterRef.current++,
		});
	context.loopGuardRef.current++;
	return true;
}

function handleSignatureDuplicateSkip(call: any, context: FunctionCallContext): boolean {
	if (!context.callSignature || !context.executedCallCache.has(context.callSignature)) return false;
	logFunctionAction(context.message, 'signature-duplicate-skip', { name: call.name });
	const previousResult = context.executedCallCache.get(context.callSignature);
	const duplicateMessage = formatDuplicateMessage(call.name, previousResult);
	context.functionResults.push({ name: call.name, result: duplicateMessage });
	context.allFunctionResults.push({ name: call.name, result: duplicateMessage });
	if (context.logEntryIndex >= 0)
		markEntryResult(
			context.executionLog[context.logEntryIndex],
			'skipped',
			duplicateMessage,
			context.sequenceCounterRef,
		);
	else
		pushLogEntry(context.executionLog, {
			name: call.name,
			args: context.normalizedArgs,
			status: 'skipped',
			result: duplicateMessage,
			sequence: context.sequenceCounterRef.current++,
		});
	context.loopGuardRef.current++;
	return true;
}

async function executeFunction(call: any, handler: Function, context: FunctionCallContext): Promise<void> {
	logFunctionAction(context.message, 'execute-start', { name: call.name, args: context.normalizedArgs });
	let result = await executeFunctionHandler(call, context.message, handler, context.normalizedArgs);
	if (call.name === 'purgeChannel' && typeof result === 'string') {
		const { newChannelId, cleanedResult } = extractNewChannelId(result);
		if (newChannelId) {
			context.newChannelIdRef.current = newChannelId;
			result = cleanedResult;
		}
	}
	context.functionResults.push({ name: call.name, result });
	context.allFunctionResults.push({ name: call.name, result });
	if (context.callSignature) context.executedCallCache.set(context.callSignature, result);
	context.executedResultsByName.set(call.name, result);
	logFunctionAction(context.message, 'execute-success', { name: call.name, result });
	if (context.logEntryIndex >= 0)
		markEntryResult(context.executionLog[context.logEntryIndex], 'success', result, context.sequenceCounterRef);
	else
		pushLogEntry(context.executionLog, {
			name: call.name,
			args: context.normalizedArgs,
			status: 'success',
			result,
			sequence: context.sequenceCounterRef.current++,
		});
}

type ProcessFunctionCallParams = FunctionProcessingState & {
	call: any;
};

function findLogEntryIndex(executionLog: FunctionExecutionLogEntry[], callName: string, callSignature: string): number {
	let index = executionLog.findIndex((e) => {
		if (e.name !== callName || e.status !== 'pending') return false;
		const entrySignature = createCallSignature(e.name, e.args);
		return entrySignature === callSignature;
	});

	if (index < 0) {
		index = executionLog.findIndex((e) => {
			if (e.name !== callName || e.status !== 'pending' || !e.args) return false;
			return typeof e.args === 'object' && Reflect.get(e.args, '__planned') === true;
		});
	}

	return index;
}

function normalizeCallArgs(call: any, message: Message): any {
	const clonedArgs =
		typeof call.args === 'object' && call.args !== null && !Array.isArray(call.args) ? { ...call.args } : call.args;
	return normalizeChannelArgs(clonedArgs, message.channelId, message.guildId || '', call.name);
}

function handleExecutionError(error: unknown, call: any, context: FunctionCallContext): void {
	if (!call.name) return;

	const errorResult = { error: error instanceof Error ? error.message : 'Unknown error' };
	context.functionResults.push({ name: call.name, result: errorResult });
	context.allFunctionResults.push({ name: call.name, result: errorResult });

	if (context.callSignature) {
		context.executedCallCache.set(context.callSignature, errorResult);
	}

	logFunctionAction(context.message, 'execute-error', { name: call.name, error: errorResult });

	if (context.logEntryIndex >= 0) {
		markEntryResult(context.executionLog[context.logEntryIndex], 'error', errorResult, context.sequenceCounterRef);
	} else {
		pushLogEntry(context.executionLog, {
			name: call.name,
			args: call.args ?? null,
			status: 'error',
			result: errorResult,
			sequence: context.sequenceCounterRef.current++,
		});
	}
}

function handleSkippedEntry(
	call: any,
	executionLog: FunctionExecutionLogEntry[],
	logEntryIndex: number,
	functionResults: Array<{ name: string; result: any }>,
	allFunctionResults: Array<{ name: string; result: any }>,
	message: Message,
): void {
	if (logEntryIndex >= 0 && executionLog[logEntryIndex].status === 'skipped') {
		const skippedInfo = executionLog[logEntryIndex].result ?? 'Skipped';
		functionResults.push({ name: call.name, result: skippedInfo });
		allFunctionResults.push({ name: call.name, result: skippedInfo });
		logFunctionAction(message, 'post-process-skip', { name: call.name, info: skippedInfo });
	}
}

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
	let logEntryIndex = -1;
	let normalizedArgs: any = null;

	try {
		if (!call.args || !call.name) return;

		normalizedArgs = normalizeCallArgs(call, message);
		callSignature = createCallSignature(call.name, normalizedArgs);
		logEntryIndex = findLogEntryIndex(executionLog, call.name, callSignature);

		const handler = functionHandlers[call.name];
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

		const context: FunctionCallContext = {
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
			normalizedArgs,
			logEntryIndex,
			callSignature,
		};

		if (handleScreenshotRepeat(call, context, attemptCount)) {
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}

		if (handleSingleExecutionSkip(call, context)) {
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}

		if (handleSignatureDuplicateSkip(call, context)) {
			await updateChecklistEmbed(checklistMessage, executionLog);
			return;
		}

		setOperationContext({ message, userId: message.author.id, channelId: message.channelId });
		try {
			await executeFunction(call, handler, context);
			await updateChecklistEmbed(checklistMessage, executionLog);
			await new Promise((r) => setTimeout(r, 500));
		} finally {
			clearOperationContext();
		}
	} catch (error) {
		handleExecutionError(error, call, {
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
			normalizedArgs: normalizedArgs ?? call.args,
			logEntryIndex,
			callSignature,
		});
		await updateChecklistEmbed(checklistMessage, executionLog);
	}

	handleSkippedEntry(call, executionLog, logEntryIndex, functionResults, allFunctionResults, message);
	await updateChecklistEmbed(checklistMessage, executionLog);
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
