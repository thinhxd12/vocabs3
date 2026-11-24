import { getWeather } from '#lib/server/weather.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		return { weather: await getWeather() };
	} catch {
		return { weather: null };
	}
};
