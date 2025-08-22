import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export type StoredSettings = {
	prompt?: string;
	access?: string[];
	channel?: string;
};

const filePath = resolve(process.cwd(), 'data', 'settings.json');

async function ensureDirAndFile() {
	const dir = dirname(filePath);

	try {
		await mkdir(dir, { recursive: true });
	} catch (e) {
		// ignore
	}

	try {
		await access(filePath);
	} catch (e) {
		await writeFile(filePath, JSON.stringify({}, null, 2), 'utf8');
	}
}

export async function readSettings(): Promise<StoredSettings> {
	try {
		const raw = await readFile(filePath, 'utf8');
		return JSON.parse(raw) as StoredSettings;
	} catch (e) {
		return {};
	}
}

export async function writeSettings(settings: StoredSettings): Promise<void> {
	try {
		await mkdir(dirname(filePath), { recursive: true });
	} catch (e) {
		// ignore
	}
	await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

ensureDirAndFile().catch(() => undefined);
