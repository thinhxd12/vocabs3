import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '#lib/server/db/index.ts';
import { dashboard } from '#lib/server/db/schema.ts';
import {
	DASHBOARD_USER,
	DEFAULT_FORECAST_MODEL,
	FORECAST_MODELS,
	isRecord,
	numericString,
	parseLocations
} from '#lib/server/dashboard.ts';
import type { Actions, PageServerLoad } from './$types';

type DashboardProgress = { id: string; date: string; count: string };

function isValidDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	// Date.parse rolls Feb 31 over to March; round-trip so Postgres never gets a calendar-invalid date.
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseProgress(value: unknown): DashboardProgress[] {
	if (!Array.isArray(value)) return [];
	return value
		.flatMap((entry) => {
			if (!isRecord(entry)) return [];
			const count = numericString(entry.count);
			return typeof entry.id === 'string' && isValidDate(entry.date) && count !== null
				? [{ id: entry.id, date: entry.date, count }]
				: [];
		})
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

async function readState() {
	const [row] = await db
		.select({
			locations: dashboard.locations,
			progress: dashboard.progress,
			currentLocationId: dashboard.currentLocationId
		})
		.from(dashboard)
		.where(eq(dashboard.user, DASHBOARD_USER))
		.limit(1);
	return row;
}

async function saveDashboard(fields: Omit<Partial<typeof dashboard.$inferInsert>, 'user'>) {
	await db
		.insert(dashboard)
		.values({ user: DASHBOARD_USER, ...fields })
		.onConflictDoUpdate({ target: dashboard.user, set: fields });
}

export const load: PageServerLoad = async () => {
	const [row] = await db
		.select({
			locations: dashboard.locations,
			progress: dashboard.progress,
			currentLocationId: dashboard.currentLocationId,
			currentForecastModel: dashboard.currentForecastModel,
			fsrsWordBatchSize: dashboard.fsrsWordBatchSize
		})
		.from(dashboard)
		.where(eq(dashboard.user, DASHBOARD_USER))
		.limit(1);

	const locations = parseLocations(row?.locations);
	const currentLocationId = locations.some((location) => location.id === row?.currentLocationId)
		? (row?.currentLocationId ?? null)
		: null;

	const currentForecastModel =
		typeof row?.currentForecastModel === 'string' &&
		FORECAST_MODELS.some((model) => model.value === row.currentForecastModel)
			? row.currentForecastModel
			: DEFAULT_FORECAST_MODEL;

	const size = row?.fsrsWordBatchSize;
	const fsrsWordBatchSize =
		typeof size === 'number' && Number.isInteger(size) && size >= 1 && size <= 99 ? size : 9;

	return {
		locations,
		progress: parseProgress(row?.progress),
		forecastModels: FORECAST_MODELS,
		currentLocationId,
		currentForecastModel,
		fsrsWordBatchSize
	};
};

export const actions = {
	addProgress: async ({ request }) => {
		const form = await request.formData();
		const date = form.get('date');
		const rawCount = form.get('count');
		const count =
			typeof rawCount === 'string' && rawCount.trim() !== '' ? Number(rawCount) : NaN;

		if (!isValidDate(date) || !Number.isInteger(count) || count < 0 || count > 10_000_000) {
			return fail(400, {
				action: 'addProgress',
				error: 'Enter a valid date and a whole count from 0 to 10,000,000.'
			});
		}

		const row = await readState();
		const progress = [
			...parseProgress(row?.progress),
			{ id: uuidv7(), date, count: String(count) }
		].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

		await saveDashboard({ progress });
		return { action: 'addProgress', ok: true };
	},

	deleteProgress: async ({ request }) => {
		const form = await request.formData();
		const rawId = form.get('id');
		if (typeof rawId !== 'string' || rawId.trim() === '') {
			return fail(400, { action: 'deleteProgress', error: 'Missing progress id.' });
		}
		const id = rawId.trim();

		const row = await readState();
		const entries = parseProgress(row?.progress);
		const progress = entries.filter((entry) => entry.id !== id);
		if (progress.length === entries.length) {
			return fail(400, { action: 'deleteProgress', error: 'Progress entry not found.' });
		}

		await saveDashboard({ progress });
		return { action: 'deleteProgress', ok: true };
	},

	addLocation: async ({ request }) => {
		const form = await request.formData();
		const rawName = form.get('name');
		const rawLatitude = form.get('latitude');
		const rawLongitude = form.get('longitude');
		const name = typeof rawName === 'string' ? rawName.trim() : '';
		const latitudeText = typeof rawLatitude === 'string' ? rawLatitude.trim() : '';
		const longitudeText = typeof rawLongitude === 'string' ? rawLongitude.trim() : '';
		const latitude = Number(latitudeText);
		const longitude = Number(longitudeText);

		if (
			name.length < 1 ||
			name.length > 80 ||
			latitudeText === '' ||
			!Number.isFinite(latitude) ||
			latitude < -90 ||
			latitude > 90 ||
			longitudeText === '' ||
			!Number.isFinite(longitude) ||
			longitude < -180 ||
			longitude > 180
		) {
			return fail(400, {
				action: 'addLocation',
				error: 'Enter a name up to 80 characters and valid coordinates.'
			});
		}

		const row = await readState();
		const id = uuidv7();
		const locations = [
			...parseLocations(row?.locations),
			{ id, name, latitude: latitudeText, longitude: longitudeText }
		];

		await saveDashboard({
			locations,
			...(row?.currentLocationId ? {} : { currentLocationId: id })
		});
		return { action: 'addLocation', ok: true };
	},

	deleteLocation: async ({ request }) => {
		const form = await request.formData();
		const rawId = form.get('id');
		if (typeof rawId !== 'string' || rawId.trim() === '') {
			return fail(400, { action: 'deleteLocation', error: 'Missing location id.' });
		}
		const id = rawId.trim();

		const row = await readState();
		const entries = parseLocations(row?.locations);
		const locations = entries.filter((entry) => entry.id !== id);
		if (locations.length === entries.length) {
			return fail(400, { action: 'deleteLocation', error: 'Location not found.' });
		}

		await saveDashboard({
			locations,
			...(row?.currentLocationId === id ? { currentLocationId: null } : {})
		});
		return { action: 'deleteLocation', ok: true };
	},

	setCurrentLocation: async ({ request }) => {
		const form = await request.formData();
		const rawId = form.get('id');
		if (typeof rawId !== 'string' || rawId.trim() === '') {
			return fail(400, { action: 'setCurrentLocation', error: 'Missing location id.' });
		}
		const id = rawId.trim();

		const row = await readState();
		if (!parseLocations(row?.locations).some((entry) => entry.id === id)) {
			return fail(400, { action: 'setCurrentLocation', error: 'Location not found.' });
		}

		await saveDashboard({ currentLocationId: id });
		return { action: 'setCurrentLocation', ok: true };
	},

	setForecastModel: async ({ request }) => {
		const form = await request.formData();
		const model = form.get('model');
		if (typeof model !== 'string' || !FORECAST_MODELS.some((entry) => entry.value === model)) {
			return fail(400, { action: 'setForecastModel', error: 'Unknown forecast model.' });
		}

		await saveDashboard({ currentForecastModel: model });
		return { action: 'setForecastModel', ok: true };
	},

	setFsrsWordBatchSize: async ({ request }) => {
		const form = await request.formData();
		const rawSize = form.get('size');
		const size = typeof rawSize === 'string' && rawSize.trim() !== '' ? Number(rawSize) : NaN;

		if (!Number.isInteger(size) || size < 1 || size > 99) {
			return fail(400, {
				action: 'setFsrsWordBatchSize',
				error: 'Enter a whole number from 1 to 99.'
			});
		}

		await saveDashboard({ fsrsWordBatchSize: size });
		return { action: 'setFsrsWordBatchSize', ok: true };
	}
} satisfies Actions;
