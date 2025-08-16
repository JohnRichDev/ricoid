export function encodeChoiceValue(v: string) {
	if (v.startsWith('=')) return `__EQ__${v.slice(1)}`;
	return v;
}

export function decodeChoiceValue(v: string) {
	if (v.startsWith('__EQ__')) return `=${v.slice('__EQ__'.length)}`;
	return v;
}
