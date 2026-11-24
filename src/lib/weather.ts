/**
 * Weather types and pure helpers shared by the server fetcher, the navbar
 * tile, and the /weather page. No imports: this module must stay client-safe.
 */

export type WeatherLocation = {
	id: string;
	name: string;
	latitude: string;
	longitude: string;
};

export type OpenMeteoResponse = {
	latitude: number;
	longitude: number;
	timezone: string;
	timezone_abbreviation: string;
	utc_offset_seconds: number;
	current: {
		time: string;
		is_day: number;
		temperature_2m: number;
		relative_humidity_2m: number;
		apparent_temperature: number;
		precipitation: number;
		weather_code: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
		wind_gusts_10m: number;
		visibility: number;
		pressure_msl: number;
		dew_point_2m: number;
		cloud_cover: number;
		rain: number;
		showers: number;
		snowfall: number;
		snow_depth: number;
		us_aqi: number;
		uv_index: number;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		apparent_temperature: number[];
		precipitation_probability: number[];
		weather_code: number[];
		wind_speed_10m: number[];
		is_day: number[];
	};
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		apparent_temperature_max: number[];
		apparent_temperature_min: number[];
		precipitation_probability_max: number[];
		sunrise: string[];
		sunset: string[];
		uv_index_max: number[];
	};
};

export type WeatherPayload = OpenMeteoResponse & {
	location: WeatherLocation;
	model: string;
	modelLabel: string;
};

function getRangeBasedValue<T>(value: number, ranges: Array<{ max: number; result: T }>): T {
	for (const range of ranges) {
		if (value <= range.max) return range.result;
	}
	return ranges.at(-1)!.result;
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
	0: 'Clear sky',
	1: 'Mainly clear',
	2: 'Partly cloudy',
	3: 'Overcast',
	45: 'Foggy',
	48: 'Depositing rime fog',
	51: 'Light drizzle',
	53: 'Moderate drizzle',
	55: 'Dense drizzle',
	56: 'Light freezing drizzle',
	57: 'Dense freezing drizzle',
	61: 'Slight rain',
	63: 'Moderate rain',
	65: 'Heavy rain',
	66: 'Light freezing rain',
	67: 'Heavy freezing rain',
	71: 'Slight snow fall',
	73: 'Moderate snow fall',
	75: 'Heavy snow fall',
	77: 'Snow grains',
	80: 'Slight rain showers',
	81: 'Moderate rain showers',
	82: 'Violent rain showers',
	85: 'Slight snow showers',
	86: 'Heavy snow showers',
	95: 'Thunderstorm',
	96: 'Thunderstorm with slight hail',
	99: 'Thunderstorm with heavy hail'
};

// Files in static/metoffice; some have no day/night variant.
const WEATHER_CODE_TO_MET_ICON: Record<number, string> = {
	0: 'clear',
	1: 'clear',
	2: 'partlycloud',
	3: 'overcast',
	45: 'fog',
	48: 'fog',
	51: 'drizzle',
	53: 'drizzle',
	55: 'drizzle',
	56: 'drizzle',
	57: 'drizzle',
	61: 'lightrain',
	63: 'rain',
	65: 'rain',
	66: 'sleetshower',
	67: 'sleet',
	71: 'lightsnow',
	73: 'snow',
	75: 'snow',
	77: 'snow',
	80: 'lightrainshower',
	81: 'rainshower',
	82: 'rainshower',
	85: 'lightsnowshower',
	86: 'snowshower',
	95: 'thunder',
	96: 'thunder',
	99: 'thunder'
};

const WEATHER_CODE_TO_BACKGROUND: Record<number, string> = {
	0: 'clear',
	1: 'clear',
	2: 'partly-cloudy',
	3: 'cloudy',
	45: 'foggy',
	48: 'foggy',
	51: 'rain',
	53: 'rain',
	55: 'rain',
	56: 'rain',
	57: 'rain',
	61: 'rain',
	63: 'rain',
	65: 'rain',
	66: 'rain',
	67: 'rain',
	71: 'snow',
	73: 'snow',
	75: 'snow',
	77: 'snow',
	80: 'rain',
	81: 'rain',
	82: 'rain',
	85: 'snow',
	86: 'snow',
	95: 'thunderstorm',
	96: 'thunderstorm-hail',
	99: 'thunderstorm-hail'
};

const ICONS_WITHOUT_NIGHT = new Set([
	'cloud',
	'drizzle',
	'fog',
	'overcast',
	'lightrain',
	'rain',
	'sleet',
	'lightsnow',
	'snow',
	'rainshower',
	'thunder',
	'nodata'
]);

export function getWeatherInfo(
	code: number,
	isDay: number
): { description: string; icon: string; background: string } {
	const dayNight = isDay ? '' : '-night';
	const iconName = WEATHER_CODE_TO_MET_ICON[code] ?? 'nodata';
	return {
		description: WEATHER_CODE_DESCRIPTIONS[code] ?? 'Unknown',
		icon: ICONS_WITHOUT_NIGHT.has(iconName) ? iconName : `${iconName}${dayNight}`,
		background: WEATHER_CODE_TO_BACKGROUND[code] ?? 'cloudy'
	};
}

export function getWindDirection(degrees: number): string {
	const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	return directions[Math.round(degrees / 45) % 8];
}

export function getUVInfo(uv: number): { level: string; description: string } {
	return getRangeBasedValue(uv, [
		{ max: 2, result: { level: 'Low', description: 'Little to no sun protection required' } },
		{ max: 5, result: { level: 'Moderate', description: 'Some protection required' } },
		{ max: 7, result: { level: 'High', description: 'Protection essential' } },
		{ max: 10, result: { level: 'Very High', description: 'Extra protection needed' } },
		{ max: Infinity, result: { level: 'Extreme', description: 'Stay inside if possible' } }
	]);
}

export function getAQILevel(aqi: number): { level: string; color: string } {
	return getRangeBasedValue(aqi, [
		{ max: 50, result: { level: 'Good', color: '#50ccaa' } },
		{ max: 100, result: { level: 'Moderate', color: '#f0e641' } },
		{ max: 150, result: { level: 'Unhealthy for Sensitive', color: '#f0a741' } },
		{ max: 200, result: { level: 'Unhealthy', color: '#ff5050' } },
		{ max: 300, result: { level: 'Very Unhealthy', color: '#960032' } },
		{ max: Infinity, result: { level: 'Hazardous', color: '#7d2181' } }
	]);
}

export function getAQIDescription(aqi: number): string {
	return getRangeBasedValue(aqi, [
		{ max: 50, result: 'Air quality is satisfactory' },
		{ max: 100, result: 'Acceptable for most people' },
		{ max: 150, result: 'Unhealthy for sensitive groups' },
		{ max: 200, result: 'Everyone may experience effects' },
		{ max: 300, result: 'Health alert: everyone affected' },
		{ max: Infinity, result: 'Health warning of emergency conditions' }
	]);
}

export function getHumidityDescription(humidity: number): string {
	return getRangeBasedValue(humidity, [
		{ max: 29, result: 'Dry conditions' },
		{ max: 59, result: 'Comfortable' },
		{ max: 79, result: 'Slightly humid' },
		{ max: Infinity, result: 'Very humid' }
	]);
}

export function getPressureDescription(pressureHpa: number): string {
	if (pressureHpa >= 1020) return 'High pressure';
	if (pressureHpa >= 1010) return 'Normal pressure';
	if (pressureHpa >= 1000) return 'Low pressure';
	return 'Very low pressure';
}

export function getVisibilityDescription(distance: number): string {
	if (distance >= 16) return 'Excellent visibility';
	if (distance >= 10) return 'Very good visibility';
	if (distance >= 5) return 'Good visibility';
	if (distance >= 2) return 'Moderate visibility';
	return 'Poor visibility';
}

export function getFeelsLikeDescription(feels: number, actual: number, wind: number, humidity: number): string {
	const diff = feels - actual;
	const absDiff = Math.abs(diff);
	if (diff <= -3) {
		return `${wind > 15 ? 'Wind' : 'The breeze'} is making it feel colder ${absDiff}°`;
	}
	if (diff >= 3) {
		return `${humidity > 60 ? 'Humidity' : 'The air'} is making it feel hotter ${absDiff}°`;
	}
	return 'It feels similar to the actual temperature';
}

/**
 * Open-Meteo returns times in the location's timezone. All parsers read the
 * ISO string directly so the browser timezone never shifts them.
 */
export function getHourFromISO(isoString: string): number {
	const timePart = isoString.split('T')[1] ?? '00:00';
	return Number.parseInt(timePart.split(':')[0], 10);
}

function getDatePart(isoString: string): string {
	return isoString.split('T')[0];
}

export function calculateSunPosition(
	currentTimeISO?: string,
	sunriseISO?: string,
	sunsetISO?: string
): number {
	if (!currentTimeISO || !sunriseISO || !sunsetISO) return 50;
	const now = new Date(currentTimeISO);
	const sunrise = new Date(sunriseISO);
	const sunset = new Date(sunsetISO);
	if (now < sunrise) return 0;
	if (now > sunset) return 100;
	return ((now.getTime() - sunrise.getTime()) / (sunset.getTime() - sunrise.getTime())) * 100;
}

function getSimpleWeather(code: number): string {
	if (code >= 51 && code <= 67) return 'rain';
	if (code >= 71 && code <= 77) return 'snow';
	if (code <= 1) return 'clear';
	if (code === 2) return 'partly cloudy';
	if (code === 3) return 'overcast';
	if (code >= 45 && code <= 48) return 'foggy';
	if (code >= 80 && code <= 99) return 'storms';
	return 'cloudy';
}

function getTonightCondition(code: number): string {
	if (code <= 1) return 'Clear tonight';
	if (code === 2) return 'Partly cloudy tonight';
	if (code === 3) return 'Cloudy tonight';
	if (code >= 51 && code <= 67) return 'Rain tonight';
	if (code >= 71 && code <= 77) return 'Snow tonight';
	return `${getSimpleWeather(code)} tonight`;
}

function analyzeDayWeather(
	currentHour: number,
	hourly: Array<{ hour: number; code: number }>
): { morning: string | null; afternoon: string | null; evening: string | null } {
	const mostCommon = (hours: Array<{ code: number }>) => {
		if (hours.length === 0) return null;
		const counts = new Map<number, number>();
		for (const entry of hours) counts.set(entry.code, (counts.get(entry.code) ?? 0) + 1);
		let bestCode = hours[0].code;
		let bestCount = 0;
		for (const [code, count] of counts) {
			if (count > bestCount) {
				bestCount = count;
				bestCode = code;
			}
		}
		return getSimpleWeather(bestCode);
	};

	const period = (from: number, to: number) =>
		mostCommon(hourly.filter((entry) => entry.hour >= from && entry.hour < to));

	return {
		morning: currentHour < 12 ? period(6, 12) : null,
		afternoon: currentHour < 17 ? period(12, 17) : null,
		evening: currentHour < 22 ? period(17, 22) : null
	};
}

export function generateForecastStatement(weather: OpenMeteoResponse): string {
	const currentHour = getHourFromISO(weather.current.time);
	const currentDate = getDatePart(weather.current.time);
	const todayMax = weather.daily.temperature_2m_max[0] ?? 0;
	const tomorrowMax = weather.daily.temperature_2m_max[1] ?? todayMax;
	const tomorrowCode = weather.daily.weather_code[1] ?? 0;

	const upcoming = weather.hourly.time
		.map((time, index) => ({
			time,
			hour: getHourFromISO(time),
			code: weather.hourly.weather_code[index] ?? 0
		}))
		.filter((entry) => getDatePart(entry.time) === currentDate && entry.time > weather.current.time)
		.slice(0, 18);

	const periods = analyzeDayWeather(currentHour, upcoming);
	const currentCondition = getSimpleWeather(weather.current.weather_code);
	const parts: string[] = [];

	if (currentHour >= 17) {
		parts.push(getTonightCondition(weather.current.weather_code));
		parts.push(`${getSimpleWeather(tomorrowCode)} tomorrow`);
		const diff = tomorrowMax - todayMax;
		parts.push(Math.abs(diff) >= 3 ? (diff > 0 ? 'warming up' : 'cooling down') : 'similar temperatures');
	} else if (currentHour < 12) {
		parts.push(`${currentCondition} this morning`);
		if (periods.afternoon) parts.push(`${periods.afternoon} this afternoon`);
		if (periods.evening) parts.push(`${periods.evening} this evening`);
	} else {
		parts.push(`${currentCondition} this afternoon`);
		if (periods.evening) parts.push(`${periods.evening} this evening`);
		if (parts.length < 2) parts.push(`${getSimpleWeather(tomorrowCode)} tomorrow`);
	}

	if (parts.length < 3 && currentHour < 17) {
		const diff = tomorrowMax - todayMax;
		if (Math.abs(diff) >= 5) parts.push(diff > 0 ? 'warmer tomorrow' : 'cooler tomorrow');
		else if (tomorrowCode >= 51 && tomorrowCode <= 67) parts.push('rain tomorrow');
		else if (tomorrowCode >= 71 && tomorrowCode <= 77) parts.push('snow tomorrow');
	}

	if (parts.length === 0) return 'Conditions expected to remain steady';
	const statement = parts.join(', ');
	return statement.charAt(0).toUpperCase() + statement.slice(1);
}

export function formatTemperature(temp: number): string {
	return `${Math.round(temp)}°`;
}

export function formatTime(isoTime: string): string {
	const hour = getHourFromISO(isoTime);
	if (hour === 0) return '12 AM';
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return '12 PM';
	return `${hour - 12} PM`;
}

export function formatTimeWithMinutes(isoTime: string): string {
	const [hourText, minuteText] = (isoTime.split('T')[1] ?? '00:00').split(':');
	const hour = Number.parseInt(hourText, 10);
	const minute = minuteText.padStart(2, '0');
	if (hour === 0) return `12:${minute} AM`;
	if (hour < 12) return `${hour}:${minute} AM`;
	if (hour === 12) return `12:${minute} PM`;
	return `${hour - 12}:${minute} PM`;
}

export function formatDay(isoDate: string, currentDate: string): string {
	const datePart = getDatePart(isoDate);
	if (datePart === getDatePart(currentDate)) return 'Today';
	const [year, month, day] = datePart.split('-').map(Number);
	return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(year, month - 1, day));
}

// Names of the images in static/images/weather used by the hourly strip.
const WEATHER_CODE_TO_NAV_BACKGROUND: Record<number, string> = {
	0: 'clear',
	1: 'clear',
	2: 'partlycloudy',
	3: 'cloudy',
	45: 'foggy',
	48: 'foggy',
	51: 'drizzle',
	53: 'drizzle',
	55: 'drizzle',
	56: 'drizzle',
	57: 'drizzle',
	61: 'rain',
	63: 'rain',
	65: 'rain',
	66: 'rain',
	67: 'rain',
	71: 'snow',
	73: 'snow',
	75: 'snow',
	77: 'snow',
	80: 'light-showers',
	81: 'showers',
	82: 'showers',
	85: 'snow',
	86: 'snow',
	95: 'thunderstorm',
	96: 'thunderstorm',
	99: 'thunderstorm'
};

const NAV_BACKGROUNDS_WITH_NIGHT = new Set(['clear', 'partlycloudy', 'cloudy']);

export function getNavWeatherBackground(code: number, isDay: number): string {
	const background = WEATHER_CODE_TO_NAV_BACKGROUND[code] ?? 'cloudy';
	return NAV_BACKGROUNDS_WITH_NIGHT.has(background) && !isDay
		? `${background}-night`
		: background;
}

export function getCloudCoverDescription(percentage: number): string {
	return getRangeBasedValue(percentage, [
		{ max: 10, result: 'Clear sky' },
		{ max: 25, result: 'Mostly clear' },
		{ max: 50, result: 'Partly cloudy' },
		{ max: 75, result: 'Mostly cloudy' },
		{ max: Infinity, result: 'Overcast' }
	]);
}

export function getBeaufortInfo(wind: number): { level: string; description: string } {
	return getRangeBasedValue(wind, [
		{ max: 1.6, result: { level: '0', description: 'Smoke rises vertically' } },
		{ max: 4.8, result: { level: '1', description: 'Smoke drift indicates wind direction' } },
		{ max: 11.3, result: { level: '2', description: 'Leaves rustle; vanes move' } },
		{ max: 19.3, result: { level: '3', description: 'Leaves in motion; flags extend' } },
		{ max: 29, result: { level: '4', description: 'Dust, leaves raised up; branches move' } },
		{ max: 38.6, result: { level: '5', description: 'Small trees begin to sway' } },
		{ max: 49.9, result: { level: '6', description: 'Large braches in motion, whistling heard in wires' } },
		{ max: 61.2, result: { level: '7', description: 'Resistance felt in walking against wind' } },
		{ max: 74, result: { level: '8', description: 'Twigs and small branches broken off trees' } },
		{ max: 86.9, result: { level: '9', description: 'Shingles blown off roofs' } },
		{ max: 101.4, result: { level: '10', description: 'Trees broken, structural damage occurs' } },
		{ max: 115.9, result: { level: '11', description: 'Widespread damage' } },
		{ max: Infinity, result: { level: '11', description: 'Violence and destruction' } }
	]);
}

export function formatPrecipitation(amount: number): string {
	return `${amount} mm`;
}

export function formatSnowDepth(meters: number): string {
	return `${Math.round(meters * 100)} cm`;
}

export function formatRelativeFromMs(diffMs: number): string {
	const safe = Math.max(0, diffMs);
	const minute = 60_000;
	const hour = 60 * minute;
	const day = 24 * hour;
	if (safe < 45_000) return 'a few seconds ago';
	if (safe < hour) {
		const mins = Math.round(safe / minute);
		return `${mins} min${mins === 1 ? '' : 's'} ago`;
	}
	if (safe < day) {
		const hrs = Math.round(safe / hour);
		return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
	}
	const days = Math.round(safe / day);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}
