import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { dashboard } from '#lib/server/db/schema.ts';
import {
	DASHBOARD_USER,
	DEFAULT_FORECAST_MODEL,
	FORECAST_MODELS,
	parseLocations
} from '#lib/server/dashboard.ts';
import type { OpenMeteoResponse, WeatherPayload } from '#lib/weather.ts';

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { value: WeatherPayload; expires: number }>();

const CURRENT_FIELDS = [
	'temperature_2m',
	'relative_humidity_2m',
	'apparent_temperature',
	'precipitation',
	'weather_code',
	'wind_speed_10m',
	'wind_direction_10m',
	'wind_gusts_10m',
	'visibility',
	'pressure_msl',
	'dew_point_2m',
	'cloud_cover',
	'rain',
	'showers',
	'snowfall',
	'snow_depth',
	'is_day'
];

const HOURLY_FIELDS = [
	'temperature_2m',
	'apparent_temperature',
	'precipitation_probability',
	'weather_code',
	'wind_speed_10m',
	'is_day'
];

const DAILY_FIELDS = [
	'weather_code',
	'temperature_2m_max',
	'temperature_2m_min',
	'apparent_temperature_max',
	'apparent_temperature_min',
	'precipitation_probability_max',
	'sunrise',
	'sunset',
	'uv_index_max'
];

async function fetchJson(url: string): Promise<any> {
	const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
	if (!response.ok) throw new Error(`Open-Meteo responded with ${response.status}`);
	return response.json();
}

function normalize(forecast: any, air: any): OpenMeteoResponse {
	const current = forecast.current ?? {};
	const hourly = forecast.hourly ?? {};
	const daily = forecast.daily ?? {};
	const airCurrent = air.current ?? {};

	return {
		latitude: forecast.latitude ?? 0,
		longitude: forecast.longitude ?? 0,
		timezone: forecast.timezone ?? 'UTC',
		timezone_abbreviation: forecast.timezone_abbreviation ?? 'UTC',
		utc_offset_seconds: forecast.utc_offset_seconds ?? 0,
		current: {
			time: current.time ?? '',
			is_day: current.is_day ?? 0,
			temperature_2m: current.temperature_2m ?? 0,
			relative_humidity_2m: current.relative_humidity_2m ?? 0,
			apparent_temperature: current.apparent_temperature ?? 0,
			precipitation: current.precipitation ?? 0,
			weather_code: current.weather_code ?? 0,
			wind_speed_10m: current.wind_speed_10m ?? 0,
			wind_direction_10m: current.wind_direction_10m ?? 0,
			wind_gusts_10m: current.wind_gusts_10m ?? 0,
			visibility: current.visibility ?? 0,
			pressure_msl: current.pressure_msl ?? 0,
			dew_point_2m: current.dew_point_2m ?? 0,
			cloud_cover: current.cloud_cover ?? 0,
			rain: current.rain ?? 0,
			showers: current.showers ?? 0,
			snowfall: current.snowfall ?? 0,
			snow_depth: current.snow_depth ?? 0,
			us_aqi: airCurrent.us_aqi ?? 0,
			uv_index: airCurrent.uv_index ?? 0
		},
		hourly: {
			time: Array.from(hourly.time ?? []),
			temperature_2m: Array.from(hourly.temperature_2m ?? []),
			apparent_temperature: Array.from(hourly.apparent_temperature ?? []),
			precipitation_probability: Array.from(hourly.precipitation_probability ?? []),
			weather_code: Array.from(hourly.weather_code ?? []),
			wind_speed_10m: Array.from(hourly.wind_speed_10m ?? []),
			is_day: Array.from(hourly.is_day ?? [])
		},
		daily: {
			time: Array.from(daily.time ?? []),
			weather_code: Array.from(daily.weather_code ?? []),
			temperature_2m_max: Array.from(daily.temperature_2m_max ?? []),
			temperature_2m_min: Array.from(daily.temperature_2m_min ?? []),
			apparent_temperature_max: Array.from(daily.apparent_temperature_max ?? []),
			apparent_temperature_min: Array.from(daily.apparent_temperature_min ?? []),
			precipitation_probability_max: Array.from(daily.precipitation_probability_max ?? []),
			sunrise: Array.from(daily.sunrise ?? []),
			sunset: Array.from(daily.sunset ?? []),
			uv_index_max: Array.from(daily.uv_index_max ?? [])
		}
	};
}

/** Reads the dashboard location and model, then fetches Open-Meteo for them. */
export async function getWeather(): Promise<WeatherPayload | null> {
	const [row] = await db
		.select({
			locations: dashboard.locations,
			currentLocationId: dashboard.currentLocationId,
			currentForecastModel: dashboard.currentForecastModel
		})
		.from(dashboard)
		.where(eq(dashboard.user, DASHBOARD_USER))
		.limit(1);

	const locations = parseLocations(row?.locations);
	const location =
		locations.find((entry) => entry.id === row?.currentLocationId) ?? locations[0];
	if (!location) return null;

	const model =
		typeof row?.currentForecastModel === 'string' &&
		FORECAST_MODELS.some((entry) => entry.value === row.currentForecastModel)
			? row.currentForecastModel
			: DEFAULT_FORECAST_MODEL;

	const key = `${location.latitude},${location.longitude},${model}`;
	const cached = cache.get(key);
	if (cached && cached.expires > Date.now()) return cached.value;
	cache.delete(key);

	const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
	forecastUrl.search = new URLSearchParams({
		latitude: location.latitude,
		longitude: location.longitude,
		current: CURRENT_FIELDS.join(','),
		hourly: HOURLY_FIELDS.join(','),
		daily: DAILY_FIELDS.join(','),
		models: model,
		temperature_unit: 'celsius',
		timezone: 'auto',
		forecast_hours: '12',
		forecast_days: '7'
	}).toString();

	const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
	airUrl.search = new URLSearchParams({
		latitude: location.latitude,
		longitude: location.longitude,
		current: 'us_aqi,uv_index'
	}).toString();

	const [forecast, air] = await Promise.all([
		fetchJson(forecastUrl.toString()),
		fetchJson(airUrl.toString())
	]);

	const value: WeatherPayload = {
		...normalize(forecast, air),
		location,
		model,
		modelLabel: FORECAST_MODELS.find((entry) => entry.value === model)?.label ?? model
	};
	cache.set(key, { value, expires: Date.now() + CACHE_MS });
	return value;
}
