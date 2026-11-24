import { json } from '@sveltejs/kit';
import { getWeather } from '#lib/server/weather.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const weather = await getWeather();
		return weather ? json(weather) : json({ error: 'No location set' }, { status: 404 });
	} catch {
		return json({ error: 'Weather lookup failed' }, { status: 502 });
	}
};
