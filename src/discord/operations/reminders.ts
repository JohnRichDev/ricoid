import type { ReminderData } from '../../types/index.js';
import { REMINDER_MAX_DELAY_MS } from '../../util/constants.js';
import { getPendingReminders, saveReminder, deleteReminder } from '../../util/settingsStore.js';
import { generateId } from '../../util/helpers.js';
import { findServer, findTextChannel } from './core.js';
import { findSuitableChannel } from './channelManagement.js';
import type { TextChannel } from 'discord.js';

function formatReminderSetupMessage(message: string, reminderTime: Date, user?: string, channel?: string) {
	let result = `Reminder set!\n`;
	result += `Message: "${message}"\n`;
	result += `Time: ${reminderTime.toLocaleString()}\n`;

	if (user) result += `For user: ${user}\n`;
	if (channel) result += `In channel: ${channel}\n`;
	result += `\nReminder will be sent at the specified time.`;

	return result;
}

async function findReminderTarget(server: string | undefined, channel: string | undefined) {
	const guild = server ? await findServer(server) : null;

	if (channel && guild) {
		return await findTextChannel(channel, server);
	} else if (guild) {
		return await findSuitableChannel(guild.id);
	}

	return null;
}

async function findReminderUser(server: string | undefined, user: string | undefined) {
	if (!user || !server) return null;

	const guild = await findServer(server);

	if (/^\d{17,19}$/.test(user)) {
		try {
			return await guild.members.fetch(user);
		} catch {
			return null;
		}
	}

	return guild.members.cache.find(
		(m) =>
			m.user.username.toLowerCase() === user.toLowerCase() ||
			m.displayName.toLowerCase() === user.toLowerCase() ||
			m.user.tag.toLowerCase() === user.toLowerCase(),
	);
}

async function sendReminderMessage(message: string, targetChannel: TextChannel | null, targetUser: any) {
	let reminderMessage = `⏰ **Reminder:** ${message}`;

	if (targetUser) {
		reminderMessage = `<@${targetUser.id}> ${reminderMessage}`;
	}

	const messageOptions = {
		content: reminderMessage,
		allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
	};

	if (targetChannel) {
		await targetChannel.send(messageOptions);
	} else if (targetUser) {
		await targetUser.send(messageOptions);
	} else {
		console.error('Could not find a channel or user to send reminder to');
	}
}

async function executeReminderById(
	reminderId: string,
	reminderData: {
		server?: string;
		user?: string;
		message: string;
		channel?: string;
	},
) {
	try {
		const targetChannel = await findReminderTarget(reminderData.server, reminderData.channel);
		const targetUser = await findReminderUser(reminderData.server, reminderData.user);
		await sendReminderMessage(reminderData.message, targetChannel, targetUser);
		await deleteReminder(reminderId);
	} catch (error) {
		console.error('Error sending reminder:', error);
		await deleteReminder(reminderId);
	}
}

export async function setReminder({ server, user, message, delay, channel }: ReminderData): Promise<string> {
	try {
		const delayMs = delay * 60 * 1000;

		if (delayMs > REMINDER_MAX_DELAY_MS) {
			return `Delay too long. Maximum delay is ${Math.floor(REMINDER_MAX_DELAY_MS / 60000)} minutes.`;
		}

		const reminderTime = new Date(Date.now() + delayMs);
		const reminderId = generateId();

		await saveReminder({
			id: reminderId,
			server,
			user,
			message,
			triggerTime: Date.now() + delayMs,
			channel,
		});

		setTimeout(() => executeReminderById(reminderId, { server, user, message, channel }), delayMs);

		return formatReminderSetupMessage(message, reminderTime, user, channel);
	} catch (error) {
		throw new Error(`Failed to set reminder: ${error}`);
	}
}

export async function initializeReminders(): Promise<void> {
	try {
		const reminders = await getPendingReminders();
		const now = Date.now();

		for (const reminder of reminders) {
			const timeUntilTrigger = reminder.triggerTime - now;

			if (timeUntilTrigger <= 0) {
				await executeReminderById(reminder.id, {
					server: reminder.server,
					user: reminder.user,
					message: reminder.message,
					channel: reminder.channel,
				});
			} else if (timeUntilTrigger <= REMINDER_MAX_DELAY_MS) {
				setTimeout(
					() =>
						executeReminderById(reminder.id, {
							server: reminder.server,
							user: reminder.user,
							message: reminder.message,
							channel: reminder.channel,
						}),
					timeUntilTrigger,
				);
			} else {
				console.warn(`Reminder ${reminder.id} has delay exceeding maximum, skipping`);
				await deleteReminder(reminder.id);
			}
		}
	} catch (error) {
		console.error('Error initializing reminders:', error);
	}
}
