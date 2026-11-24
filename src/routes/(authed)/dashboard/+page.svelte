<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '$app/forms';
  import Modal, { modalHeader, modalTitle } from '#lib/components/Modal.svelte';
  import { refreshWeather } from '#lib/weather.svelte.ts';
  import TablerChevronDown from '~icons/tabler/chevron-down';
  import TablerMapPin from '~icons/tabler/map-pin';
  import TablerPlus from '~icons/tabler/plus';
  import TablerTrash from '~icons/tabler/trash';
  import TablerX from '~icons/tabler/x';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  const countFormat = new Intl.NumberFormat('en-GB');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const card = 'dark rounded-[3px] ring-1 ring-white/10';
  const cardTitle = 'text-[10px] font-semibold tracking-[0.18em] uppercase text-white/60';
  const input =
    'h-9 w-full min-w-0 rounded-[2px] bg-[#11130f]/5 px-2 text-xs text-[#11130f] ring-1 ring-[#5f665c]/70 outline-none placeholder:text-[#5f665c] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2547ff]';
  const label = 'mb-1 block text-[10px] font-medium text-[#5f665c]';
  const primary =
    'flex h-9 w-full items-center justify-center gap-1.5 rounded-[2px] bg-[#11130f] text-xs font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-[#2b2f28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-50';
  const addButton =
    'inline-flex h-7 shrink-0 items-center gap-1 rounded-[2px] bg-white/10 px-2 text-[10px] font-medium whitespace-nowrap text-white ring-1 ring-white/30 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const iconButton =
    'flex size-8 shrink-0 items-center justify-center rounded-[2px] text-[#5f665c] transition-colors hover:bg-[#b42318]/10 hover:text-[#b42318] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2547ff] disabled:opacity-40';
  const closeButton =
    'flex size-8 shrink-0 items-center justify-center rounded-[2px] text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white';
  const modalPanel =
    'flex h-full w-[382px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[3px] bg-white text-[#11130f] ring-1 ring-[#11130f]/15';
  const listDivider = 'mt-3 border-t border-[#11130f]/10 pt-1';
  const errorText = 'mt-2 text-[10px] text-[#b42318]';

  let showProgress = $state(false);
  let showLocations = $state(false);
  let busy = $state<string | null>(null);
  let savedModel = $state(false);
  let fsrsBatchSize = $state(untrack(() => data.fsrsWordBatchSize));
  let savedBatchSize = $state(false);

  let newDate = $state('');
  let newCount = $state<number | undefined>(undefined);
  let newName = $state('');
  let newLat = $state<number | undefined>(undefined);
  let newLon = $state<number | undefined>(undefined);
  // The select is the editing buffer; the saved value comes back through data.
  let model = $state(untrack(() => data.currentForecastModel));

  const progress = $derived(
    data.progress.map((entry) => {
      const count = Number(entry.count);
      return { ...entry, value: Number.isFinite(count) ? Math.max(0, count) : 0 };
    })
  );
  const first = $derived(progress[0]);
  const latest = $derived(progress[progress.length - 1]);
  const latestYear = $derived(
    latest ? latest.date.slice(0, 4) : String(new Date().getFullYear())
  );
  const recent = $derived([...progress].reverse());

  // Flat 360-unit plot scaled to the card width; index spacing keeps duplicate dates honest.
  const chart = $derived.by(() => {
    if (progress.length === 0) return null;

    const W = 360;
    const H = 200;
    const padL = 10;
    const padR = 10;
    const top = 26;
    const bottom = H - 24;
    let max = 1;
    for (const entry of progress) {
      if (entry.value > max) max = entry.value;
    }
    const y = (value: number) => bottom - (value / max) * (bottom - top);
    const x = (index: number) =>
      progress.length === 1
        ? W / 2
        : padL + (index / (progress.length - 1)) * (W - padL - padR);
    // Keep labels readable if someone stores many entries.
    const labelStep = Math.max(1, Math.ceil(progress.length / 6));
    const points = progress.map((entry, index) => ({
      x: x(index),
      y: y(entry.value),
      value: formatCount(entry.value),
      date: formatDate(entry.date),
      anchor:
        progress.length === 1
          ? 'middle'
          : index === 0
            ? 'start'
            : index === progress.length - 1
              ? 'end'
              : 'middle',
      label: index % labelStep === 0 || index === progress.length - 1
    }));
    const start = points[0];
    const end = points[points.length - 1];

    const line =
      points.length === 1
        ? ''
        : points
            .map(
              (point, index) =>
                `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
            )
            .join(' ');
    const area =
      points.length > 1
        ? `${line} L${end.x.toFixed(1)} ${bottom} L${start.x.toFixed(1)} ${bottom} Z`
        : '';

    return { W, H, line, area, points };
  });

  const chartLabel = $derived.by(() => {
    if (!first || !latest) return 'Progress chart.';
    if (progress.length === 1) {
      return `Progress chart with one entry on ${formatDate(first.date)}, count ${formatCount(first.value)}.`;
    }
    let lowest = latest.value;
    let highest = latest.value;
    for (const entry of progress) {
      if (entry.value < lowest) lowest = entry.value;
      if (entry.value > highest) highest = entry.value;
    }
    return `Progress chart with ${progress.length} entries from ${formatDate(first.date)} to ${formatDate(latest.date)}. Latest count ${formatCount(latest.value)}, lowest ${formatCount(lowest)}, highest ${formatCount(highest)}.`;
  });

  function localDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function formatDate(value: string) {
    const [year, month, day] = value.split('-');
    return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
  }

  function formatCount(value: number) {
    return countFormat.format(value);
  }

  function formatCoord(value: string) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Number(number.toFixed(4))) : value;
  }

  function errorFor(action: string) {
    if (!form || form.action !== action) return undefined;
    return 'error' in form ? form.error : undefined;
  }

  function enhanceAction(action: string, onSuccess?: () => void): SubmitFunction {
    return () => {
      busy = action;
      return async ({ result, update }) => {
        await update();
        busy = null;
        if (result.type === 'success') onSuccess?.();
      };
    };
  }

  const submitAddProgress = enhanceAction('addProgress', () => {
    showProgress = false;
    newDate = localDateKey();
    newCount = undefined;
  });
  const submitDeleteProgress = enhanceAction('deleteProgress');
  const submitAddLocation = enhanceAction('addLocation', () => {
    showLocations = false;
    newName = '';
    newLat = undefined;
    newLon = undefined;
  });
  const submitDeleteLocation = enhanceAction('deleteLocation');
  const submitSetCurrentLocation = enhanceAction('setCurrentLocation', () => {
    void refreshWeather();
  });
  const submitFsrsBatchSize = enhanceAction('setFsrsWordBatchSize', () => {
    savedBatchSize = true;
  });

  const submitModel: SubmitFunction = () => {
    busy = 'setForecastModel';
    savedModel = false;
    return async ({ result, update }) => {
      await update();
      busy = null;
      savedModel = result.type === 'success';
      if (savedModel) void refreshWeather();
    };
  };

  onMount(() => {
    newDate = localDateKey();
  });
</script>

<svelte:head>
  <title>Dashboard</title>
</svelte:head>

<div class="flex min-h-full flex-col gap-[3px]">
  <header
    class="dark flex items-center justify-between gap-2 rounded-[3px] px-3.5 py-2.5 ring-1 ring-white/10"
  >
    <h1 class="font-serif text-[22px] leading-none text-[#4ade80]">Dashboard</h1>
    <span class="text-[10px] font-medium tabular-nums text-white/50">{latestYear}</span>
  </header>

  <section class="{card} overflow-hidden" aria-labelledby="progress-heading">
    <div class="flex items-center justify-between gap-2 px-3.5 py-3">
      <h2 id="progress-heading" class={cardTitle}>Progress</h2>
      <button
        type="button"
        class={addButton}
        aria-haspopup="dialog"
        aria-label="Add or remove progress entries"
        onclick={() => (showProgress = true)}
      >
        <TablerPlus width="12" height="12" aria-hidden="true" />
        Add entry
      </button>
    </div>

    {#if chart}
      <svg
        viewBox="0 0 {chart.W} {chart.H}"
        class="block h-auto w-full"
        role="img"
        aria-label={chartLabel}
      >
        <defs>
          <linearGradient id="progress-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34d399" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#34d399" stop-opacity="0" />
          </linearGradient>
        </defs>
        {#if chart.area}
          <path d={chart.area} fill="url(#progress-area)" />
        {/if}
        {#if chart.line}
          <path
            d={chart.line}
            fill="none"
            stroke="#34d399"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {/if}
        {#each chart.points as point, index (index)}
          <circle
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="#0b2b1c"
            stroke="#d1fae5"
            stroke-width="1.5"
          />
          {#if point.label}
            <text
              x={point.x}
              y={Math.max(point.y - 9, 12)}
              text-anchor={point.anchor}
              font-size="9"
              font-weight="600"
              fill="#ffffff">{point.value}</text
            >
            <text
              x={point.x}
              y={chart.H - 8}
              text-anchor={point.anchor}
              font-size="8"
              fill="#ffffff"
              fill-opacity="0.55">{point.date}</text
            >
          {/if}
        {/each}
      </svg>
    {:else}
      <p class="px-3.5 pb-3.5 text-[11px] leading-snug text-white/60">
        No entries yet. Add a date and count to start the line.
      </p>
    {/if}
  </section>

  <section class="{card} overflow-hidden" aria-labelledby="locations-heading">
    <div class="flex items-center justify-between gap-2 px-3.5 py-3">
      <h2 id="locations-heading" class={cardTitle}>Locations</h2>
      <button
        type="button"
        class={addButton}
        aria-haspopup="dialog"
        aria-label="Add or remove locations"
        onclick={() => (showLocations = true)}
      >
        <TablerPlus width="12" height="12" aria-hidden="true" />
        Add place
      </button>
    </div>

    {#if data.locations.length > 0}
      <ul class="divide-y divide-white/10 border-t border-white/10">
        {#each data.locations as location (location.id)}
          <li class="flex items-center gap-2 px-3.5 py-2">
            <TablerMapPin
              width="14"
              height="14"
              class="shrink-0 text-[#4ade80]"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[12px] leading-tight font-medium">{location.name}</p>
              <p class="mt-0.5 text-[10px] leading-tight tabular-nums text-white/50">
                {formatCoord(location.latitude)}, {formatCoord(location.longitude)}
              </p>
            </div>
            <form
              method="POST"
              action="?/setCurrentLocation"
              use:enhance={submitSetCurrentLocation}
            >
              <input type="hidden" name="id" value={location.id} />
              <button
                type="submit"
                aria-pressed={data.currentLocationId === location.id}
                disabled={data.currentLocationId === location.id || busy === 'setCurrentLocation'}
                class="shrink-0 rounded-[2px] px-2 py-1 text-[10px] font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-default {data.currentLocationId === location.id
                  ? 'bg-[#22c55e] text-[#11130f] ring-[#15803d]'
                  : 'bg-white/10 text-white/70 ring-white/25 hover:bg-white/20 hover:text-white'}"
              >
                {data.currentLocationId === location.id ? 'Current' : 'Set'}
              </button>
            </form>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="border-t border-white/10 px-3.5 py-3 text-[11px] leading-snug text-white/60">
        No places saved. Add a name and coordinates to keep them here.
      </p>
    {/if}
    {#if errorFor('setCurrentLocation')}
      <p role="alert" class="px-3.5 pb-3 text-[10px] text-[#fca5a5]">
        {errorFor('setCurrentLocation')}
      </p>
    {/if}
  </section>

  <section class="{card} px-3.5 py-3" aria-labelledby="forecast-heading">
    <h2 id="forecast-heading" class={cardTitle}>Forecast model</h2>

    <form method="POST" action="?/setForecastModel" use:enhance={submitModel} class="mt-2.5">
      <label for="forecast-model" class="sr-only">Forecast model</label>
      <div class="relative">
        <select
          id="forecast-model"
          name="model"
          bind:value={model}
          onchange={() => (savedModel = false)}
          class="h-9 w-full appearance-none rounded-[2px] bg-white/10 py-0 pr-8 pl-2 text-xs font-medium text-white ring-1 ring-white/25 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          {#each data.forecastModels as option (option.value)}
            <option value={option.value} class="bg-white text-[#11130f]">{option.label}</option>
          {/each}
        </select>
        <TablerChevronDown
          width="14"
          height="14"
          class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-white/60"
          aria-hidden="true"
        />
      </div>

      <button
        type="submit"
        class="{primary} mt-2"
        disabled={busy === 'setForecastModel'}
      >
        Save model
      </button>

      <p
        class="mt-2 text-[10px] {savedModel ? 'text-[#4ade80]' : 'text-white/60'}"
        aria-live="polite"
      >
        {savedModel ? 'Model saved.' : 'Used for the weather forecast.'}
      </p>
      {#if errorFor('setForecastModel')}
        <p role="alert" class="text-[10px] text-[#fca5a5]">{errorFor('setForecastModel')}</p>
      {/if}
    </form>
  </section>

  <section class="{card} px-3.5 py-3" aria-labelledby="fsrs-batch-heading">
    <h2 id="fsrs-batch-heading" class={cardTitle}>Words per batch</h2>

    <form
      method="POST"
      action="?/setFsrsWordBatchSize"
      use:enhance={submitFsrsBatchSize}
      class="mt-2.5"
    >
      <label for="fsrs-batch-size" class="sr-only">Words per batch (FSRS)</label>
      <input
        id="fsrs-batch-size"
        name="size"
        type="number"
        min="1"
        max="99"
        step="1"
        required
        bind:value={fsrsBatchSize}
        oninput={() => (savedBatchSize = false)}
        class="h-9 w-full rounded-[2px] bg-white/10 px-2 text-xs font-medium text-white ring-1 ring-white/25 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
      />

      <button type="submit" class="{primary} mt-2" disabled={busy === 'setFsrsWordBatchSize'}>
        Save batch size
      </button>

      <p
        class="mt-2 text-[10px] {savedBatchSize ? 'text-[#4ade80]' : 'text-white/60'}"
        aria-live="polite"
      >
        {savedBatchSize ? 'Batch size saved.' : 'Used by the FSRS "Get words batch" button.'}
      </p>
      {#if errorFor('setFsrsWordBatchSize')}
        <p role="alert" class="text-[10px] text-[#fca5a5]">
          {errorFor('setFsrsWordBatchSize')}
        </p>
      {/if}
    </form>
  </section>
</div>

<Modal bind:showModal={showProgress} label="Add or remove progress">
  <div class={modalPanel}>
    <div class={modalHeader}>
      <h2 class={modalTitle}>Progress</h2>
      <button
        type="button"
        class={closeButton}
        aria-label="Close progress"
        onclick={() => (showProgress = false)}
      >
        <TablerX width="18" height="18" aria-hidden="true" />
      </button>
    </div>

    <div class="min-h-0 overflow-y-auto p-3">
      <form method="POST" action="?/addProgress" use:enhance={submitAddProgress}>
        <div class="grid grid-cols-[1fr_78px] gap-2">
          <div>
            <label for="progress-date" class={label}>Date</label>
            <input
              id="progress-date"
              name="date"
              type="date"
              required
              bind:value={newDate}
              class={input}
            />
          </div>
          <div>
            <label for="progress-count" class={label}>Count</label>
            <input
              id="progress-count"
              name="count"
              type="number"
              min="0"
              max="10000000"
              step="1"
              required
              bind:value={newCount}
              class={input}
            />
          </div>
        </div>

        {#if errorFor('addProgress')}
          <p role="alert" class={errorText}>{errorFor('addProgress')}</p>
        {/if}

        <button type="submit" class="{primary} mt-2" disabled={busy === 'addProgress'}>
          <TablerPlus width="13" height="13" aria-hidden="true" />
          Add entry
        </button>
      </form>

      <div class={listDivider}>
        {#if recent.length > 0}
          <ul class="divide-y divide-[#11130f]/10">
            {#each recent as entry (entry.id)}
              <li class="flex items-center gap-2 py-1.5">
                <span class="flex-1 text-[11px] tabular-nums">{formatDate(entry.date)}</span>
                <span class="text-[11px] font-medium tabular-nums">{formatCount(entry.value)}</span>
                <form method="POST" action="?/deleteProgress" use:enhance={submitDeleteProgress}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    class={iconButton}
                    aria-label="Remove entry from {formatDate(entry.date)}, count {formatCount(
                      entry.value
                    )}"
                    disabled={busy === 'deleteProgress'}
                  >
                    <TablerTrash width="14" height="14" aria-hidden="true" />
                  </button>
                </form>
              </li>
            {/each}
          </ul>
          {#if errorFor('deleteProgress')}
            <p role="alert" class={errorText}>{errorFor('deleteProgress')}</p>
          {/if}
        {:else}
          <p class="py-2 text-[11px] text-[#5f665c]">No entries yet.</p>
        {/if}
      </div>
    </div>
  </div>
</Modal>

<Modal bind:showModal={showLocations} label="Add or remove locations">
  <div class={modalPanel}>
    <div class={modalHeader}>
      <h2 class={modalTitle}>Locations</h2>
      <button
        type="button"
        class={closeButton}
        aria-label="Close locations"
        onclick={() => (showLocations = false)}
      >
        <TablerX width="18" height="18" aria-hidden="true" />
      </button>
    </div>

    <div class="min-h-0 overflow-y-auto p-3">
      <form method="POST" action="?/addLocation" use:enhance={submitAddLocation}>
        <label for="location-name" class={label}>Name</label>
        <input
          id="location-name"
          name="name"
          type="text"
          maxlength="80"
          required
          autocomplete="off"
          placeholder="Where is it?"
          bind:value={newName}
          class={input}
        />

        <div class="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label for="location-lat" class={label}>Latitude</label>
            <input
              id="location-lat"
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              required
              placeholder="52.37"
              bind:value={newLat}
              class={input}
            />
          </div>
          <div>
            <label for="location-lon" class={label}>Longitude</label>
            <input
              id="location-lon"
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              placeholder="4.89"
              bind:value={newLon}
              class={input}
            />
          </div>
        </div>

        {#if errorFor('addLocation')}
          <p role="alert" class={errorText}>{errorFor('addLocation')}</p>
        {/if}

        <button type="submit" class="{primary} mt-2" disabled={busy === 'addLocation'}>
          <TablerPlus width="13" height="13" aria-hidden="true" />
          Add place
        </button>
      </form>

      <div class={listDivider}>
        {#if data.locations.length > 0}
          <ul class="divide-y divide-[#11130f]/10">
            {#each data.locations as location (location.id)}
              <li class="flex items-center gap-2 py-1.5">
                <TablerMapPin
                  width="14"
                  height="14"
                  class="shrink-0 text-[#15803d]"
                  aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[12px] leading-tight font-medium">{location.name}</p>
                  <p class="text-[10px] leading-tight tabular-nums text-[#5f665c]">
                    {formatCoord(location.latitude)}, {formatCoord(location.longitude)}
                  </p>
                </div>
                <form method="POST" action="?/deleteLocation" use:enhance={submitDeleteLocation}>
                  <input type="hidden" name="id" value={location.id} />
                  <button
                    type="submit"
                    class={iconButton}
                    aria-label="Remove {location.name}"
                    disabled={busy === 'deleteLocation'}
                  >
                    <TablerTrash width="14" height="14" aria-hidden="true" />
                  </button>
                </form>
              </li>
            {/each}
          </ul>
          {#if errorFor('deleteLocation')}
            <p role="alert" class={errorText}>{errorFor('deleteLocation')}</p>
          {/if}
        {:else}
          <p class="py-2 text-[11px] text-[#5f665c]">No places yet.</p>
        {/if}
      </div>
    </div>
  </div>
</Modal>
