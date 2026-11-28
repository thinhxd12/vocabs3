import { json } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { fsrs, fsrsCompletions, progress } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

function isValidDate(value: string | null): value is string {
	if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	// Date.parse rolls Feb 31 over to March; round-trip so Postgres never gets a calendar-invalid date.
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const GET: RequestHandler = async ({ url }) => {
	const date = url.searchParams.get('date');
	if (!isValidDate(date)) return json({ completedBatches: 0 }, { status: 400 });

	const [[row], [wordRow], [doneRow]] = await Promise.all([
		db.select({ total: count() }).from(fsrsCompletions).where(eq(fsrsCompletions.date, date)),
		db.select({ total: count() }).from(fsrs),
		db.select({ id: progress.id }).from(progress).where(eq(progress.endDate, date)).limit(1)
	]);

	return json({
		completedBatches: row?.total ?? 0,
		totalWords: wordRow?.total ?? 0,
		cycleComplete: Boolean(doneRow)
	});
};
