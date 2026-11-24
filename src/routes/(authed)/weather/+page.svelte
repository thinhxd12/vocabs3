<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import WeatherRadar from '#lib/components/WeatherRadar.svelte';
	import {
		calculateSunPosition,
		formatDay,
		formatPrecipitation,
		formatRelativeFromMs,
		formatSnowDepth,
		formatTemperature,
		formatTime,
		formatTimeWithMinutes,
		generateForecastStatement,
		getAQIDescription,
		getAQILevel,
		getBeaufortInfo,
		getCloudCoverDescription,
		getFeelsLikeDescription,
		getHourFromISO,
		getHumidityDescription,
		getNavWeatherBackground,
		getPressureDescription,
		getUVInfo,
		getVisibilityDescription,
		getWeatherInfo,
		getWindDirection
	} from '#lib/weather.ts';
	import { weather as weatherState } from '#lib/weather.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type DailyEntry = {
		date: string;
		description: string;
		icon: string;
		background: string;
		temp_max: number;
		temp_min: number;
		temp_current: number | undefined;
		precipitation: number;
	};

	// The dock owns polling; seed the shared state without mutating it during SSR.
	$effect(() => {
		if (!weatherState.data && data.weather) weatherState.data = data.weather;
	});

	const uvCoordinates = [
		{ cx: 36.6, cy: 133.6, color: '#73AA24' },
		{ cx: 18.7, cy: 105, color: '#73AA24' },
		{ cx: 14.5, cy: 80, color: '#FDE300' },
		{ cx: 18.7, cy: 55.2, color: '#FDE300' },
		{ cx: 36.2, cy: 26.8, color: '#FDE300' },
		{ cx: 56.6, cy: 12, color: '#FF8C00' },
		{ cx: 90.5, cy: 4, color: '#FF8C00' },
		{ cx: 124.4, cy: 12, color: '#D13438' },
		{ cx: 144.8, cy: 26.8, color: '#D13438' },
		{ cx: 162.3, cy: 55.2, color: '#D13438' },
		{ cx: 166.3, cy: 85.3, color: '#5C2E91' },
		{ cx: 144.8, cy: 133.6, color: '#5C2E91' }
	];

	const weather = $derived(weatherState.data ?? data.weather);
	const current = $derived(weather?.current);
	const info = $derived(current ? getWeatherInfo(current.weather_code, current.is_day) : null);
	const videoBackground = $derived(
		current ? getNavWeatherBackground(current.weather_code, current.is_day) : 'cloudy'
	);
	const temperature = $derived(current ? Math.round(current.temperature_2m) : 0);
	const lastUpdated = $derived.by(() => {
		if (!current || !weather) return '';
		// Open-Meteo times are local to the location; attach its UTC offset before parsing.
		const iso = /([zZ]|[+-]\d{2}:\d{2})$/.test(current.time)
			? current.time
			: `${current.time}Z`;
		const timestamp = Date.parse(iso) - weather.utc_offset_seconds * 1000;
		return formatRelativeFromMs(Math.max(0, Date.now() - timestamp));
	});
	const statement = $derived(weather ? generateForecastStatement(weather) : '');
	const feels = $derived.by(() => {
		if (!current) return null;
		const value = Math.round(current.apparent_temperature);
		const actual = Math.round(current.temperature_2m);
		return {
			temperature: value,
			description: getFeelsLikeDescription(
				value,
				actual,
				current.wind_speed_10m,
				current.relative_humidity_2m
			)
		};
	});
	const wind = $derived.by(() => {
		if (!current) return null;
		const direction = current.wind_direction_10m || 0;
		const beaufort = getBeaufortInfo(current.wind_speed_10m || 0);
		return {
			direction,
			directionLabel: getWindDirection(direction),
			speed: Math.round(current.wind_speed_10m || 0),
			gusts: Math.round(current.wind_gusts_10m || 0),
			unit: 'km/h',
			image: beaufort.level,
			description: beaufort.description
		};
	});
	const precipitation = $derived.by(() => {
		if (!current) return null;
		const liquid = (current.rain ?? 0) + (current.showers ?? 0);
		const snowfall = current.snowfall ?? 0;
		const hasRain = liquid > 0;
		const hasSnow = snowfall > 0;
		const description =
			!hasRain && !hasSnow
				? 'No precipitation'
				: hasRain && hasSnow
					? 'Mixed precipitation'
					: hasRain
						? liquid < 0.1
							? 'Light rain'
							: 'Rain'
						: snowfall < 0.1
							? 'Light snow'
							: 'Snow';
		return {
			hasPrecipitation: hasRain || hasSnow,
			hasRain,
			hasSnow,
			formattedRain: formatPrecipitation(liquid),
			formattedSnow: formatPrecipitation(snowfall),
			description
		};
	});
	const uv = $derived.by(() => {
		if (!current) return null;
		const value = Math.round(current.uv_index || 0);
		return { value, ...getUVInfo(value) };
	});
	const pressure = $derived.by(() => {
		if (!current) return null;
		const value = current.pressure_msl || 1013;
		return {
			value,
			percent: Math.round(Math.max(0, Math.min(100, ((value - 1000) / 40) * 100))),
			description: getPressureDescription(value)
		};
	});
	const humidity = $derived.by(() => {
		if (!current) return null;
		return {
			value: Math.round(current.relative_humidity_2m),
			dewpoint: Math.round(current.dew_point_2m),
			description: getHumidityDescription(current.relative_humidity_2m)
		};
	});
	const cloud = $derived.by(() => {
		if (!current) return null;
		const value = Math.round(current.cloud_cover);
		return { value, description: getCloudCoverDescription(value) };
	});
	const visibility = $derived.by(() => {
		if (!current) return null;
		const value = Math.round(current.visibility / 1000);
		return { value, unit: 'km', description: getVisibilityDescription(value) };
	});
	const sun = $derived.by(() => {
		if (!weather) return null;
		const sunriseISO = weather.daily.sunrise[0];
		const sunsetISO = weather.daily.sunset[0];
		return {
			sunrise: sunriseISO ? formatTimeWithMinutes(sunriseISO) : '--:--',
			sunset: sunsetISO ? formatTimeWithMinutes(sunsetISO) : '--:--',
			position: Math.round(calculateSunPosition(weather.current.time, sunriseISO, sunsetISO))
		};
	});
	const aqi = $derived.by(() => {
		if (!current) return null;
		const value = current.us_aqi || 0;
		return { value, ...getAQILevel(value), description: getAQIDescription(value) };
	});
	const snow = $derived.by(() => {
		if (!current) return null;
		const meters = current.snow_depth ?? 0;
		const inches = meters * 39.3701;
		return {
			hasSnow: meters > 0,
			snowDepth: meters > 0 ? formatSnowDepth(meters) : '0',
			description:
				meters <= 0
					? 'No snow on ground'
					: inches < 1
						? 'Light snow cover'
						: inches < 6
							? 'Moderate snow depth'
							: 'Significant snow depth'
		};
	});

	const hourly = $derived(
		weather
			? weather.hourly.time.slice(0, 12).map((time, index) => {
					const code = weather.hourly.weather_code[index] ?? 0;
					const isDay = weather.hourly.is_day[index] ?? 0;
					const [hour, suffix] = formatTime(time).split(' ');
					return {
						time,
						hour,
						suffix,
						temp: Math.round(weather.hourly.temperature_2m[index] ?? 0),
						...getWeatherInfo(code, isDay),
						background: getNavWeatherBackground(code, isDay),
						precipitation: weather.hourly.precipitation_probability[index] ?? 0
					};
				})
			: []
	);

	const daily = $derived.by(() => {
		if (!weather) {
			return { data: [] as DailyEntry[], time: '', min: 0, max: 1, range: 1 };
		}
		const hour = getHourFromISO(weather.current.time);
		const skipToday = hour >= 20;
		const entries = weather.daily.time.map((date, index) => ({
			date,
			...getWeatherInfo(weather.daily.weather_code[index] ?? 0, 1),
			temp_max: weather.daily.temperature_2m_max[index] ?? 0,
			temp_min: weather.daily.temperature_2m_min[index] ?? 0,
			temp_current:
				index === 0 && !skipToday ? weather.hourly.temperature_2m[0] : undefined,
			precipitation: weather.daily.precipitation_probability_max[index] ?? 0
		}));
		const shown = skipToday ? entries.slice(1) : entries;
		const temps = shown
			.flatMap((entry) => [entry.temp_min, entry.temp_max, entry.temp_current])
			.filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
		const min = temps.length ? Math.round(Math.min(...temps)) : 0;
		const max = temps.length ? Math.round(Math.max(...temps)) : 1;
		return { data: shown, time: weather.current.time, min, max, range: Math.max(1, max - min) };
	});

	let sunSVGpath = $state<SVGPathElement>();

	function getSunPosition(percent: number) {
		if (!sunSVGpath) return;
		const position = (percent / 100) * (0.78 - 0.22) + 0.22;
		const point = sunSVGpath.getPointAtLength(sunSVGpath.getTotalLength() * position);
		return { x: point.x, y: point.y };
	}
</script>

<svelte:head>
	<title>Weather</title>
	<meta name="Weather" content="Weather" />
</svelte:head>

<div class="flex w-full flex-col gap-[2px] pb-[8px]">
	{#if weather && current && info}
		<section class="current select-none">
			<a
				href="/dashboard"
				title="Weather settings · {weather.modelLabel}"
				class="location-list block text-center text-white"
			>
				{weather.location.name}
			</a>
			{#key `${videoBackground}-${prefersReducedMotion.current}`}
				<video
					autoplay={!prefersReducedMotion.current}
					preload={prefersReducedMotion.current ? 'none' : 'auto'}
					loop
					muted
					playsinline
					poster="/images/weather/{videoBackground}.webp"
					aria-hidden="true"
					class="absolute top-0 left-0 h-full w-full object-cover object-top"
				>
					<source src="/videos/weathervideos/{videoBackground}.mp4" type="video/mp4" />
					Your browser does not support the video tag.
				</video>
			{/key}
			<h1
				class="relative overflow-hidden indent-[30px] text-center text-[135px] leading-[130px] font-light text-white select-none"
			>
				{temperature}°
			</h1>
			<div class="relative mb-[3px] flex items-center justify-center gap-[9px]">
				<img
					src="/metoffice/{info.icon}.svg"
					alt=""
					aria-hidden="true"
					class="size-[90px] object-cover"
					style="filter: drop-shadow(0px 0px 9px rgba(0, 0, 0, 0.3));"
				/>
				<span class="text-[18px] font-normal text-white">{info.description}</span>
			</div>
			<p class="relative mb-[3px] px-[6px] text-center text-[15px] leading-[18px] text-white">
				{statement}
			</p>
			<p class="relative mb-[3px] text-center text-[11px] text-white/60">
				Last updated {lastUpdated}
			</p>
		</section>

		<WeatherRadar latitude={Number(weather.latitude)} longitude={Number(weather.longitude)} />

		<div class="grid w-full grid-cols-2 gap-[2px] select-none">
			{#if feels}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Feels Like</p>
					<p class="text-[36px] leading-[50px] font-normal">{feels.temperature}°</p>
					<p class="text-[12px]">{feels.description}</p>
				</div>
			{/if}

			{#if wind}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Wind</p>
					<div class="flex items-center">
						<div class="relative -ml-[15px] size-[120px]" aria-hidden="true">
							<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
								{#each [-80, 10, 100, 190] as rotation (rotation)}
									<g transform="translate(60, 60) rotate({rotation})">
										<circle r="40" stroke="#ffffff1a" stroke-width="4" pathLength="360" stroke-dasharray="70 290" stroke-linecap="round" fill="none" />
									</g>
								{/each}
								<path
									fill="#228be6"
									d="M 61.0453 41.1725 A 1.125 1.125 90 0 0 58.9547 41.1725 l -12.728 31.8197 a 1.125 1.125 90 0 0 1.548 1.424 l 12.2251 -6.1126 l 12.2236 6.1142 a 1.125 1.125 90 0 0 1.5496 -1.4256 z"
									transform="rotate({wind.direction - 180} 60 60)"
								/>
								<div class="absolute top-[13px] left-1/2 -translate-x-1/2 text-[11px]">N</div>
								<div class="absolute bottom-[14px] left-1/2 -translate-x-1/2 text-[11px]">S</div>
								<div class="absolute top-1/2 left-[22px] -translate-x-1/2 -translate-y-1/2 text-[11px]">W</div>
								<div class="absolute top-1/2 right-[23px] translate-x-[5px] -translate-y-1/2 text-[11px]">E</div>
							</svg>
						</div>
						<div class="flex flex-col">
							<p class="mb-[6px] text-[12px] leading-[15px] text-white/60">
								From {wind.directionLabel} ({wind.direction}°)
							</p>
							<p class="text-[12px] leading-[15px] text-white/60">Wind Speed</p>
							<p class="mb-[6px] text-[14px] leading-[15px]">
								{wind.speed} <small>{wind.unit}</small>
							</p>
							<p class="text-[12px] leading-[15px] text-white/60">Wind Gust</p>
							<p class="text-[14px] leading-[15px]">
								{wind.gusts} <small>{wind.unit}</small>
							</p>
						</div>
					</div>
					<div class="mt-[8px] flex gap-[9px] overflow-hidden rounded-[2px] bg-white pl-[6px]">
						<img src="/images/beaufort-scale/{wind.image}.png" alt="" aria-hidden="true" class="w-1/3 object-cover" />
						<p class="pb-[3px] text-[12px] leading-[16px] text-black">{wind.description}</p>
					</div>
				</div>
			{/if}

			{#if precipitation}
				<div class="dark p-[6px]">
					<p class="mb-[3px] text-[12px] uppercase">Precipitation</p>
					<div class="flex flex-col items-center">
						{#if precipitation.hasRain}
							<img src="/images/weather/drizzle.webp" alt="" aria-hidden="true" class="mx-auto my-[12px] size-[90px] rounded-full object-cover object-bottom" />
							<p class="mt-[3px] text-[14px] font-semibold">{precipitation.formattedRain}</p>
							<p class="text-[12px]">in 15 minutes</p>
						{:else if precipitation.hasSnow}
							<img src="/images/weather/snow.webp" alt="" aria-hidden="true" class="mx-auto my-[12px] size-[90px] rounded-full object-cover object-bottom" />
							<p class="mt-[3px] text-[14px] font-semibold">{precipitation.formattedSnow}</p>
							<p class="text-[12px]">in 15 minutes</p>
						{:else}
							<p class="mt-[45px] text-[14px] font-semibold">None</p>
							<p class="text-[12px]">{precipitation.description}</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if uv}
				<div class="dark p-[6px]">
					<p class="mb-[12px] text-[12px] uppercase">UV Index</p>
					<div class="flex flex-col items-center justify-center">
						<div class="relative flex justify-center" aria-hidden="true">
							<svg width="100" height="100" viewBox="5 -12 171 178" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M 90.5 80 m 76 0 a 76 76 0 0 1 -32 62.3" transform="rotate(13 90.5 80)" stroke="#5C2E91" stroke-width="10" stroke-linecap="round" />
								<path d="M 90.5 80 m 76 0 a 76 76 0 0 1 -32 62.3" transform="rotate(-52 90.5 80)" stroke="#D13438" stroke-width="10" stroke-linecap="round" />
								<path d="M 90.5 80 m 76 0 a 76 76 0 0 1 -32 62.3" transform="rotate(-115 90.5 80)" stroke="#FF8C00" stroke-width="10" stroke-linecap="round" />
								<path d="M 90.5 80 m 76 0 a 76 76 0 0 1 -32 62.3" transform="rotate(-178 90.5 80)" stroke="#FDE300" stroke-width="10" stroke-linecap="round" />
								<path d="M 90.5 80 m 76 0 a 76 76 0 0 1 -32 62.3" transform="rotate(-243 90.5 80)" stroke="#73AA24" stroke-width="10" stroke-linecap="round" />
								{#if uv.value > 0}
									{@const dot = uvCoordinates[Math.min(12, uv.value) - 1]}
									<g>
										<circle cx={dot?.cx} cy={dot?.cy} r="10" fill={dot?.color} />
										<circle cx={dot?.cx} cy={dot?.cy} r="11.5" stroke="white" stroke-width="3" />
									</g>
								{/if}
							</svg>
							<div class="absolute flex h-full w-full items-center justify-center">
								<div class="text-[36px] leading-[36px]">{uv.value}</div>
							</div>
						</div>
						<p class="text-[14px] font-semibold">{uv.level}</p>
						<p class="text-[12px] leading-[16px]">{uv.description}</p>
					</div>
				</div>
			{/if}

			{#if pressure}
				<div class="dark p-[6px]">
					<p class="mb-[30px] text-[12px] uppercase">Pressure</p>
					<div class="flex w-full items-center justify-center gap-[25px]">
						<div class="relative h-[100px] w-[9px] rounded-full bg-gradient-to-b from-white via-white to-white/10 shadow shadow-black/30">
							<span class="absolute -left-[4px] h-[5px] w-[17px] -translate-y-1/2 rounded-[3px] bg-white shadow shadow-black/30" style="bottom: {pressure.percent}%"></span>
						</div>
						<div class="flex flex-col">
							<p class="text-[20px] font-medium">{pressure.value} <small>hPa</small></p>
							<p class="text-center text-[12px]">{pressure.description}</p>
						</div>
					</div>
				</div>
			{/if}

			{#if humidity}
				<div class="dark p-[6px]">
					<p class="mb-[30px] text-[12px] uppercase">Humidity</p>
					<div class="flex items-center justify-center gap-[25px]">
						<div class="relative h-[100px] w-[9px] rounded-full bg-white/10">
							<div class="absolute bottom-0 float-left w-full rounded-full bg-white/90" style="height: {humidity.value}%"></div>
						</div>
						<div class="flex flex-col gap-[6px]">
							<div class="flex flex-col">
								<p class="text-[12px] leading-[15px] text-white/60">Relative Humidity</p>
								<p class="text-[14px] leading-[18px] font-medium">{humidity.value}%</p>
							</div>
							<div class="flex flex-col">
								<p class="text-[12px] leading-[15px] text-white/60">Dew point</p>
								<p class="text-[14px] leading-[18px] font-medium">{humidity.dewpoint}°</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			{#if cloud}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Cloud Cover</p>
					<div class="flex flex-col items-center">
						<img src="/images/cloud/{encodeURIComponent(cloud.description)}.webp" alt="" aria-hidden="true" class="mx-auto my-[12px] size-[90px] rounded-full object-cover object-bottom" />
						<p class="mt-[3px] text-center text-[14px] font-semibold">{cloud.value}%</p>
						<p class="text-center text-[12px] leading-[16px] text-white/60">{cloud.description}</p>
					</div>
				</div>
			{/if}

			{#if visibility}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Visibility</p>
					<p class="text-[36px] leading-[50px] font-normal">{visibility.value} <small>{visibility.unit}</small></p>
					<p class="text-[12px]">{visibility.description}</p>
				</div>
			{/if}

			{#if sun}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Sunrise / Sunset</p>
					<div class="relative -mt-[40px] ml-[15px] -mb-[10px]">
						<svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
							<defs>
								<path id="curve" d="M 0 125 C 40 110 45 70 75 70 S 110 110 150 125" fill="none" bind:this={sunSVGpath} />
								<mask id="maskTop"><rect x="0" y="0" width="150" height="100" fill="white" /></mask>
								<mask id="maskBottom"><rect x="0" y="100" width="150" height="50" fill="white" /></mask>
							</defs>
							<use href="#curve" stroke="#efb839" stroke-width="6" mask="url(#maskTop)" />
							<use href="#curve" stroke="#ffffff1a" stroke-width="6" mask="url(#maskBottom)" />
							<line x1="0" y1="100" x2="150" y2="100" stroke="black" stroke-opacity="0.2" stroke-width="1" />
						</svg>
						<div
							class="absolute size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff6b00]"
							style="box-shadow: 0 0 9px #ff6b00; left: {getSunPosition(sun.position)?.x ?? 0}px; top: {getSunPosition(sun.position)?.y ?? 0}px;"
						></div>
					</div>
					<div class="flex justify-between">
						<div class="flex flex-col items-start">
							<span class="text-[12px] text-white/60">Sunrise</span>
							<span class="text-[14px] font-medium">{sun.sunrise}</span>
						</div>
						<div class="flex flex-col items-end">
							<span class="text-[12px] text-white/60">Sunset</span>
							<span class="text-[14px] font-medium">{sun.sunset}</span>
						</div>
					</div>
				</div>
			{/if}

			{#if aqi}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Air Quality</p>
					<div class="-mt-[9px] flex flex-col items-center justify-center">
						<div class="relative -mb-[6px] size-[120px]">
							<svg width="120" height="120" viewBox="-15 -15 150 150" class="absolute" style="transform: rotate(-90deg)" aria-hidden="true">
								<circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff1a" stroke-width="10" />
								<circle cx="60" cy="60" r="50" fill="none" stroke={aqi.color} stroke-width="10" stroke-dashoffset="{(100 - Math.min(100, aqi.value / 3)) * 3}px" stroke-dasharray="314px" />
							</svg>
							<div class="flex h-full w-full flex-col items-center justify-center">
								<p class="text-[16px] font-medium">AQI</p>
								<p class="text-[12px] text-white/60">{aqi.value}</p>
							</div>
						</div>
						<p class="mb-[6px] rounded-full px-[10px] text-center text-[12px] leading-[22px] font-medium text-black" style="background-color: {aqi.color}">
							{aqi.level}
						</p>
						<p class="text-center text-[12px] leading-[16px] text-white/60">{aqi.description}</p>
					</div>
				</div>
			{/if}

			{#if snow?.hasSnow}
				<div class="dark p-[6px]">
					<p class="text-[12px] uppercase">Snow Depth</p>
					<img src="/images/weather/snow.webp" alt="" aria-hidden="true" class="mx-auto my-[12px] size-[90px] rounded-full object-cover object-bottom" />
					<p class="mt-[3px] text-center text-[14px] font-semibold">{snow.snowDepth}</p>
					<p class="text-center text-[12px] leading-[16px] text-white/60">{snow.description}</p>
				</div>
			{/if}
		</div>

		<section class="w-full">
			<h2 class="text-[24px]">Hourly Forecast</h2>
			<div class="mt-[8px] grid w-full grid-cols-4 gap-[2px]">
				{#each hourly as hour (hour.time)}
					<div class="dark flex flex-col overflow-hidden rounded-[2px]">
						<h3 class="text-center text-[21px] leading-[24px] font-medium uppercase">{hour.hour}<small>{hour.suffix}</small></h3>
						<div class="light relative w-full flex-1">
							<img src="/images/weather/{hour.background}.webp" alt="" aria-hidden="true" class="absolute top-0 left-0 h-full w-full object-cover" />
							<div class="relative">
								<img src="/metoffice/{hour.icon}.svg" alt="" aria-hidden="true" class="mx-auto mt-[12px] size-[60px] object-cover" style="filter: drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.3));" />
								<p class="mb-[3px] text-center text-[12px] leading-[18px] font-medium text-white" style="text-shadow: 0px 0px 3px #000000">{hour.description}</p>
								<p class="mb-[3px] text-center text-[18px] leading-[24px] font-medium text-white" style="text-shadow: 0px 0px 3px #000000">{formatTemperature(hour.temp)}</p>
								{#if hour.precipitation}
									<p class="mb-[9px] text-center text-[12px] leading-[16px] font-medium text-blue-200" style="text-shadow: 0px 0px 3px #000000">{hour.precipitation}%</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="w-full">
			<h2 class="text-[24px]">7-Day Forecast</h2>
			<div class="mt-[8px] flex flex-wrap gap-[2px]">
				{#each daily.data as day (day.date)}
					{@const max = Math.round(day.temp_max)}
					{@const min = Math.round(day.temp_min)}
					<div class="dark flex h-[36px] w-full items-center justify-between rounded-[2px] pl-[9px]">
						<div class="flex flex-1 items-center">
							<span class="min-w-[50px] text-[16px] font-medium">{formatDay(day.date, daily.time)}</span>
							<img src="/metoffice/{day.icon}.svg" alt="" aria-hidden="true" class="size-[32px] object-cover" />
							<span class="min-w-[36px] text-center text-[12px] font-medium text-[#228be6]">{#if day.precipitation}{day.precipitation}%{/if}</span>
							<div class="w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">{day.description}</div>
						</div>
						<div class="flex h-full w-[120px] items-center justify-end overflow-hidden">
							<div class="min-w-[30px] text-center text-[11px] leading-[16px] text-white/60">{formatTemperature(min)}</div>
							<div class="mt-[3px] h-[6px] rounded-full bg-[#228be6]" style="min-width: {((max - min) / daily.range) * 50}%"></div>
							<div class="min-w-[30px] text-center text-[12px] leading-[16px]" style="margin-right: {((daily.max - max) / daily.range) * 50}%">{formatTemperature(max)}</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<p class="dark w-full rounded-[2px] p-[6px] text-[14px] leading-[18px] text-white/70">
			No forecast available. Add a location in
			<a href="/dashboard" class="text-white underline">Dashboard</a>.
		</p>
	{/if}
</div>

<style>
	.current {
		width: 100%;
		background: linear-gradient(
				0deg,
				rgb(255 255 255 / 30%) 0%,
				rgb(142 187 213) 60%,
				rgb(87 175 226) 100%
			)
			0% 0% no-repeat padding-box padding-box transparent;
		backdrop-filter: blur(6px);
		position: relative;
	}

	.location-list {
		position: relative;
		z-index: 99;
		width: 100%;
		margin-bottom: 6px;
		font-size: 21px;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
	}
</style>
