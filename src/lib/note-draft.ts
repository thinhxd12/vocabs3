/** Unsaved note drafts for the highlight reader, kept per highlight. */
const PREFIX = 'highlight-note:';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

type Draft = { text: string; savedAt: number };

function store(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

function drop(key: string) {
	try {
		store()?.removeItem(key);
	} catch {
		// A blocked store cannot be recovered from here.
	}
}

/** A stale draft, or one written against different saved text, is discarded. */
export function readNoteDraft(id: string, savedNote: string): string | null {
	const key = PREFIX + id;
	const storage = store();
	if (!storage) return null;

	try {
		const raw = storage.getItem(key);
		if (!raw) return null;

		const draft = JSON.parse(raw) as Partial<Draft> | null;
		if (
			!draft ||
			typeof draft.text !== 'string' ||
			typeof draft.savedAt !== 'number' ||
			draft.text === savedNote ||
			Date.now() - draft.savedAt >= MAX_AGE
		) {
			storage.removeItem(key);
			return null;
		}

		return draft.text;
	} catch {
		return null;
	}
}

export function writeNoteDraft(id: string, text: string, savedNote: string) {
	const key = PREFIX + id;
	const storage = store();
	if (!storage) return;

	if (text === savedNote) {
		drop(key);
		return;
	}

	try {
		storage.setItem(key, JSON.stringify({ text, savedAt: Date.now() } as Draft));
	} catch {
		// Quota or a locked store; losing the extra copy is not worth an error.
	}
}

export function clearNoteDraft(id: string) {
	drop(PREFIX + id);
}
