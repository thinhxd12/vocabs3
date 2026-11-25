import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { dictionary } from '#lib/server/db/schema.ts';
import type { WikiTranslationType } from '#lib/translation.ts';

const POS_LABELS: Record<string, string> = {
	A: 'Tính từ',
	C: 'Liên từ',
	D: 'Phó từ',
	E: 'Giới từ',
	I: 'Tình thái từ',
	M: 'Lượng từ',
	N: 'Danh từ',
	O: 'Thán từ',
	P: 'Đại từ',
	R: 'Trạng từ',
	S: 'Từ đặc biệt',
	V: 'Động từ',
	X: 'Từ phụ trợ / khác',
	Z: 'Hậu tố'
};

export function normalizeDictionaryWord(word: string): string {
	return word.trim().normalize('NFC').toLowerCase();
}

export async function lookupEnVn(word: string): Promise<WikiTranslationType[]> {
	const normalized = normalizeDictionaryWord(word);
	if (normalized.length < 1 || normalized.length > 120) return [];

	const rows = await db
		.select({ pos: dictionary.pos, definition: dictionary.definition })
		.from(dictionary)
		.where(eq(dictionary.word, normalized))
		.orderBy(asc(dictionary.id))
		.limit(200);

	const grouped = new Map<string, WikiTranslationType>();
	for (const row of rows) {
		const pos = row.pos === null ? 'Definition' : (POS_LABELS[row.pos] ?? row.pos);
		const entry: WikiTranslationType = grouped.get(pos) ?? { partOfSpeech: pos, translation: [] };
		if (!entry.translation.includes(row.definition)) entry.translation.push(row.definition);
		grouped.set(pos, entry);
	}
	return [...grouped.values()];
}
