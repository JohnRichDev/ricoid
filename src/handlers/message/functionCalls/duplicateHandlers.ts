import type { FunctionCallContext } from '../functionCalls.js';
import { formatDuplicateMessage, SINGLE_EXECUTION_FUNCTIONS } from '../functionCalls.js';

const FUNCTION_LOG_PREFIX = '[FunctionAction]';
const LOG_STRING_MAX_LENGTH = 300;

function logFunctionAction(message: any, event: string, payload: Record<string, any>): void {
	const serializeForLog = (value: any): string => {
		try {
			return JSON.stringify(value, (_key, val) => {
				if (typeof val === 'string' && val.length > LOG_STRING_MAX_LENGTH)
					return `${val.slice(0, LOG_STRING_MAX_LENGTH)}...`;
				return val;
			});
		} catch {
			return '[unserializable]';
		}
	};
	const entry = {
		event,
		guild: message.guildId ?? 'DM',
		channel: message.channelId,
		user: message.author.id,
		payload,
	};
	console.log(`${FUNCTION_LOG_PREFIX} ${serializeForLog(entry)}`);
}

function pushLogEntry(executionLog: any[], entry: Omit<any, 'plannedOrder'> & { plannedOrder?: number }): void {
	executionLog.push({ ...entry, plannedOrder: entry.plannedOrder ?? executionLog.length });
}

function markEntryResult(entry: any, status: string, result: any, sequenceCounterRef: { current: number }): void {
	entry.status = status;
	entry.result = result;
	if (status !== 'pending' && entry.sequence === undefined) entry.sequence = sequenceCounterRef.current++;
}

export function handleScreenshotRepeat(call: any, context: FunctionCallContext, attemptCount: number): boolean {
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

export function handleSingleExecutionSkip(call: any, context: FunctionCallContext): boolean {
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

export function handleSignatureDuplicateSkip(call: any, context: FunctionCallContext): boolean {
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
