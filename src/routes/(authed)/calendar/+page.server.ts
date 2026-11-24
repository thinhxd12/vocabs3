import { asc, count } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { fsrsCompletions, progress } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 5;

export const load: PageServerLoad = async ({ depends, url }) => {
	depends('app:fsrs-completions');

	const rows = await db
		.select({ date: fsrsCompletions.date, total: count() })
		.from(fsrsCompletions)
		.groupBy(fsrsCompletions.date);

	const counts: Record<string, number> = {};
	for (const row of rows) counts[row.date] = Number(row.total);

	const countRows = await db.select({ total: count() }).from(progress);
	const totalItems = Number(countRows[0]?.total ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

	const rawPage = Number(url.searchParams.get('page'));
	const requested = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
	const currentPage = Math.min(requested, totalPages);

	const from = (totalPages - currentPage) * PAGE_SIZE;

	const selected = await db
		.select({
			id: progress.id,
			startDate: progress.startDate,
			endDate: progress.endDate
		})
		.from(progress)
		.orderBy(asc(progress.startDate), asc(progress.id))
		.limit(PAGE_SIZE)
		.offset(from);

	const progressRows = selected.map((row, i) => ({
		id: row.id,
		startDate: row.startDate,
		endDate: row.endDate,
		cycle: from + i + 1
	}));

	return { counts, progress: progressRows, totalItems, currentPage };
};
