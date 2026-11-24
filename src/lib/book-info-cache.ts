import type { BookDetailType } from '#lib/highlights.ts';

const STORAGE_KEY = 'bookinfo-cache';
const TTL = 1000 * 60 * 60 * 48;

type Entry = { value: BookDetailType; expires: number };
type Cache = Record<string, Entry>;

function store(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

function parse(raw: string | null): Cache {
	if (!raw) return {};
	try {
		const value: unknown = JSON.parse(raw);
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Cache)
			: {};
	} catch {
		return {};
	}
}

/** Successful lookups only; a failed crawl should be retried next time. */
export function readBookInfo(key: string): BookDetailType | null {
	const storage = store();
	if (!storage) return null;
	const entry = parse(storage.getItem(STORAGE_KEY))[key];
	if (!entry || entry.expires <= Date.now() || !entry.value || typeof entry.value !== 'object')
		return null;
	return entry.value;
}

export function writeBookInfo(key: string, value: BookDetailType) {
	const storage = store();
	if (!storage) return;
	try {
		const cache = parse(storage.getItem(STORAGE_KEY));
		const now = Date.now();
		for (const [cachedKey, entry] of Object.entries(cache)) {
			if (!entry || entry.expires <= now) delete cache[cachedKey];
		}
		cache[key] = { value, expires: now + TTL };
		storage.setItem(STORAGE_KEY, JSON.stringify(cache));
	} catch {
		// Quota or a locked store; the server cache still covers repeats.
	}
}
