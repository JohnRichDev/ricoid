export function clampString(input: string, limit: number): string {
	return input.length > limit ? `${input.slice(0, limit - 3)}...` : input;
}

export function setString(value: unknown): string | null {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value);
		} catch {
			return '[object Object]';
		}
	}
	const stringValue = String(value).trim();
	return stringValue.length ? stringValue : null;
}

function splitFromSeparators(text: string): { name: string; value: string } | null {
	const separators = ['\n\n', '\r\n\r\n', '\r\n', '\n', ' — ', ' – ', ' - ', ': ', ' | ', ' • ', ' ~ ', ' → ', ' => '];
	for (const separator of separators) {
		const index = text.indexOf(separator);
		if (index > 0) {
			const name = text.slice(0, index).trim();
			const value = text.slice(index + separator.length).trim();
			if (name) return { name, value };
		}
	}
	return null;
}

function deriveFieldPartsFromString(raw: string, index: number): { name: string; value: string } {
	const ZERO_WIDTH_SPACE = '\u200b';
	const condensed = raw.replace(/\s+/g, ' ').trim();
	if (!condensed) return { name: `Entry ${index + 1}`, value: ZERO_WIDTH_SPACE };

	let name = '';
	let value = '';

	const separatorResult = splitFromSeparators(raw);
	if (separatorResult) {
		name = separatorResult.name;
		value = separatorResult.value;
	}

	if (!name) {
		const sentenceRegex = /^(.{20,140}?[.!?])\s+(.*)$/s;
		const sentenceMatch = sentenceRegex.exec(condensed);
		if (sentenceMatch) {
			name = sentenceMatch[1].trim();
			value = sentenceMatch[2].trim();
		}
	}

	if (!name) {
		name = condensed.length <= 80 ? condensed : condensed.slice(0, 80).trim();
		value = condensed.length > 80 ? condensed.slice(name.length).trim() : '';
	}

	if (!value) value = condensed !== name ? condensed : ZERO_WIDTH_SPACE;
	return { name, value };
}

function parseInlineValue(inlineRaw: any): boolean | undefined {
	if (typeof inlineRaw === 'boolean') return inlineRaw;
	if (typeof inlineRaw === 'string') {
		const lowered = inlineRaw.trim().toLowerCase();
		if (lowered === 'true') return true;
		if (lowered === 'false') return false;
	}
	return undefined;
}

function normalizeObjectField(field: any): { name: string; value: string; inline?: boolean } | null {
	const nameValue = setString(field.name);
	const valueValue = setString(field.value);
	if (!nameValue || !valueValue) return null;

	const inlineValue = parseInlineValue(field.inline);
	const result: { name: string; value: string; inline?: boolean } = {
		name: clampString(nameValue, 256),
		value: clampString(valueValue, 1024),
	};
	if (typeof inlineValue === 'boolean') {
		result.inline = inlineValue;
	}
	return result;
}

function normalizeStringField(field: string, index: number): { name: string; value: string } | null {
	const ZERO_WIDTH_SPACE = '\u200b';
	const trimmed = field.trim();
	if (!trimmed) return null;

	const { name, value } = deriveFieldPartsFromString(trimmed, index);
	return {
		name: clampString(name, 256),
		value: clampString(value || ZERO_WIDTH_SPACE, 1024),
	};
}

export function normalizeFields(rawFields: unknown): Array<{ name: string; value: string; inline?: boolean }> {
	if (!Array.isArray(rawFields)) return [];

	const normalized: Array<{ name: string; value: string; inline?: boolean }> = [];
	rawFields.forEach((field, index) => {
		if (field && typeof field === 'object' && !Array.isArray(field)) {
			const result = normalizeObjectField(field);
			if (result) normalized.push(result);
		} else if (typeof field === 'string') {
			const result = normalizeStringField(field, index);
			if (result) normalized.push(result);
		}
	});
	return normalized;
}

export function extractFieldsFromDescription(description: string): {
	cleaned: string | null;
	fields: Array<{ name: string; value: string; inline?: boolean }>;
} {
	let working = description;
	const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

	working = working.replace(/"inline"\s+(true|false)/gi, '"inline": $1');
	const candidates = working.match(/\{[\s\S]*?\}/g) || [];

	for (const raw of candidates) {
		try {
			const parsed = JSON.parse(raw);
			const n = setString(parsed.name);
			const v = setString(parsed.value);
			const inl = parseInlineValue(parsed.inline);

			if (n && v) {
				fields.push({
					name: clampString(n, 256),
					value: clampString(v, 1024),
					...(typeof inl === 'boolean' ? { inline: inl } : {}),
				});
				working = working.replace(raw, '').trim();
			}
		} catch {}
	}

	const cleaned = working.trim();
	return {
		cleaned: cleaned.length > 0 ? cleaned : null,
		fields,
	};
}
