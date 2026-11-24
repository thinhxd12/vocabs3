import { json } from '@sveltejs/kit';
import { desc, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { fsrs } from '#lib/server/db/schema.ts';
import { getTranslation, type WikiTranslationType } from '#lib/translation.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const raw = url.searchParams.get('word') ?? '';
	const word = raw.trim().toLowerCase();
	if (word.length < 1 || word.length > 120) {
		return json({ error: 'Enter a word (1-120 characters).' }, { status: 400 });
	}

	const [existing] = await db
		.select({ createdAt: fsrs.createdAt })
		.from(fsrs)
		.where(sql`lower(${fsrs.word}) = ${word}`)
		.orderBy(desc(fsrs.createdAt))
		.limit(1);

	const translation = await getTranslation(word).catch((): WikiTranslationType[] => []);

	return json({
		word,
		translation,
		duplicateCreatedAt: existing?.createdAt ?? null
	});
};
