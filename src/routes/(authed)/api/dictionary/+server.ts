import { json } from '@sveltejs/kit';
import { lookupEnVn, normalizeDictionaryWord } from '#lib/server/db/dictionary.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const word = normalizeDictionaryWord(url.searchParams.get('word') ?? '');
	if (word.length < 1 || word.length > 120) {
		return json({ error: 'Enter a word (1-120 characters).' }, { status: 400 });
	}

	try {
		const translations = await lookupEnVn(word);
		return json({ word, translations });
	} catch {
		return json({ error: 'Dictionary lookup failed' }, { status: 502 });
	}
};
