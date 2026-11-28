import { fail } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { dashboard, pomodoro } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

const USER = 'thinh'; // same single-account convention as dashboard/+page.server.ts

type PomodoroSettings = {
	focus: number;
	shortbreak: number;
	longbreak: number;
	intervals: number;
	muted: boolean;
	screenAwake: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// jsonb is untyped: reject anything that is not a full valid settings object.
function parsePomodoroSettings(value: unknown): PomodoroSettings | null {
	if (!isRecord(value)) return null;
	const int = (raw: unknown, min: number, max: number) =>
		typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max ? raw : null;
	const focus = int(value.focus, 1, 180);
	const shortbreak = int(value.shortbreak, 1, 180);
	const longbreak = int(value.longbreak, 1, 180);
	const intervals = int(value.intervals, 1, 12);
	if (focus === null || shortbreak === null || longbreak === null || intervals === null) {
		return null;
	}
	return {
		focus,
		shortbreak,
		longbreak,
		intervals,
		muted: value.muted === true,
		screenAwake: value.screenAwake === true
	};
}

export const load: PageServerLoad = async () => {
	const [rows, [row]] = await Promise.all([
		db.select().from(pomodoro).orderBy(desc(pomodoro.date)),
		db
			.select({ pomodoroSettings: dashboard.pomodoroSettings })
			.from(dashboard)
			.where(eq(dashboard.user, USER))
			.limit(1)
	]);
	return { rows, pomodoroSettings: parsePomodoroSettings(row?.pomodoroSettings) };
};

export const actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const date = form.get('date');
		const minutes = Number(form.get('minutes'));

		// Date.parse rolls Feb 31 over to March; round-trip so Postgres never gets a calendar-invalid date.
		const parsedDate = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : null;
		const validDate =
			typeof date === 'string' &&
			/^\d{4}-\d{2}-\d{2}$/.test(date) &&
			parsedDate !== null &&
			!Number.isNaN(parsedDate.getTime()) &&
			parsedDate.toISOString().slice(0, 10) === date;

		if (!validDate || !Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
			return fail(400, { error: 'Invalid time entry.' });
		}

		await db
			.insert(pomodoro)
			.values({ date, time: minutes })
			.onConflictDoUpdate({
				target: pomodoro.date,
				set: { time: sql`${pomodoro.time} + ${minutes}` }
			});

		return { ok: true };
	},

	saveSettings: async ({ request }) => {
		const form = await request.formData();
		const int = (key: string, min: number, max: number) => {
			const raw = form.get(key);
			const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
			return Number.isInteger(value) && value >= min && value <= max ? value : null;
		};
		const focus = int('focus', 1, 180);
		const shortbreak = int('shortbreak', 1, 180);
		const longbreak = int('longbreak', 1, 180);
		const intervals = int('intervals', 1, 12);
		if (focus === null || shortbreak === null || longbreak === null || intervals === null) {
			return fail(400, { action: 'saveSettings', error: 'Invalid timer settings.' });
		}
		const pomodoroSettings: PomodoroSettings = {
			focus,
			shortbreak,
			longbreak,
			intervals,
			muted: form.get('muted') === 'true',
			screenAwake: form.get('screenAwake') === 'true'
		};
		await db
			.insert(dashboard)
			.values({ user: USER, pomodoroSettings })
			.onConflictDoUpdate({ target: dashboard.user, set: { pomodoroSettings } });
		return { action: 'saveSettings', ok: true };
	}
} satisfies Actions;
