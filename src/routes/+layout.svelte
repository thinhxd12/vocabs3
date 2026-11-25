<script lang="ts">
  import "./layout.css";
  import { afterNavigate, invalidate } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import WeatherTile from "#lib/components/WeatherTile.svelte";
  import { reviewProgress } from "#lib/review-progress.svelte.ts";
  import { glassButton } from "#lib/styles.ts";
  import {
    countdown,
    QUICK_TIMER_MINUTES,
    startCountdown,
    stopCountdown,
  } from "#lib/countdown.svelte.ts";
  import RiAlarmLine from "~icons/ri/alarm-line";
  import HomeIcon from '~icons/mdi/home';
  import MajesticonsUnlockOpenLine from "~icons/majesticons/unlock-open-line";
  import MaterialSymbolsAdjust from "~icons/material-symbols/adjust";
  import MaterialSymbolsDashboardRounded from "~icons/material-symbols/dashboard-rounded";
  import SimpleIconsAnki from "~icons/simple-icons/anki";
  import BxsBookBookmark from "~icons/bxs/book-bookmark";
  import GravityUiFrames from "~icons/gravity-ui/frames";
  import SolarSadSquareOutline from "~icons/solar/sad-square-outline";
  import StreamlinePlumpFeatherPenSolid from "~icons/streamline-plump/feather-pen-solid";
  import TablerCircleLetterRFilled from "~icons/tabler/circle-letter-r-filled";
  import IconArrowCounterClockwise from "~icons/ph/arrow-counter-clockwise";
  import IconSpinner from "~icons/svg-spinners/ring-resize";
  import type { LayoutProps } from "./$types";

  let { children, data }: LayoutProps = $props();

  let scroller: HTMLDivElement | undefined;
  let lastPath = "";

  // The frame scrolls, not the window, so Kit cannot reset this on navigation.
  afterNavigate(() => {
    if (page.url.pathname !== lastPath) {
      lastPath = page.url.pathname;
      if (scroller) scroller.scrollTop = 0;
      if (scroller) scroller.scrollLeft = 0;
    }
  });

  let midnightTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleMidnightRefresh() {
    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    midnightTimer = setTimeout(() => {
      void invalidate("app:fsrs-completions");
      scheduleMidnightRefresh();
    }, midnight.getTime() - now.getTime());
  }

  $effect(() => {
    void invalidate("app:fsrs-completions");
    scheduleMidnightRefresh();
    return () => clearTimeout(midnightTimer);
  });

  // Two dock rows: the first three sit above the timer, the rest beside logout.
  const links = [
    { href: "/", label: "Home", icon: HomeIcon },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: MaterialSymbolsDashboardRounded,
    },
    { href: "/pomodoro", label: "Pomodoro", icon: MaterialSymbolsAdjust },
    { href: "/highlights", label: "Highlights", icon: BxsBookBookmark },
    { href: "/art", label: "Art", icon: GravityUiFrames },
    { href: "/sad", label: "Sad days", icon: SolarSadSquareOutline },
    { href: "/fsrs", label: "FSRS", icon: SimpleIconsAnki },
    { href: "/diary", label: "Diary", icon: StreamlinePlumpFeatherPenSolid },
  ];
  type NavLink = (typeof links)[number];

  const isHighlights = $derived(page.url.pathname === "/highlights");
  const isFsrs = $derived(page.url.pathname === "/fsrs");
  const isArt = $derived(page.url.pathname === "/art");
  const isLogin = $derived(page.url.pathname === "/login");
  const countdownClock = $derived(
    `${String(Math.floor(countdown.secondsRemaining / 60)).padStart(2, "0")}:${String(countdown.secondsRemaining % 60).padStart(2, "0")}`,
  );
  const countdownLabel = $derived(
    countdown.endAt
      ? `${countdownClock} left. Stop the ${QUICK_TIMER_MINUTES} minute timer`
      : `Start a ${QUICK_TIMER_MINUTES} minute timer`,
  );
  // Two lines like the old memories tile: hundreds above, the last two digits below.
  const wordLines = $derived([
    String(Math.floor(data.totalWords / 100)).padStart(2, "0"),
    String(data.totalWords % 100).padStart(2, "0"),
  ]);
  const reviewPercent = $derived(
    reviewProgress.total === 0
      ? 0
      : Math.min(100, (reviewProgress.learned / reviewProgress.total) * 100),
  );

  // '/' would prefix-match every route, so it is compared exactly.
  const isActive = (href: string) =>
    href === "/"
      ? page.url.pathname === "/"
      : page.url.pathname.startsWith(href);

  const DEFAULT_WALLPAPER = {
    url: "/images/AshoptonViaduct.jpg",
    title:
      "Ashopton Viaduct towards Derwent, Ladybower Reservoir, Derbyshire, England, UK",
    place: "2022-11-29",
  };

  /** The wallpaper and its two-line credit, swapped by the corner buttons. */
  let wallpaper = $state({ ...DEFAULT_WALLPAPER });
  const isDefaultWallpaper = $derived(wallpaper.url === DEFAULT_WALLPAPER.url);
  let shifting = $state(false);
  let started = false;
  let nextSpotlight: string | null = null;

  const backgroundButton = `${glassButton} size-[18px] bg-white/15 text-[#11130f] hover:bg-white/30`;

  async function shiftBackground() {
    if (shifting) return;
    shifting = true;

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const endpoint =
          started && nextSpotlight
            ? `/api/spotlight?page=${encodeURIComponent(nextSpotlight)}`
            : "/api/spotlight?start";
        const response = await fetch(endpoint);
        started = true;

        if (!response.ok) return;

        const next = (await response.json()) as {
          image: typeof wallpaper;
          next: string | null;
        };
        nextSpotlight = next.next;
        if (!next.image.url || next.image.url === DEFAULT_WALLPAPER.url)
          continue;

        // Decode before painting: a full-screen swap otherwise flashes the old one.
        const image = new Image();
        image.src = next.image.url;
        await image.decode();

        wallpaper = next.image;
        localStorage.setItem("wallpaper", JSON.stringify(next.image));
        return;
      }
    } catch {
      // A bad scrape or an offline decode leaves the current wallpaper up.
    } finally {
      shifting = false;
    }
  }

  /** Back to the bundled Ashopton shot, and the stored choice goes with it. */
  function resetBackground() {
    wallpaper = { ...DEFAULT_WALLPAPER };
    try {
      localStorage.removeItem("wallpaper");
    } catch {
      // Storage blocked: the default still stands for this visit.
    }
  }

  // The wallpaper chosen last time; read after hydration so SSR stays stable.
  onMount(() => {
    try {
      const saved = localStorage.getItem("wallpaper");
      if (!saved) return;
      const next = JSON.parse(saved) as typeof wallpaper;
      if (next?.url) wallpaper = next;
    } catch {
      // Storage can be blocked or hold an older value; the default stands.
    }
  });
</script>

<svelte:head>
  <link rel="icon" href="/images/2617511.png" />
  <link rel="stylesheet" href="/fonts/fonts.css" />
</svelte:head>

{#snippet navLink(link: NavLink)}
  {@const Icon = link.icon}
  <a
    href={link.href}
    title={link.label}
    aria-label={link.label}
    aria-current={isActive(link.href) ? "page" : undefined}
    class="flex h-full w-[22px] shrink-0 items-center justify-center text-white opacity-50 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white {isActive(
      link.href,
    )
      ? 'opacity-100'
      : ''}"
  >
    <Icon class="size-[14px]" aria-hidden="true" />
  </a>
{/snippet}

<div
  class="relative flex min-h-dvh justify-center overflow-hidden bg-slate-950"
>
  <img
    src={wallpaper.url}
    alt=""
    aria-hidden="true"
    fetchpriority="high"
    decoding="async"
    class="pointer-events-none fixed inset-0 h-full w-full object-cover select-none {isLogin
      ? 'blur-[6px] scale-[1.08]'
      : ''}"
  />

  {#if !isArt && !isLogin}
    <div
      class="pointer-events-none fixed top-0 left-0.75 z-20 hidden max-w-1/3 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_2px_10px_rgba(0,0,0,0.6)] md:block"
    >
      <p class="text-[11.5px] leading-snug font-medium">{wallpaper.title}</p>
      <p class="truncate text-[10px] text-white/80">{wallpaper.place}</p>
    </div>

    <div
      class="fixed top-[3px] right-[3px] z-20 hidden items-center gap-[3px] md:flex"
    >
      <button
        type="button"
        onclick={shiftBackground}
        disabled={shifting}
        aria-label="Change background"
        title="Change background"
        class={backgroundButton}
      >
        {#if shifting}
          <IconSpinner
            class="size-[14px] animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        {:else}
          <TablerCircleLetterRFilled class="size-[14px]" aria-hidden="true" />
        {/if}
      </button>
      {#if !isDefaultWallpaper}
        <button
          type="button"
          onclick={resetBackground}
          aria-label="Reset background"
          title="Default background"
          class={backgroundButton}
        >
          <IconArrowCounterClockwise class="size-[14px]" aria-hidden="true" />
        </button>
      {/if}
    </div>
  {/if}

  <div
    class="relative z-10 flex h-dvh w-full {isHighlights || isArt
      ? 'max-w-none'
      : 'max-w-[382px]'} flex-col overflow-hidden outline-none"
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (axe scrollable-region-focusable: keyboard scrolling) -->
    <div
      bind:this={scroller}
      tabindex="0"
      class="min-h-0 flex-1 {isHighlights || isArt
        ? 'overflow-hidden'
        : 'overflow-x-hidden overflow-y-auto'} {[
        '/dashboard',
        '/calendar',
        '/weather',
        '/sad',
        '/diary',
      ].includes(page.url.pathname)
        ? 'no-scrollbar'
        : ''}"
    >
      {@render children()}
    </div>

    {#if !isLogin}
    <div
      class="dark shrink-0 border-t border-white/10 mx-auto w-full max-w-[382px]"
    >
      <nav aria-label="Main" class="mx-auto flex h-[42px] w-[381px] max-w-full">
        <div
          role="status"
          title={`${data.completedBatches} FSRS batches completed today`}
          class="relative flex h-full shrink-0 flex-col items-center justify-center leading-none"
        >
          <span
            class="w-full h-[28px] w-[16px] bg-black text-center text-[10px] leading-[28px] font-semibold tabular-nums text-white"
          >
            {data.completedBatches}
          </span>
          <span
            class="light h-[14px] w-[16px] text-center text-[8px] leading-[14px] font-bold tracking-[0.08em] text-black"
          >
            {data.weekday}
          </span>
          {#if page.url.pathname !== "/login"}
            <a
              href="/calendar"
              aria-label={`View calendar, ${data.completedBatches} FSRS batches completed today, ${data.weekday}`}
              aria-current={page.url.pathname === "/calendar"
                ? "page"
                : undefined}
              class="absolute inset-0 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
            ></a>
          {/if}
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
          <div
            class="flex min-h-0 flex-1 items-center justify-center gap-[2px]"
          >
            {#each links.slice(0, 3) as link (link.href)}
              {@render navLink(link)}
            {/each}
            {#if page.url.pathname !== "/login"}
              <button
                type="button"
                onclick={countdown.endAt ? stopCountdown : startCountdown}
                title={countdownLabel}
                aria-label={countdownLabel}
                class="flex h-full cursor-pointer shrink-0 items-center justify-center tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white {countdown.endAt
                  ? 'min-w-[40px] rounded-[2px] bg-black px-[3px] text-[10px] leading-none font-normal text-white'
                  : 'w-[22px] text-white opacity-50 hover:opacity-100'}"
              >
                {#if countdown.endAt}
                  <span aria-hidden="true">{countdownClock}</span>
                {:else}
                  <RiAlarmLine class="size-[14px]" aria-hidden="true" />
                {/if}
              </button>
            {/if}
          </div>

          <div
            class="flex min-h-0 flex-1 items-center justify-center gap-[2px]"
          >
            {#each links.slice(3) as link (link.href)}
              {@render navLink(link)}
            {/each}

            <form method="POST" action="/logout" class="contents">
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                class="flex h-full w-[22px] shrink-0 cursor-pointer items-center justify-center text-white opacity-50 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
              >
                <MajesticonsUnlockOpenLine
                  class="size-[14px]"
                  aria-hidden="true"
                />
              </button>
            </form>
          </div>
        </div>

        <!-- Total FSRS words, the old dock's two-line readout. A readout, not a link. -->
        <div
          title="{data.totalWords} FSRS words"
          class="flex px-[2px] rounded-[2px] shrink-0 flex-col overflow-hidden border border-white/10 bg-black/80 font-tupa font-semibold text-white"
        >
          <span class="sr-only">{data.totalWords} FSRS words</span>
          <span
            class="flex min-h-0 flex-1 text-[18px] leading-[21px] items-center justify-center"
            aria-hidden="true"
          >
            {wordLines[0]}
          </span>
          <span
            class="flex min-h-0 flex-1 text-[18px] leading-[20px] items-center justify-center"
            aria-hidden="true"
          >
            {wordLines[1]}
          </span>
        </div>

        {#if page.url.pathname !== "/login"}
          <WeatherTile />
        {/if}

        <!-- Sunrise tile: grey at rest, coloured from the left as /fsrs advances. -->
        <div
          class="relative h-full w-[90px] shrink-0 overflow-hidden border-l border-white/10 bg-slate-900"
        >
          {#if isFsrs}
            <img
              src="/images/sunrise.webp"
              alt=""
              aria-hidden="true"
              class="absolute inset-0 size-full object-cover object-left grayscale"
            />
            <div
              role="progressbar"
              aria-label="FSRS batch progress"
              aria-valuemin="0"
              aria-valuemax={reviewProgress.total}
              aria-valuenow={reviewProgress.learned}
              aria-valuetext="{reviewProgress.learned} of {reviewProgress.total} cards reviewed"
              class="absolute inset-0"
            >
              {#if reviewPercent > 0}
                <img
                  src="/images/sunrise.webp"
                  alt=""
                  aria-hidden="true"
                  class="absolute top-0 left-0 h-full object-cover object-left transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style="box-shadow: rgba(0, 0, 0, 0.8) 1px 0px 2px; width: {reviewPercent}%"
                />
              {/if}
            </div>
          {:else}
            <img
              src="/images/sunset.webp"
              alt=""
              aria-hidden="true"
              class="absolute inset-0 size-full object-cover object-left"
            />
          {/if}
        </div>
      </nav>
    </div>
    {/if}
  </div>
</div>
