<script lang="ts">
  import { onMount } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade } from "svelte/transition";
  import IconArrowLeft from "~icons/ph/arrow-left";
  import IconArrowRight from "~icons/ph/arrow-right";
  import IconSpinner from "~icons/svg-spinners/ring-resize";
  import Toaster from "#lib/components/Toaster.svelte";
  import { art, nextArt, prevArt, showArt } from "#lib/art.svelte.ts";

  const NAV =
    "flex size-[44px] cursor-pointer items-center justify-center rounded-full border border-white/10 bg-slate-950/55 text-white/75 backdrop-blur-md transition-colors hover:bg-slate-900/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-35";

  const KBD =
    "rounded-[4px] border border-white/15 bg-white/5 px-[6px] py-[2px] font-sans text-[10px] text-slate-300";

  /** A crossfade, unless the reader asked for less motion. */
  const fadeMs = $derived(prefersReducedMotion.current ? 0 : 420);

  // Client-only: module state is shared in SSR and must not be reset per request.
  onMount(showArt);

  function onKeyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    ) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextArt();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevArt();
    }
  }
</script>

<svelte:head>
  <title>{art.image.title} art</title>
  <meta
    name="description"
    content="A painting a day from DailyArt, with the magazine's notes on the artist and the work."
  />
</svelte:head>

<svelte:window onkeydown={onKeyDown} />

<div
  class="relative flex h-[calc(100vh-42px)] w-full flex-col items-center gap-0! lg:flex-row lg:items-stretch"
>
  <!-- The wall: the painting lit by a blurred copy of itself. -->
  <section
    class="relative isolate flex min-h-full w-full shrink-0 items-center justify-center overflow-hidden bg-[#19191c] lg:h-full lg:flex-1"
  >
    {#key art.image.mainImage}
      <img
        src={art.image.mainImage}
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-35 blur-3xl"
        transition:fade={{ duration: fadeMs }}
      />
    {/key}

    {#key art.image.mainImage}
      <div
        class="absolute inset-0 z-10 flex items-center justify-center px-[16px] pt-[56px] pb-[32px] sm:px-[32px] sm:pt-[80px] lg:px-[64px] lg:py-[80px]"
        transition:fade={{ duration: fadeMs }}
      >
        <img
          src={art.image.mainImage}
          alt={art.image.title}
          fetchpriority="high"
          decoding="async"
          class="max-h-full max-w-full object-contain shadow-[0_35px_90px_-25px_rgba(0,0,0,0.95)] ring-1 ring-white/15"
        />
      </div>
    {/key}

    <div
      class="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-end gap-[12px] p-[16px] sm:p-[20px]"
    >
      <div class="pointer-events-auto flex gap-[8px]">
        <button
          type="button"
          class={NAV}
          aria-label="Previous painting"
          disabled={!art.hasPrevious}
          onclick={prevArt}
        >
          <IconArrowLeft class="size-[16px]" aria-hidden="true" />
        </button>

        <button
          type="button"
          class={NAV}
          aria-label="Next painting"
          aria-busy={art.loading}
          disabled={art.loading}
          onclick={nextArt}
        >
          {#if art.loading}
            <IconSpinner class="size-[16px] animate-spin" aria-hidden="true" />
          {:else}
            <IconArrowRight class="size-[16px]" aria-hidden="true" />
          {/if}
        </button>
      </div>
    </div>
  </section>

  <!-- The wall label: date, title, attribution, then the magazine's note. -->
  <aside
    class="relative z-20 -mt-[24px] flex w-full shrink-0 flex-col rounded-t-[28px] border-t border-white/10 bg-[#19191c] lg:mt-0 lg:h-full lg:w-[360px] lg:rounded-none lg:border-t-0 lg:border-l"
  >
    <div
      class="mx-auto mt-[10px] h-[4px] w-[40px] shrink-0 rounded-full bg-white/15 lg:hidden"
    ></div>

    <div
      class="no-scrollbar flex flex-col gap-[3px] px-[9px] pt-[9px] pb-[18px] sm:px-[32px] lg:min-h-0 lg:flex-1 lg:gap-[24px] lg:overflow-y-auto lg:px-[32px] lg:pt-[36px] lg:pb-[24px]"
    >
      <header>
        <p
          class="text-[10px] font-semibold tracking-[0.22em] text-emerald-300/80 uppercase"
        >
          {art.image.shareDate}
        </p>
        <h1
          class="mt-[12px] font-roslindale text-[clamp(1.75rem,5.5vw,2.4rem)] leading-[1.05] tracking-[-0.01em] text-white"
        >
          {art.image.title}
        </h1>
        <p class="mt-[8px] text-[14px] leading-[24px] text-slate-400">
          {art.image.attr}
        </p>
      </header>

      <div class="flex items-center gap-[6px]">
        <img
          src={art.image.authorImage}
          alt=""
          class="size-[48px] shrink-0 rounded-full object-cover ring-1 ring-white/15"
        />
        <div class="min-w-0">
          <p class="truncate text-[14px] font-medium text-white">
            {art.image.author}
          </p>
          <p class="mt-[2px] text-[12px] text-slate-400">
            {art.image.authorYears}
          </p>
        </div>
      </div>

      <div
        class="font-sans space-y-[4px] text-[14px] leading-[20px] text-slate-300 *:indent-[36px]"
      >
        {#each art.image.content as paragraph, index (index)}
          <p>{paragraph}</p>
        {/each}
      </div>

      <p class="text-[11px] text-slate-500 lg:hidden">
        Painting and notes from DailyArt Magazine.
      </p>
    </div>

    <footer
      class="hidden shrink-0 items-center justify-between border-t border-white/10 px-[32px] py-[16px] text-[11px] text-slate-500 lg:flex"
    >
      <span>DailyArt Magazine</span>
      <span class="flex items-center gap-[6px]">
        <kbd class={KBD}>←</kbd>
        <kbd class={KBD}>→</kbd>
        <span class="ml-[4px]">browse</span>
      </span>
    </footer>
  </aside>
</div>

<p class="sr-only" aria-live="polite">
  {art.loading ? "Fetching the next painting" : art.image.title}
</p>

<Toaster />
