import type { WeatherPayload } from '#lib/weather.ts';

export const weather = $state<{ data: WeatherPayload | null; error: boolean }>({
	data: null,
	error: false
});

let started = false;
let nextTimer: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;

export async function refreshWeather() {
	try {
		const response = await fetch('/api/weather');
		weather.data = response.ok ? ((await response.json()) as WeatherPayload) : null;
		weather.error = !response.ok;
	} catch {
		weather.error = true;
	}
}

/** Mirrors vocabs1: first refresh at the next quarter-hour + 30s, then every 15 min. */
function nextQuarterHourDelay() {
	const now = new Date();
	let next = Math.ceil(now.getMinutes() / 15) * 15;
	if (next === 60) {
		next = 0;
		now.setHours(now.getHours() + 1);
	}
	now.setMinutes(next, 0, 0);
	return now.getTime() - Date.now() + 30_000;
}

export function startWeatherPolling() {
	if (started) return;
	started = true;
	void refreshWeather();
	nextTimer = setTimeout(() => {
		void refreshWeather();
		interval = setInterval(() => void refreshWeather(), 15 * 60 * 1000);
	}, nextQuarterHourDelay());
}

export function stopWeatherPolling() {
	started = false;
	clearTimeout(nextTimer);
	clearInterval(interval);
}
