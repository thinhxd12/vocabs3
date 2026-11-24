<script lang="ts">
	import {
		FullscreenControl,
		GlobeControl,
		Map as MapLibreMap,
		Marker,
		NavigationControl,
		ScaleControl,
		setWorkerUrl,
		type StyleSpecification
	} from 'maplibre-gl';
	// MapLibre v6 loads its worker by appending a fixed filename to
	// `import.meta.url`; that filename is not emitted by the bundler. Importing
	// the worker as an asset pins it to a real, hashed URL instead.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
	import { onMount, untrack } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import type { Attachment } from 'svelte/attachments';
	import IconPause from '~icons/ph/pause';
	import IconPlay from '~icons/ph/play';
	import protomaps from '#lib/assets/json/protomaps.json';

	setWorkerUrl(maplibreWorkerUrl);

	let { latitude, longitude }: { latitude: number; longitude: number } = $props();

	/** Ten-minute frames; the mosaic is published with a short delay. */
	const FRAME_COUNT = 12;
	const FRAME_STEP = 700;
	const REFRESH_MS = 5 * 60_000;

	/** The radar mosaic covers the whole country; these are its corners. */
	const RADAR_BOUNDS: [[number, number], [number, number], [number, number], [number, number]] = [
		[97, 25.2],
		[115, 25.2],
		[115, 7.2],
		[97, 7.2]
	];

	type Frame = { time: string; path: string; url: string };

	let map: MapLibreMap | undefined;
	let frames = $state<Frame[]>([]);
	let frameIndex = $state(0);
	let radarUrl = $state('');
	let playing = $state(false);
	let status = $state<'loading' | 'ready' | 'empty'>('loading');
	let styleReady = $state(false);

	let playTimer: ReturnType<typeof setInterval> | null = null;
	let refreshTimer: ReturnType<typeof setInterval> | null = null;
	let preloadTimers: ReturnType<typeof setTimeout>[] = [];
	let preloadedImages: HTMLImageElement[] = [];
	let destroyed = false;

	const frameLabel = $derived(
		frames[frameIndex]
			? new Date(frames[frameIndex].time).toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})
			: ''
	);

	function stopPlayback() {
		if (playTimer) clearInterval(playTimer);
		playTimer = null;
	}

	function clearPreloads() {
		for (const timer of preloadTimers) clearTimeout(timer);
		preloadTimers = [];
		preloadedImages = [];
	}

	/**
	 * Image sources have no setUrl; the source and layer must be recreated.
	 * Style readiness is guaranteed by `styleReady` (set on `style.load`):
	 * addSource/addLayer only need the parsed style JSON, while
	 * `isStyleLoaded()` also waits on unrelated DEM TileJSON, sprite and
	 * image loads, which silently dropped the overlay on fresh mounts.
	 */
	function syncRadar(url: string) {
		const instance = map;
		if (!instance || destroyed) return;

		try {
			if (instance.getLayer('radar-layer')) instance.removeLayer('radar-layer');
			if (instance.getSource('radar-source')) instance.removeSource('radar-source');
			if (!url) return;

			instance.addSource('radar-source', { type: 'image', url, coordinates: RADAR_BOUNDS });
			instance.addLayer({
				id: 'radar-layer',
				type: 'raster',
				source: 'radar-source',
				paint: { 'raster-opacity': 0.68, 'raster-fade-duration': 0 }
			});
		} catch {
			// Radar is an overlay; the base map stays usable without it.
		}
	}

	function showFrame() {
		radarUrl = frames[frameIndex]?.url ?? '';
	}

	// Re-apply the overlay when the frame URL changes or the style finishes
	// parsing (style.load), so a frame arriving before style.load still gets shown.
	$effect(() => {
		if (styleReady) syncRadar(radarUrl);
	});

	/**
	 * The newest frame can lag behind the clock, so the timeline starts at the
	 * newest ten-minute slot that is at least six minutes old and the component
	 * then checks it before showing it.
	 */
	function buildCandidates(): Frame[] {
		const cursor = new SvelteDate();
		cursor.setUTCSeconds(0, 0);
		cursor.setUTCMinutes(Math.floor((cursor.getUTCMinutes() - 6) / 10) * 10);

		const next: Frame[] = [];
		for (let i = 0; i < FRAME_COUNT; i++) {
			const year = cursor.getUTCFullYear();
			const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
			const day = String(cursor.getUTCDate()).padStart(2, '0');
			const hours = String(cursor.getUTCHours()).padStart(2, '0');
			const minutes = String(cursor.getUTCMinutes()).padStart(2, '0');
			const stamp = `${year}${month}${day}${hours}${minutes}`;

			next.push({
				time: `${year}-${month}-${day}T${hours}:${minutes}:00Z`,
				path: `${year}${month}${day}/COM_${stamp}_CMAX00`,
				url: `/api/radar?t=${stamp}`
			});

			cursor.setUTCMinutes(cursor.getUTCMinutes() - 10);
		}

		return next;
	}

	/**
	 * Takes the newest frame that Hymetnet actually has. Usually the first
	 * candidate answers; a delayed publication only costs one extra request.
	 * Returns the index of the first available frame, or -1.
	 */
	async function firstAvailable(candidates: Frame[]): Promise<number> {
		for (let index = 0; index < Math.min(3, candidates.length); index++) {
			try {
				const response = await fetch(candidates[index].url, {
					method: 'HEAD',
					signal: AbortSignal.timeout(4_000)
				});
				if (response.ok) return index;
			} catch {
				// Network hiccup: stop probing and let the first frame try to load.
				return 0;
			}
		}

		return -1;
	}

	/** Warms the browser cache so playback steps do not wait on the network. */
	function preload(list: Frame[]) {
		clearPreloads();

		list.slice(1).forEach((frame, index) => {
			preloadTimers.push(
				setTimeout(() => {
					const image = new Image();
					image.src = frame.url;
					// Keep a reference until the next refresh; an unrooted Image can be
					// collected while its request is still in flight.
					preloadedImages.push(image);
				}, (index + 1) * 140)
			);
		});
	}

	async function buildTimeline() {
		stopPlayback();
		playing = false;
		clearPreloads();
		status = 'loading';

		const candidates = buildCandidates();
		const index = await firstAvailable(candidates);

		if (destroyed) return;

		if (index < 0) {
			frames = [];
			frameIndex = 0;
			radarUrl = '';
			status = 'empty';
			return;
		}

		frames = candidates.slice(index);
		frameIndex = 0;
		status = 'ready';
		showFrame();
		preload(frames);
	}

	function togglePlayback() {
		if (playing) {
			stopPlayback();
			playing = false;
			return;
		}

		if (frames.length < 2) return;

		stopPlayback();
		// Play oldest → newest: start at the last frame and walk back to zero.
		frameIndex = frames.length - 1;
		showFrame();
		playing = true;

		playTimer = setInterval(() => {
			if (frameIndex <= 0) {
				stopPlayback();
				playing = false;
				frameIndex = 0;
				showFrame();
				return;
			}

			frameIndex -= 1;
			showFrame();
		}, FRAME_STEP);
	}

	const mountMap: Attachment = (node) => {
		styleReady = false;
		const center: [number, number] = [longitude, latitude];
		const instance = new MapLibreMap({
			container: node as HTMLElement,
			style: protomaps as StyleSpecification,
			center,
			zoom: 8,
			maxZoom: 12,
			attributionControl: false
		});
		map = instance;

		instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
		instance.addControl(new ScaleControl(), 'bottom-right');
		instance.addControl(new FullscreenControl(), 'top-right');
		instance.addControl(new GlobeControl(), 'top-right');
		new Marker({ color: '#34d399', scale: 0.72 }).setLngLat(center).addTo(instance);

		const onLoad = () => {
			if (destroyed) return;
			instance.addSource('mapterhorn', {
				type: 'raster-dem',
				url: 'https://tiles.mapterhorn.com/tilejson.json'
			});
			instance.addLayer({
				id: 'mapterhorn-hillshade',
				type: 'hillshade',
				source: 'mapterhorn',
				paint: { 'hillshade-exaggeration': 0.1 }
			}, instance.getLayer('radar-layer') ? 'radar-layer' : undefined);
		};
		if (instance.isStyleLoaded()) untrack(onLoad);
		else instance.once('load', onLoad);

		// addSource is legal once the style JSON parses (style.load); waiting for
		// full isStyleLoaded() also waits on the DEM TileJSON and sprite, which
		// left the overlay unattached on fresh mounts.
		instance.once('style.load', () => {
			if (!destroyed) styleReady = true;
		});

		return () => {
			instance.remove();
			if (map === instance) map = undefined;
		};
	};

	onMount(() => {
		destroyed = false;
		void buildTimeline();
		refreshTimer = setInterval(() => void buildTimeline(), REFRESH_MS);

		return () => {
			destroyed = true;
			stopPlayback();
			playing = false;
			clearPreloads();
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = null;
		};
	});
</script>

<div
	class="relative h-[290px] w-full overflow-hidden rounded-[8px] border border-white/10 bg-slate-900"
>
	<div {@attach mountMap} class="size-full"></div>

	{#if frames.length}
		<button
			type="button"
			onclick={togglePlayback}
			aria-label={playing
				? `Pause radar animation, at ${frameLabel}`
				: `Play radar animation, at ${frameLabel}`}
			class="absolute top-[3px] left-[3px] z-10 flex items-center gap-[6px] rounded-full border border-[#333] bg-white/95 px-[10px] py-[6px] text-[11px] leading-[16px] font-semibold text-black backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
		>
			{#if playing}
				<IconPause class="size-[14px]" aria-hidden="true" />
			{:else}
				<IconPlay class="size-[14px]" aria-hidden="true" />
			{/if}
			<span class="tabular-nums">{frameLabel}</span>
		</button>
	{:else if status === 'empty'}
		<span
			class="absolute top-[3px] left-[3px] z-10 rounded-full border border-[#333] bg-white/95 px-[10px] py-[6px] text-[11px] leading-[16px] font-semibold text-black/70 backdrop-blur"
		>
			Radar unavailable
		</span>
	{:else}
		<span
			class="absolute top-[3px] left-[3px] z-10 flex items-center gap-[6px] rounded-full border border-[#333] bg-white/95 px-[10px] py-[6px] text-[11px] leading-[16px] font-semibold text-black/70 backdrop-blur"
		>
			<span class="size-[6px] animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none"></span>
			Loading radar
		</span>
	{/if}

	<div class="absolute bottom-[12px] left-[3px] z-10 rounded-[8px] bg-white p-[4px]">
		<img src="/images/DBZ.jpg" alt="Radar reflectivity legend" width="18" />
	</div>
</div>

<style>
	:global(.maplibregl-ctrl) {
		margin: 3px !important;
	}

	:global(.maplibregl-ctrl button) {
		width: 24px !important;
		height: 24px !important;
	}
</style>
