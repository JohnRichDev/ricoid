export const DISCORD_LIMITS = {
	MESSAGE_FETCH_LIMIT: 100,
	POLL_MIN_OPTIONS: 2,
	POLL_MAX_OPTIONS: 10,
	SLOWMODE_MIN_SECONDS: 0,
	SLOWMODE_MAX_SECONDS: 21600,
	TIMEOUT_MAX_DAYS: 28,
	MESSAGE_CONTENT_MAX_LENGTH: 2000,
	EMBED_DESCRIPTION_MAX_LENGTH: 4096,
	CHANNEL_NAME_MAX_LENGTH: 100,
	ROLE_NAME_MAX_LENGTH: 100,
} as const;

export const DISCORD_SNOWFLAKE_REGEX = /^\d{17,19}$/;

export const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'] as const;

export const BULK_DELETE_MIN_AGE_MS = 30 * 1000;
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const CHANNEL_TYPES = {
	TEXT: 0,
	VOICE: 2,
	CATEGORY: 4,
	ANNOUNCEMENT: 5,
	FORUM: 15,
} as const;

export const REMINDER_MAX_DELAY_MS = 2147483647;

export const HEX_COLOR_REGEX = /^#?[0-9A-Fa-f]{6}$/;

export const IMAGE_URL_REGEX = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i;
