import { fail } from '@sveltejs/kit';
import { and, asc, count, desc, eq, gt, inArray, lte, or } from 'drizzle-orm';
import { createEmptyCard, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { v7 as uuidv7 } from 'uuid';
import { createScheduler, newWord, type Word } from '#lib/fsrs.ts';
import { db } from '#lib/server/db/index.ts';
import { dashboard, fsrs, fsrsCompletions, progress } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

// Single-account app: the existing dashboard row is keyed to this user.
const USER = 'thinh';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fsrsFields = {
	id: fsrs.id,
	createdAt: fsrs.createdAt,
	word: fsrs.word,
	difficulty: fsrs.difficulty,
	elapsedDays: fsrs.elapsedDays,
	lapses: fsrs.lapses,
	learningSteps: fsrs.learningSteps,
	reps: fsrs.reps,
	scheduledDays: fsrs.scheduledDays,
	stability: fsrs.stability,
	state: fsrs.state,
	lastReview: fsrs.lastReview,
	due: fsrs.due
};

function parseBatchSize(value: unknown): number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 99 ? value : 9;
}

function parseRating(value: unknown): Grade | null {
	if (value === '1') return Rating.Again;
	if (value === '2') return Rating.Hard;
	if (value === '3') return Rating.Good;
	if (value === '4') return Rating.Easy;
	return null;
}

function isValidDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	// Date.parse rolls Feb 31 over to March; round-trip so Postgres never gets a calendar-invalid date.
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(value: string, days: number): string {
	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(5, 7));
	const day = Number(value.slice(8, 10));
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function cardFromRow(row: typeof fsrs.$inferSelect): Card {
	if (row.due === 0) return createEmptyCard();
	return {
		due: new Date(row.due),
		last_review: row.lastReview === 0 ? undefined : new Date(row.lastReview),
		difficulty: row.difficulty,
		elapsed_days: row.elapsedDays,
		scheduled_days: row.scheduledDays,
		learning_steps: row.learningSteps,
		reps: row.reps,
		lapses: row.lapses,
		stability: row.stability,
		state: row.state as State
	};
}

function wordFromRow(row: typeof fsrs.$inferSelect): Word {
	return { id: row.id, word: row.word, createdAt: row.createdAt, card: cardFromRow(row) };
}

async function recordCompletion(batchId: string, localDate: string) {
	// A retried rating reuses the batch id; the primary key keeps it a single completion.
	await db.insert(fsrsCompletions).values({ batchId, date: localDate }).onConflictDoNothing();

	const [latest] = await db
		.select({ endDate: progress.endDate })
		.from(progress)
		.orderBy(desc(progress.endDate))
		.limit(1);
	let cycleStart = addDays(localDate, -5);
	if (latest) {
		const nextStart = addDays(latest.endDate, 1);
		if (localDate >= nextStart) {
			const elapsedDays = Math.floor(
				(Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${nextStart}T00:00:00Z`)) / 86_400_000
			);
			cycleStart = addDays(nextStart, Math.floor(elapsedDays / 6) * 6);
		}
	}
	const dates = Array.from({ length: 6 }, (_, offset) => addDays(cycleStart, offset));
	if (localDate !== dates[5]) return;

	const rows = await db
		.select({ date: fsrsCompletions.date, total: count() })
		.from(fsrsCompletions)
		.where(inArray(fsrsCompletions.date, dates))
		.groupBy(fsrsCompletions.date);
	const totals = new Map(rows.map((row) => [row.date, row.total]));
	if (!dates.every((date) => (totals.get(date) ?? 0) >= 18)) return;

	const endDate = addDays(cycleStart, 5);
	const [existing] = await db
		.select({ id: progress.id })
		.from(progress)
		.where(and(eq(progress.startDate, cycleStart), eq(progress.endDate, endDate)))
		.limit(1);
	if (existing) return;

	await db.insert(progress).values({ id: uuidv7(), index: 0, startDate: cycleStart, endDate });
}

export const load: PageServerLoad = async () => {
	const [dashboardRow] = await db
		.select({ fsrsWordBatchSize: dashboard.fsrsWordBatchSize })
		.from(dashboard)
		.where(eq(dashboard.user, USER))
		.limit(1);
	const batchSize = parseBatchSize(dashboardRow?.fsrsWordBatchSize);
	const now = Date.now();

	let remaining = batchSize;
	const learningRows =
		remaining > 0
			? await db
					.select(fsrsFields)
					.from(fsrs)
					.where(
						and(
							inArray(fsrs.state, [State.Learning, State.Relearning]),
							gt(fsrs.due, 0),
							lte(fsrs.due, now)
						)
					)
					.orderBy(asc(fsrs.due))
					.limit(remaining)
			: [];

	remaining -= learningRows.length;
	const reviewRows =
		remaining > 0
			? await db
					.select(fsrsFields)
					.from(fsrs)
					.where(and(eq(fsrs.state, State.Review), gt(fsrs.due, 0), lte(fsrs.due, now)))
					.orderBy(asc(fsrs.due))
					.limit(remaining)
			: [];

	remaining -= reviewRows.length;
	const newRows = await db
		.select(fsrsFields)
		.from(fsrs)
		.where(or(eq(fsrs.due, 0), eq(fsrs.state, State.New)))
		.orderBy(desc(fsrs.createdAt))
		.limit(remaining);

	return { words: [...learningRows, ...reviewRows, ...newRows].map(wordFromRow), batchSize };
};

export const actions = {
	addWord: async ({ request }) => {
		const form = await request.formData();
		const rawWord = form.get('word');
		const word = typeof rawWord === 'string' ? rawWord.trim().toLowerCase() : '';

		if (word.length < 1 || word.length > 120) {
			return fail(400, { action: 'addWord', error: 'Enter a word (1-120 characters).' });
		}

		try {
			const created = newWord(word);
			await db.insert(fsrs).values({
				id: created.id,
				createdAt: created.createdAt,
				word: created.word,
				difficulty: created.card.difficulty,
				elapsedDays: created.card.elapsed_days,
				lapses: created.card.lapses,
				learningSteps: created.card.learning_steps,
				reps: created.card.reps,
				scheduledDays: created.card.scheduled_days,
				stability: created.card.stability,
				state: created.card.state,
				lastReview: 0,
				due: 0
			});
		} catch (error) {
			console.error('addWord failed', error);
			return fail(500, { action: 'addWord', error: 'Could not add word. Try again.' });
		}
		return { action: 'addWord', ok: true };
	},

	rateWord: async ({ request }) => {
		const form = await request.formData();
		const rawId = form.get('id');
		const id = typeof rawId === 'string' ? rawId.trim() : '';
		const rating = parseRating(form.get('rating'));

		if (!UUID_RE.test(id) || rating === null) {
			return fail(400, { action: 'rateWord', error: 'Unknown word or rating.' });
		}

		const rawBatchId = form.get('batchId');
		const batchId = typeof rawBatchId === 'string' ? rawBatchId.trim() : '';
		const rawLocalDate = form.get('localDate');
		const localDate = typeof rawLocalDate === 'string' ? rawLocalDate.trim() : '';
		const complete = form.get('complete') === '1';

		if (complete && (!UUID_RE.test(batchId) || !isValidDate(localDate))) {
			return fail(400, { action: 'rateWord', error: 'Invalid batch completion.' });
		}

		const [row] = await db.select(fsrsFields).from(fsrs).where(eq(fsrs.id, id)).limit(1);
		if (!row) {
			return fail(400, { action: 'rateWord', error: 'Word not found.' });
		}

		const next = createScheduler().next(cardFromRow(row), new Date(), rating).card;
		await db
			.update(fsrs)
			.set({
				difficulty: next.difficulty,
				elapsedDays: next.elapsed_days,
				lapses: next.lapses,
				learningSteps: next.learning_steps,
				reps: next.reps,
				scheduledDays: next.scheduled_days,
				stability: next.stability,
				state: next.state,
				lastReview: next.last_review?.getTime() ?? 0,
				due: next.due.getTime()
			})
			.where(eq(fsrs.id, id));
		if (complete) {
			try {
				await recordCompletion(batchId, localDate);
			} catch (error) {
				console.error('Failed to record FSRS batch completion', error);
			}
		}
		return { action: 'rateWord', ok: true };
	}
} satisfies Actions;
