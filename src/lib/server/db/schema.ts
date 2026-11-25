import { pgTable, integer, date, text, uuid, jsonb, timestamp, bigint, bigserial, doublePrecision, index } from 'drizzle-orm/pg-core';

export const pomodoro = pgTable('pomodoro', {
	date: date('date').primaryKey(),
	time: integer('time').notNull()
});

export const dashboard = pgTable('dashboard', {
	user: text('user').primaryKey(),
	currentHighlightId: uuid('currentHighlightId'),
	locations: jsonb('locations'),
	progress: jsonb('progress'),
	currentLocationId: uuid('currentLocationId'),
	currentForecastModel: text('currentForecastModel'),
	fsrsparams: jsonb('fsrsparams'),
	pomodoroSettings: jsonb('pomodoroSettings'),
	fsrsWordBatchSize: integer('fsrsWordBatchSize').default(9),
	words: jsonb('words')
});

export const diary = pgTable('diary', {
	id: uuid('id').primaryKey(),
	date: date('date').notNull(),
	text: text('text').notNull()
});

export const highlights = pgTable('highlights', {
	id: uuid('id').primaryKey(),
	authors: text('authors').notNull(),
	bookTile: text('bookTile').notNull(),
	page: integer('page').notNull(),
	location: text('location').notNull(),
	dateOfCreation: text('dateOfCreation').notNull(),
	content: text('content').notNull(),
	type: text('type').notNull(),
	like: integer('like').notNull(),
	note: text('note').notNull().default('')
});

export const progress = pgTable('progress', {
	id: uuid('id').primaryKey(),
	createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
	index: integer('index').notNull(),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	endDate: date('end_date', { mode: 'string' }).notNull()
});

export const saddays = pgTable('saddays', {
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).primaryKey()
});

export const fsrsCompletions = pgTable('fsrsCompletions', {
	batchId: uuid('batchId').primaryKey(),
	date: date('date', { mode: 'string' }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
});

export const fsrs = pgTable('fsrs', {
	id: uuid('id').primaryKey(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
	word: text('word').notNull().unique(),
	difficulty: doublePrecision('difficulty').notNull(),
	elapsedDays: integer('elapsed_days').notNull(),
	lapses: integer('lapses').notNull(),
	learningSteps: integer('learning_steps').notNull(),
	reps: integer('reps').notNull(),
	scheduledDays: integer('scheduled_days').notNull(),
	stability: doublePrecision('stability').notNull(),
	state: integer('state').notNull(),
	lastReview: bigint('last_review', { mode: 'number' }).notNull(),
	due: bigint('due', { mode: 'number' }).notNull()
});

export const dictionary = pgTable('dictionary', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	word: text('word').notNull(),
	definition: text('definition').notNull(),
	pos: text('pos'),
	subPos: text('sub_pos'),
	example: text('example'),
	source: text('source'),
	links: text('links')
}, (t) => [index('dictionary_word_idx').on(t.word)]);

export type DictionaryRow = typeof dictionary.$inferSelect;
export type DictionaryInsert = typeof dictionary.$inferInsert;
