function setDefaultServer(args: any, messageGuildId?: string | null): void {
	if (!args.server && messageGuildId) {
		args.server = messageGuildId;
	}
}

function normalizeChannelReference(args: any, messageChannelId: string, callName?: string): void {
	if ('channel' in args) {
		const channel = args.channel;
		const isCurrentChannelRef =
			!channel || channel.toLowerCase() === 'this channel' || channel.toLowerCase() === 'current channel';

		if (isCurrentChannelRef) {
			args.channel = messageChannelId;
		}
	} else if (callName === 'clearDiscordMessages') {
		args.channel = messageChannelId;
	} else if (callName === 'purgeChannel') {
		if (!args.channel) {
			args.channel = messageChannelId;
		}
	}
}

function validateAndCleanServer(args: any, messageGuildId?: string | null): void {
	if (!args || typeof args !== 'object' || !('server' in args)) {
		return;
	}

	const serverValue = args.server;

	if (serverValue === undefined || serverValue === null || serverValue === '') {
		if (messageGuildId) {
			args.server = messageGuildId;
		} else {
			delete args.server;
		}
		return;
	}

	if (typeof serverValue !== 'string') {
		return;
	}

	const trimmed = serverValue.trim();
	if (!trimmed) {
		if (messageGuildId) {
			args.server = messageGuildId;
		} else {
			delete args.server;
		}
		return;
	}

	const normalized = trimmed.toLowerCase();
	const isServerAlias = /^(current|this|here)(\s+(server|guild))?$/i.test(normalized);
	if (isServerAlias) {
		if (messageGuildId) {
			args.server = messageGuildId;
		} else {
			delete args.server;
		}
		return;
	}

	args.server = trimmed;
}

export function normalizeChannelArgs(
	args: any,
	messageChannelId: string,
	messageGuildId?: string | null,
	callName?: string,
): any {
	if (!args || typeof args !== 'object') {
		return args;
	}

	validateAndCleanServer(args, messageGuildId);
	setDefaultServer(args, messageGuildId);
	normalizeChannelReference(args, messageChannelId, callName);
	validateAndCleanServer(args, messageGuildId);

	return args;
}
