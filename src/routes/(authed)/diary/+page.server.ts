import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '#lib/server/db/index.ts';
import { diary } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DiaryEntry = {
	id: string;
	date: string;
	text: string;
};

function isoDate(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export const load: PageServerLoad = async ({ url }) => {
	const today = isoDate(new Date());
	const requested = url.searchParams.get('date') ?? '';
	const isDefault = !ISO_DATE.test(requested);
	const date = isDefault || requested > today ? today : requested;

	const [datesRows, entryRows] = await Promise.all([
		db.select({ date: diary.date }).from(diary).orderBy(diary.date),
		db
			.select({ id: diary.id, date: diary.date, text: diary.text })
			.from(diary)
			.where(eq(diary.date, date))
			.orderBy(desc(diary.id))
			.limit(1)
	]);

	const dates = [...new Set(datesRows.map((row) => row.date))];

	return {
		entry: (entryRows[0] ?? null) as DiaryEntry | null,
		date,
		isDefault,
		today,
		dates
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const date = String(form.get('date') ?? '').trim();
		const text = String(form.get('text') ?? '').trim();
		const state = { scope: 'save' as const, error: '' };

		if (!ISO_DATE.test(date)) {
			return fail(400, { ...state, error: 'Pick a valid date.' });
		}

		// The browser's day is authoritative near midnight; the server clock is the fallback.
		const clientToday = String(form.get('today') ?? '').trim();
		const today = ISO_DATE.test(clientToday) ? clientToday : isoDate(new Date());
		if (date > today) {
			return fail(400, { ...state, error: 'A diary cannot look into the future.' });
		}

		if (text.length === 0) {
			return fail(400, { ...state, error: 'Write something before saving.' });
		}

		if (text.length > 20000) {
			return fail(400, { ...state, error: 'That entry is too long to save.' });
		}

		try {
			const existing = await db
				.select({ id: diary.id })
				.from(diary)
				.where(eq(diary.date, date))
				.orderBy(desc(diary.id))
				.limit(1);

			const current = existing[0];
			if (current) {
				await db.update(diary).set({ text }).where(eq(diary.id, current.id));
			} else {
				await db.insert(diary).values({ id: uuidv7(), date, text });
			}
		} catch {
			return fail(500, { ...state, error: 'Could not save the entry.' });
		}

		return state;
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const date = String(form.get('date') ?? '').trim();
		const state = { scope: 'delete' as const, error: '' };

		if (!ISO_DATE.test(date)) {
			return fail(400, { ...state, error: 'Pick a valid date.' });
		}

		try {
			await db.delete(diary).where(eq(diary.date, date));
		} catch {
			return fail(500, { ...state, error: 'Could not delete the entry.' });
		}

		return state;
	}
};
