import { asc, count, desc, eq, gt, lt, ne, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import { sanitizeHighlightHtml, type Highlight } from '#lib/highlights.ts';
import { db } from '#lib/server/db/index.ts';
import { dashboard, highlights } from '#lib/server/db/schema.ts';

const USER = 'thinh';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HighlightRow = typeof highlights.$inferSelect;
export type HighlightInsert = typeof highlights.$inferInsert;

function requireUuid(id: string, name = 'id'): void {
	if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error(`${name} must be a UUID`);
}

function requireText(value: string, name: string, max: number): string {
	if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} must be a non-empty string`);
	if (value.length > max) throw new Error(`${name} must be at most ${max} characters`);
	return value;
}

function requireString(value: string, name: string, max: number): string {
	if (typeof value !== 'string') throw new Error(`${name} must be a string`);
	if (value.length > max) throw new Error(`${name} must be at most ${max} characters`);
	return value;
}

function toHighlight(row: HighlightRow): Highlight {
	return {
		id: row.id,
		authors: row.authors,
		bookTile: row.bookTile,
		page: row.page,
		location: row.location,
		dateOfCreation: row.dateOfCreation,
		content: sanitizeHighlightHtml(row.content),
		type: row.type,
		like: row.like,
		note: row.note
	};
}

const lowestRemainingId = sql<string>`(select ${highlights.id} from ${highlights} order by ${highlights.id} asc limit 1)`;

export async function getHighlightById(id: string): Promise<Highlight | null> {
	requireUuid(id);
	const [row] = await db.select().from(highlights).where(eq(highlights.id, id)).limit(1);
	return row ? toHighlight(row) : null;
}

export async function getHighlightState(): Promise<{
	current: Highlight | null;
	prevId: string | null;
	nextId: string | null;
	randomId: string | null;
	recent: Highlight[];
	total: number;
}> {
	const [[dashboardRow], [totalRow], recentRows, [firstRow]] = await Promise.all([
		db.select({ currentHighlightId: dashboard.currentHighlightId }).from(dashboard).where(eq(dashboard.user, USER)).limit(1),
		db.select({ value: count() }).from(highlights),
		db.select().from(highlights).orderBy(desc(highlights.id)).limit(9),
		db.select().from(highlights).orderBy(asc(highlights.id)).limit(1)
	]);

	const empty = { current: null, prevId: null, nextId: null, randomId: null, recent: [], total: 0 };
	if (totalRow.value === 0) return empty;

	const requestedId = dashboardRow?.currentHighlightId;
	const found = requestedId
		? await db.select().from(highlights).where(eq(highlights.id, requestedId)).limit(1)
		: [];
	let currentRow = found[0];
	if (!currentRow) {
		currentRow = firstRow;
		if (!currentRow) return empty;
		await db.insert(dashboard).values({ user: USER, currentHighlightId: currentRow.id }).onConflictDoUpdate({
			target: dashboard.user,
			set: { currentHighlightId: currentRow.id }
		});
	}

	const [prevRows, nextRows, randomRows] = await Promise.all([
		db.select({ id: highlights.id }).from(highlights).where(lt(highlights.id, currentRow.id)).orderBy(desc(highlights.id)).limit(1),
		db.select({ id: highlights.id }).from(highlights).where(gt(highlights.id, currentRow.id)).orderBy(asc(highlights.id)).limit(1),
		totalRow.value > 1
			? db
					.select({ id: highlights.id })
					.from(highlights)
					.where(ne(highlights.id, currentRow.id))
					.orderBy(sql`random()`)
					.limit(1)
			: Promise.resolve([])
	]);

	return {
		current: toHighlight(currentRow),
		prevId: prevRows[0]?.id ?? null,
		nextId: nextRows[0]?.id ?? null,
		randomId: randomRows[0]?.id ?? null,
		recent: recentRows.map(toHighlight),
		total: totalRow.value
	};
}

export async function setCurrentHighlight(id: string): Promise<void> {
	requireUuid(id);
	const existing = await db.select({ id: highlights.id }).from(highlights).where(eq(highlights.id, id)).limit(1);
	if (existing.length === 0) throw new Error(`Highlight ${id} does not exist`);
	await db.insert(dashboard).values({ user: USER, currentHighlightId: id }).onConflictDoUpdate({
		target: dashboard.user,
		set: { currentHighlightId: id }
	});
}

export async function saveHighlight(input: {
	id: string;
	bookTile: string;
	authors: string;
	dateOfCreation: string;
	content: string;
	like: number;
}): Promise<void> {
	requireUuid(input?.id);
	const bookTile = requireText(input.bookTile, 'bookTile', 20000);
	const authors = requireString(input.authors, 'authors', 20000);
	const dateOfCreation = requireString(input.dateOfCreation, 'dateOfCreation', 20000);
	const content = requireString(input.content, 'content', 200000);
	if (!Number.isInteger(input.like) || input.like < 0) throw new Error('like must be a non-negative integer');
	await db
		.update(highlights)
		.set({ bookTile, authors, dateOfCreation, content: sanitizeHighlightHtml(content), like: input.like })
		.where(eq(highlights.id, input.id));
}

export async function insertHighlights(
	rows: Array<{
		authors: string;
		bookTile: string;
		page: number;
		location: string;
		dateOfCreation: string;
		content: string;
		type: string;
	}>
): Promise<number> {
	if (!Array.isArray(rows) || rows.length === 0) return 0;
	const values = rows.map((row) => {
		const authors = requireString(row.authors, 'authors', 20000);
		const bookTile = requireText(row.bookTile, 'bookTile', 20000);
		const location = requireText(row.location, 'location', 20000);
		const dateOfCreation = requireString(row.dateOfCreation, 'dateOfCreation', 20000);
		const type = requireText(row.type, 'type', 20000);
		const content = requireString(row.content, 'content', 200000);
		if (!Number.isInteger(row.page) || row.page < 0) throw new Error('page must be a non-negative integer');
		return {
			id: uuidv7(),
			authors,
			bookTile,
			page: row.page,
			location,
			dateOfCreation,
			content: sanitizeHighlightHtml(content),
			type,
			like: 0,
			note: ''
		};
	});
	await db.insert(highlights).values(values);
	return values.length;
}

export async function setLike(id: string, delta: 1 | -1): Promise<void> {
	requireUuid(id);
	if (delta !== 1 && delta !== -1) throw new Error('delta must be 1 or -1');
	await db
		.update(highlights)
		.set({ like: sql`greatest(0, ${highlights.like} + ${delta})` })
		.where(eq(highlights.id, id));
}

export async function setNote(id: string, note: string): Promise<void> {
	requireUuid(id);
	if (typeof note !== 'string' || note.length > 20000) throw new Error('note must be a string of at most 20000 characters');
	await db.update(highlights).set({ note }).where(eq(highlights.id, id));
}

export async function deleteHighlight(id: string): Promise<void> {
	requireUuid(id);
	// neon-http has no interactive transaction; a batch runs both statements in one Neon transaction.
	await db.batch([
		db.delete(highlights).where(eq(highlights.id, id)),
		db
			.insert(dashboard)
			.values({ user: USER, currentHighlightId: lowestRemainingId })
			.onConflictDoUpdate({
				target: dashboard.user,
				set: { currentHighlightId: lowestRemainingId },
				where: eq(dashboard.currentHighlightId, id)
			})
	]);
}
