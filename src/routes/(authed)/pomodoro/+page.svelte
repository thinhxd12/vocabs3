<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { invalidateAll } from "$app/navigation";
  import {
    configurePomodoro,
    localDateKey,
    pausePomodoro,
    pomodoro,
    resetPomodoroSession,
    selectPomodoroMode,
    setPomodoroCompletionHandler,
    startPomodoro,
    togglePomodoro,
  } from "#lib/pomodoro.svelte.ts";
  import Circle from "#lib/components/Circle.svelte";
  import Heatmap from "#lib/components/Heatmap.svelte";
  import Modal, { modalHeader, modalTitle } from "#lib/components/Modal.svelte";
  import Pagination from "#lib/components/Pagination.svelte";
  import { glassButton } from "#lib/styles.ts";
  import TablerCircleLetterFFilled from "~icons/tabler/circle-letter-f-filled";
  import TablerCircleLetterSFilled from "~icons/tabler/circle-letter-s-filled";
  import TablerCircleLetterLFilled from "~icons/tabler/circle-letter-l-filled";
  import TablerX from "~icons/tabler/x";
  import MaterialSymbolsSettingsRounded from "~icons/material-symbols/settings-rounded";
  import MaterialSymbolsInsertChartOutlineRounded from "~icons/material-symbols/insert-chart-outline-rounded";
  import MaterialSymbolsBackgroundGridSmallSharp from "~icons/material-symbols/background-grid-small-sharp";
  import MaterialSymbolsVolumeUpRounded from "~icons/material-symbols/volume-up-rounded";
  import MaterialSymbolsVolumeOffRounded from "~icons/material-symbols/volume-off-rounded";
  import type { PageProps } from "./$types";

  type Mode = "focus" | "shortbreak" | "longbreak";

  interface TimerSettings {
    focus: number;
    shortbreak: number;
    longbreak: number;
    intervals: number;
    muted: boolean;
  }

  const DEFAULT_SETTINGS: TimerSettings = {
    focus: 7,
    shortbreak: 1,
    longbreak: 15,
    intervals: 10,
    muted: false,
  };

  const LABELS: Record<Mode, string> = {
    focus: "Focus",
    shortbreak: "Short break",
    longbreak: "Long break",
  };
  const IMAGES: Record<Mode, string> = {
    focus: "/images/Hans Adam Weissenkircher-Helios on His Chariot.webp",
    shortbreak: "/images/Giovanni Battista Tiepolo-Hermes.webp",
    longbreak:
      "/images/Peder Mork Monsted-Figures Resting in a River Landscape.webp",
  };
  const TRACKS: Record<Mode, string> = {
    focus: "/audio/mp3_focus.ogg",
    shortbreak: "/audio/mp3_shortbreak.ogg",
    longbreak: "/audio/mp3_longbreak.ogg",
  };

  // Old vocabs1 buttons: 18px square, 2px radius, 3px gaps, blurred white glass.
  const chip = `${glassButton} size-[18px] bg-white/15 text-[#11130f] hover:bg-white/30`;
  const chipActive = "!bg-green-400 hover:!bg-green-400";
  const panel =
    "flex h-full w-[382px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[2px] bg-white ring-1 ring-[#11130f]/15";
  const closeButton =
    "text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  const input =
    "h-7 w-full rounded-[2px] bg-black/5 px-2 text-xs text-[#11130f] outline-none focus-visible:outline-2 focus-visible:outline-[#2547ff]";

  let { data }: PageProps = $props();

  // Saved settings come from the dashboard row; DEFAULT_SETTINGS is the fallback.
  const initialSettings = untrack(() => data.pomodoroSettings) ?? DEFAULT_SETTINGS;

  let settings = $state<TimerSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });

  // Timing lives in the module store so the layout's worker keeps it running
  // while this page is unmounted. Settings and sound stay local to the page.
  const mode = $derived(pomodoro.mode);
  const interval = $derived(pomodoro.interval);
  const isRunning = $derived(pomodoro.isRunning);
  const remainingMs = $derived(pomodoro.remainingMs);
  let audioEl = $state<HTMLAudioElement>();

  let today = $state("");
  let logError = $state("");

  let showReport = $state(false);
  let showHeatmap = $state(false);
  let showSettings = $state(false);
  let page = $state(1);

  let wakeOn = $state(false);
  let wakeSupported = $state(false);
  let wakeError = $state("");
  let wakeLock: WakeLockSentinel | null = null;

  const rows = $derived(data.rows);
  const perPage = 12;
  const pageRows = $derived(rows.slice((page - 1) * perPage, page * perPage).reverse());
  const maxTime = $derived(Math.max(1, ...rows.map((row) => row.time)));
  const todayTotal = $derived(
    today ? (rows.find((row) => row.date === today)?.time ?? 0) : 0,
  );
  const totalMinutes = $derived(rows.reduce((sum, row) => sum + row.time, 0));

  const secondsLeft = $derived(Math.ceil(remainingMs / 1000));
  const clock = $derived(
    `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`,
  );
  // The number input can hold fractions/0/negatives mid-edit; Array() would throw, so clamp on read.
  const intervals = $derived(clampInt(settings.intervals, 10, 12));

  function clampInt(value: number, fallback: number, max = 180) {
    return Math.min(max, Math.max(1, Math.trunc(value) || fallback));
  }

  function formatMinutes(total: number) {
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function barWidth(total: number) {
    return Math.max(2, Math.round((total / maxTime) * 100));
  }

  function begin() {
    startPomodoro();
  }

  function pause() {
    pausePomodoro();
  }

  function toggle() {
    togglePomodoro();
  }

  function selectMode(next: Mode) {
    selectPomodoroMode(next);
  }

  async function logMinutes(minutes: number) {
    const body = new FormData();
    body.set("date", localDateKey());
    body.set("minutes", String(minutes));

    try {
      const response = await fetch("?/add", {
        method: "POST",
        body,
        headers: { "x-sveltekit-action": "true" },
      });
      if (!response.ok) throw new Error();
      logError = "";
      await invalidateAll();
    } catch {
      logError = "Could not save this session.";
    }
  }

  async function persistSettings(value: TimerSettings) {
    const body = new FormData();
    body.set("focus", String(value.focus));
    body.set("shortbreak", String(value.shortbreak));
    body.set("longbreak", String(value.longbreak));
    body.set("intervals", String(value.intervals));
    body.set("muted", String(value.muted));
    try {
      await fetch("?/saveSettings", {
        method: "POST",
        body,
        headers: { "x-sveltekit-action": "true" },
      });
    } catch {
      // Save failed; the next change retries.
    }
  }

  function playChime(endedMode: Mode) {
    const el = audioEl;
    if (!el || settings.muted) return;
    el.src = TRACKS[endedMode];
    el.play().catch(() => {});
  }

  function closeSettings() {
    settings.focus = clampInt(settings.focus, 7);
    settings.shortbreak = clampInt(settings.shortbreak, 1);
    settings.longbreak = clampInt(settings.longbreak, 15);
    settings.intervals = clampInt(settings.intervals, 10, 12);
    if (!isRunning) resetPomodoroSession();
    showSettings = false;
  }

  async function acquireWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } catch {
      wakeOn = false;
      wakeError = "This browser refused the screen wake lock.";
    }
  }

  async function toggleWakeLock() {
    wakeError = "";
    wakeOn = !wakeOn;
    if (wakeOn) await acquireWakeLock();
    else {
      await wakeLock?.release().catch(() => {});
      wakeLock = null;
    }
  }

  // The browser drops the lock when the tab hides; restore it if the user still wants it.
  function onVisibilityChange() {
    if (document.visibilityState === "visible" && wakeOn && !wakeLock)
      void acquireWakeLock();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== " " || event.repeat) return;
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, dialog",
      )
    )
      return;
    event.preventDefault();
    toggle();
  }

  onMount(() => {
    wakeSupported = "wakeLock" in navigator;
    today = localDateKey();

    const stopHandler = setPomodoroCompletionHandler((completed, minutes) => {
      // A session can cross midnight; refresh so today's total/highlight stay right.
      today = localDateKey();
      void logMinutes(minutes);
      // Old vocabs1 only plays ambient audio when a session ends and the mode changes.
      playChime(completed);
    });

    return () => {
      stopHandler();
      void wakeLock?.release().catch(() => {});
    };
  });

  $effect(() => {
    const { focus, shortbreak, longbreak, intervals } = settings;
    untrack(() => configurePomodoro({ focus, shortbreak, longbreak, intervals }));
  });

  let lastSaved = untrack(() => JSON.stringify(settings));
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const snapshot = JSON.stringify(settings);
    if (snapshot === lastSaved) return;
    lastSaved = snapshot;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persistSettings(settings), 600);
  });

</script>

<svelte:head>
  <title>{clock} · {LABELS[mode]}</title>
</svelte:head>

<svelte:window onkeydown={onKeyDown} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<audio bind:this={audioEl} preload="auto"></audio>

<div class="flex min-h-full flex-col justify-end">
  <div class="grid grid-cols-[1fr_auto_1fr] items-center p-[3px]">
    <div class="flex gap-[3px]">
      <button
        type="button"
        class="{chip} {mode === 'focus' ? chipActive : ''}"
        aria-label="Focus"
        aria-pressed={mode === "focus"}
        onclick={() => selectMode("focus")}
      >
        <TablerCircleLetterFFilled width="16" height="16" />
      </button>
      <button
        type="button"
        class="{chip} {mode === 'shortbreak' ? chipActive : ''}"
        aria-label="Short break"
        aria-pressed={mode === "shortbreak"}
        onclick={() => selectMode("shortbreak")}
      >
        <TablerCircleLetterSFilled width="16" height="16" />
      </button>
      <button
        type="button"
        class="{chip} {mode === 'longbreak' ? chipActive : ''}"
        aria-label="Long break"
        aria-pressed={mode === "longbreak"}
        onclick={() => selectMode("longbreak")}
      >
        <TablerCircleLetterLFilled width="16" height="16" />
      </button>
    </div>

    <div
      role="group"
      class="flex items-center gap-[6px]"
      aria-label="Interval {interval} of {intervals}"
    >
      {#each Array(intervals) as _, i (i)}
        <span
          class="size-[3px] rounded-full ring-1 ring-[#11130f] {i < interval
            ? 'bg-[#11130f]'
            : ''}"
        ></span>
      {/each}
    </div>

    <div class="flex justify-self-end gap-[3px]">
      <button
        type="button"
        class={chip}
        aria-label="Open report"
        onclick={(event) => {
          // Blur so dialog close cannot restore focus here and re-open it with Space.
          event.currentTarget.blur();
          page = 1;
          showReport = true;
          void invalidateAll().catch(() => {});
        }}
      >
        <MaterialSymbolsInsertChartOutlineRounded width="14" height="14" />
      </button>
      <button
        type="button"
        class={chip}
        aria-label="Open heatmap"
        onclick={(event) => {
          event.currentTarget.blur();
          showHeatmap = true;
          void invalidateAll().catch(() => {});
        }}
      >
        <MaterialSymbolsBackgroundGridSmallSharp width="14" height="14" />
      </button>
      <button
        type="button"
        class={chip}
        aria-label="Open settings"
        onclick={(event) => {
          event.currentTarget.blur();
          showSettings = true;
        }}
      >
        <MaterialSymbolsSettingsRounded width="14" height="14" />
      </button>
      <button
        type="button"
        class={chip}
        aria-label={settings.muted
          ? "Unmute ambient sound"
          : "Mute ambient sound"}
        onclick={() => {
          audioEl?.pause();
          settings.muted = !settings.muted;
        }}
      >
        {#if settings.muted}
          <MaterialSymbolsVolumeOffRounded width="14" height="14" />
        {:else}
          <MaterialSymbolsVolumeUpRounded width="14" height="14" />
        {/if}
      </button>
    </div>
  </div>

  <!-- 548px ring gives a 382px inscribed square (0.7071 × (548 − 2×4px)); fixed so the 382px column does not clip it. -->
  <div
    class="fixed top-[calc(50%-21px)] left-1/2 w-[548px] max-w-[calc(100vw-1rem)] -translate-x-1/2 -translate-y-1/2"
  >
    <Circle>
      <div class="relative size-full overflow-hidden">
        <img
          src={IMAGES[mode]}
          alt=""
          class="absolute inset-0 z-10 h-full w-full object-cover"
        />
        {#if !isRunning}
          <div
            transition:fade={{ duration: 150 }}
            class="pointer-events-none absolute inset-0 z-30"
            style="box-shadow: inset -24px -18px 36px 0 rgba(0,0,0,0.8), inset 24px 18px 36px 0 rgba(0,0,0,0.9);"
          ></div>
        {/if}

        <!-- The clock is the play/pause control, like old vocabs1's timer button. -->
        <button
          type="button"
          class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-1 text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.6)] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          aria-label="{clock} remaining, {isRunning ? 'pause' : 'start'} timer"
          onclick={toggle}
        >
          <span class="text-[10px] font-medium tracking-[0.3em] uppercase">
            {isRunning ? "Pause" : "Play"}
          </span>
          <span
            class="text-[56px] leading-none font-light tracking-tight tabular-nums transition-opacity"
            style="opacity: {isRunning ? 1 : 0.8};"
          >
            {clock}
          </span>
        </button>
      </div>
    </Circle>

    <p
      class="absolute inset-x-0 top-full mt-3 text-center text-[11px] text-black"
    >
      Today {formatMinutes(todayTotal)} · All time {formatMinutes(totalMinutes)}
    </p>
  </div>

  {#if logError}
    <p role="alert" class="pb-3 text-center text-xs text-[#b42318]">
      {logError}
    </p>
  {/if}
</div>

<Modal bind:showModal={showReport} label="Pomodoro report">
  <div class={panel}>
    <div class={modalHeader}>
      <span class={modalTitle}>Report</span>
      <button
        type="button"
        aria-label="Close report"
        class={closeButton}
        onclick={() => (showReport = false)}
      >
        <TablerX width="20" height="20" />
      </button>
    </div>

    <div class="flex justify-between px-4 py-2 text-[11px] text-[#5f665c]">
      <span>Today {formatMinutes(todayTotal)}</span>
      <span>All time {formatMinutes(totalMinutes)}</span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4">
      <table class="w-full table-fixed text-xs">
        <thead>
          <tr
            class="h-7 border-b border-black/10 text-left font-normal text-[#5f665c]"
          >
            <th class="w-24">Date</th>
            <th>Time</th>
            <th class="w-12 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as row (row.date)}
            <tr class="h-7 border-b border-black/5">
              <td class="whitespace-nowrap tabular-nums">{row.date}</td>
              <td class="pr-2">
                <div
                  class="h-3.5 rounded-[2px] {row.date === today
                    ? 'bg-[#22c55e]'
                    : 'bg-[#22c55e]/30'}"
                  style="width: {barWidth(row.time)}%"
                ></div>
              </td>
              <td class="text-right tabular-nums">{formatMinutes(row.time)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="shrink-0 p-3">
      <Pagination
        totalItems={rows.length}
        itemsPerPage={perPage}
        currentPage={page}
        onPageChange={(next) => (page = next)}
      />
    </div>
  </div>
</Modal>

<Modal bind:showModal={showHeatmap} label="Focus heatmap">
  <div class={panel}>
    <div class={modalHeader}>
      <span class={modalTitle}>Heatmap</span>
      <button
        type="button"
        aria-label="Close heatmap"
        class={closeButton}
        onclick={() => (showHeatmap = false)}
      >
        <TablerX width="20" height="20" />
      </button>
    </div>
    <div class="min-h-0 flex-1">
      <Heatmap {rows} />
    </div>
  </div>
</Modal>

<Modal bind:showModal={showSettings} label="Timer settings">
  <div class={panel}>
    <div class={modalHeader}>
      <span class={modalTitle}>Settings</span>
      <button
        type="button"
        aria-label="Close settings"
        class={closeButton}
        onclick={closeSettings}
      >
        <TablerX width="20" height="20" />
      </button>
    </div>

    <div class="grid grid-cols-3 items-center gap-3 p-4 text-xs">
      <label for="set-focus" class="col-span-2">Focus (minutes)</label>
      <input
        id="set-focus"
        type="number"
        min="1"
        max="180"
        bind:value={settings.focus}
        class={input}
      />

      <label for="set-short" class="col-span-2">Short break (minutes)</label>
      <input
        id="set-short"
        type="number"
        min="1"
        max="180"
        bind:value={settings.shortbreak}
        class={input}
      />

      <label for="set-long" class="col-span-2">Long break (minutes)</label>
      <input
        id="set-long"
        type="number"
        min="1"
        max="180"
        bind:value={settings.longbreak}
        class={input}
      />

      <label for="set-intervals" class="col-span-2">Long break interval</label>
      <input
        id="set-intervals"
        type="number"
        min="1"
        max="12"
        bind:value={settings.intervals}
        class={input}
      />

      <button
        type="button"
        class="col-span-3 flex h-7 items-center justify-between rounded-[2px] px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-40 {wakeOn
          ? 'bg-[#22c55e]/20'
          : 'bg-black/5'}"
        aria-pressed={wakeOn}
        disabled={!wakeSupported}
        title={wakeSupported
          ? undefined
          : "The Screen Wake Lock API is not available in this browser."}
        onclick={toggleWakeLock}
      >
        <span>Keep screen awake</span>
        <span class="tabular-nums">{wakeOn ? "On" : "Off"}</span>
      </button>

      {#if wakeError}
        <p role="alert" class="col-span-3 text-[11px] text-[#b42318]">
          {wakeError}
        </p>
      {/if}
    </div>
  </div>
</Modal>
