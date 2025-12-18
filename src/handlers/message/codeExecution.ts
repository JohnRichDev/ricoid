import { Script, createContext } from 'vm';
import { Message } from 'discord.js';
import { discordClient } from '../../discord/client.js';
import { readDiscordMessages } from '../../discord/operations.js';
import { getCachedSettings } from '../../config/index.js';
import { shouldShowConfirmation } from '../../commands/utility/settings/confirmationModule.js';
import { createAIConfirmation } from '../../util/confirmationSystem.js';

async function handleCodeExecutionConfirmationInternal(code: string, message?: Message): Promise<string | null> {
	const settings = getCachedSettings();
	if (!shouldShowConfirmation(settings, 'code-execution')) {
		return null;
	}

	if (!message) {
		return 'Cannot execute code: No message context for confirmation.';
	}

	const displayCode = code.length > 1000 ? code.substring(0, 1000) + '...' : code;
	const codeBlock = `\`\`\`javascript\n${displayCode}\n\`\`\``;

	const confirmation = await createAIConfirmation(message.channelId, message.author.id, {
		title: '⚠️ Execute Code',
		description: `Are you sure you want to execute the following JavaScript code?\n\n${codeBlock}\n\n⚠️ **This code has full access to the Discord API and could perform dangerous operations.**`,
		dangerous: true,
		timeout: 30000,
		confirmButtonLabel: 'Execute Code',
	});

	if (!confirmation.confirmed) {
		return confirmation.timedOut
			? 'Code execution timed out - code was not executed.'
			: 'Code execution cancelled - code was not executed.';
	}

	return null;
}

function createReadMessagesFunction(message?: Message) {
	return async (count: number = 50) => {
		if (!message) return 'No message context';
		const result = await readDiscordMessages({
			channel: message.channelId,
			server: message.guildId || undefined,
			messageCount: count,
		});
		try {
			const messages = JSON.parse(result);
			if (Array.isArray(messages)) {
				return messages.map((msg: any) => `${msg.author}: ${msg.content}`).join('\n');
			}
			return result;
		} catch {
			return result;
		}
	};
}

function createExecutionContext(message?: Message, capturedOutput?: string[]) {
	const customConsole = {
		...console,
		log: (...args: any[]) => {
			if (capturedOutput) {
				capturedOutput.push(args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '));
			}
			console.log(...args);
		},
	};

	const context = {
		console: customConsole,
		Date,
		Math,
		JSON,
		String,
		Number,
		Array,
		Object,
		Promise,
		setTimeout,
		setInterval,
		clearTimeout,
		clearInterval,
		print: (...args: any[]) => customConsole.log(...args),
		readMessages: createReadMessagesFunction(message),
		discordClient,
		currentChannel: message?.channelId,
		currentServer: message?.guildId,
	};
	return createContext(context);
}

function wrapCode(code: string): string {
	const trimmedCode = code.trim();
	const hasMultipleStatements =
		trimmedCode.includes('\n') ||
		trimmedCode.includes(';') ||
		trimmedCode.includes('return') ||
		/^(const|let|var|if|for|while|function|class)\s/.test(trimmedCode);

	if (hasMultipleStatements) {
		return `(async () => { ${code} })()`;
	}
	return `(async () => { return ${code} })()`;
}

async function resolveResult(result: any): Promise<any> {
	const isThenable =
		result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';

	if (isThenable) {
		return await result;
	}
	return result;
}

function formatResult(finalResult: any, capturedOutput: string[]): string {
	if (finalResult === undefined && capturedOutput.length > 0) {
		return capturedOutput.join('\n');
	}

	if (finalResult === undefined) {
		return 'undefined';
	}
	if (finalResult === null) {
		return 'null';
	}
	if (typeof finalResult === 'object') {
		return JSON.stringify(finalResult, null, 2);
	}
	return String(finalResult);
}

function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}
	if (typeof error === 'string') {
		return error;
	}
	if (error && typeof error === 'object') {
		try {
			return JSON.stringify(error);
		} catch {
			return '[Error object]';
		}
	}
	return String(error);
}

export async function executeCodeWithRetries(code: string, message?: Message): Promise<string> {
	const maxRetries = 3;
	let lastError = '';

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const capturedOutput: string[] = [];
			const context = createExecutionContext(message, capturedOutput);
			const wrappedCode = wrapCode(code);
			const script = new Script(wrappedCode);
			const result = script.runInContext(context);
			const finalResult = await resolveResult(result);
			const resultStr = formatResult(finalResult, capturedOutput);

			return `Code executed successfully. Result: ${resultStr}`;
		} catch (error) {
			lastError = extractErrorMessage(error);

			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
			}
		}
	}

	return `Error executing code after ${maxRetries} attempts: ${lastError}`;
}

export async function handleCodeExecutionConfirmation(code: string, message?: Message): Promise<string | null> {
	return await handleCodeExecutionConfirmationInternal(code, message);
}
