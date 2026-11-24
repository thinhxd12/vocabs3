import type { LayoutLoad } from './$types';

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function localDate(now: Date): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export const load: LayoutLoad = async ({ fetch, url, depends }) => {
	depends('app:fsrs-completions');

	const now = new Date();
	const weekday = WEEKDAYS[now.getDay()] ?? '??';
	const today = localDate(now);
	if (url.pathname === '/login') return { completedBatches: 0, totalWords: 0, weekday, today };

	const endpoint = new URL('/api/fsrs-completions', url);
	endpoint.searchParams.set('date', today);
	const response = await fetch(endpoint);
	const body = response.ok
		? ((await response.json()) as { completedBatches?: unknown; totalWords?: unknown })
		: null;
	const completedBatches = typeof body?.completedBatches === 'number' ? body.completedBatches : 0;
	const totalWords = typeof body?.totalWords === 'number' ? body.totalWords : 0;

	return { completedBatches, totalWords, weekday, today };
};
