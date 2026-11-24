<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { getNavWeatherBackground, getWeatherInfo } from '#lib/weather.ts';
	import { startWeatherPolling, stopWeatherPolling, weather } from '#lib/weather.svelte.ts';

	const current = $derived(weather.data?.current);
	const info = $derived(
		current ? getWeatherInfo(current.weather_code, current.is_day) : null
	);
	const background = $derived(
		current ? getNavWeatherBackground(current.weather_code, current.is_day) : 'cloudy'
	);
	const temperature = $derived(current ? `${Math.round(current.temperature_2m)}°` : '');
	const feelsLike = $derived(current ? `${Math.round(current.apparent_temperature)}°` : '');
	const precipitation = $derived(
		current
			? current.rain
				? `${current.rain} mm`
				: current.showers
					? `${current.showers} mm`
					: current.snowfall
						? `${current.snowfall} cm`
						: ''
			: ''
	);
	const label = $derived(
		weather.data
			? `${weather.data.location.name}: ${info?.description}, ${temperature}. Open weather forecast`
			: 'Open weather forecast'
	);

	$effect(() => {
		startWeatherPolling();
		return stopWeatherPolling;
	});
</script>

<a
	href="/weather"
	title={label}
	aria-label={label}
	class="dark relative hidden h-full w-[90px] shrink-0 overflow-hidden rounded-[2px] border-l border-white/10 text-white min-[381px]:block"
>
	{#if info && current}
		<div class="absolute top-[3px] right-[3px] z-1 flex gap-[3px]">
			<img
				src="/metoffice/{info.icon}.svg"
				alt=""
				aria-hidden="true"
				class="size-[28px] object-cover"
				style="filter: drop-shadow(0px 0px 1px rgba(0, 0, 0, 0.6));"
			/>
			<div
				class="flex flex-col items-end text-[8px] leading-[9px] font-medium"
				style="text-shadow: 0px 0px 3px #000000"
			>
				<span class="text-[9px] font-semibold">{temperature}</span>
				<span>{feelsLike}</span>
				{#if precipitation}<span>{precipitation}</span>{/if}
			</div>
		</div>

		{#key background}
			<img
				src="/images/weather/{background}.webp"
				alt=""
				aria-hidden="true"
				class="absolute top-0 left-0 h-full w-[90px] object-cover object-top"
				in:fly={{ y: -42, duration: prefersReducedMotion.current ? 0 : 600 }}
			/>
		{/key}

		<div
			class="marquee absolute bottom-0 w-full text-[8px] leading-[12px] font-medium text-white"
		>
			<span>{info.description}</span>
		</div>
	{:else}
		<span class="flex size-full items-center justify-center text-[9px] text-white/70">
			{weather.error ? 'Unavailable' : 'Weather'}
		</span>
	{/if}
</a>

<style>
	.marquee {
		white-space: nowrap;
		overflow: hidden;
		animation: marquee 12s linear infinite;
	}

	.marquee span {
		margin: 0 9px;
		text-shadow: 0 0 3px #000;
	}

	@keyframes marquee {
		0% {
			transform: translateX(100%);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee {
			animation: none;
		}
	}
</style>
