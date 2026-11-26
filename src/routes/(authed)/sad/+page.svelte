<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import IconPlus from "~icons/ph/plus";
  import IconSmileySad from "~icons/ph/smiley-sad";
  import IconTrash from "~icons/ph/trash";
  import Pagination from "#lib/components/Pagination.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const PAGE_SIZE = 15;

  function localStamp(createdAt: string): { date: string; time: string } {
    const at = new Date(createdAt);
    if (Number.isNaN(at.getTime())) return { date: "", time: "" };

    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(at);
    const part = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";

    return {
      date: `${part("year")}-${part("month")}-${part("day")}`,
      time: `${part("hour")}:${part("minute")} ${part("dayPeriod")}`,
    };
  }

  // The server can only render a UTC fallback; replace it after hydration.
  let localTime = $state(false);
  onMount(() => {
    localTime = true;
  });
  const rows = $derived(
    localTime
      ? data.rows.map((row) => ({ ...row, ...localStamp(row.created_at) }))
      : data.rows,
  );

  const errorMsg = $derived(form?.error ?? "");
  const shown = $derived(
    data.total === 0
      ? "No days marked"
      : `${data.offset + 1}–${data.offset + data.rows.length} of ${data.total} days`,
  );

  const deleteBtn =
    "inline-flex size-[28px] shrink-0 items-center justify-center rounded-[2px] text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]";
</script>

<svelte:head>
  <title>Sad days</title>
</svelte:head>

<div class="mx-auto flex h-full w-full max-w-[382px] flex-col gap-[3px] px-0 py-[3px]">
  <header class="px-3 pt-4 pb-2 text-center">
    <h1 class="font-roslindale text-[28px] leading-tight text-white">
      Sad <em class="text-white/65">days</em>
    </h1>
    <p class="mt-1 font-sans text-[11px] tracking-[0.08em] text-white/55 uppercase tabular-nums">
      {shown}
    </p>
  </header>

  <section
    class="dark flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2px] border border-white/10"
    aria-label="Sad days"
  >
    <form
      method="POST"
      action="?/add"
      use:enhance
      class="border-b border-white/10 p-2"
    >
      <button
        type="submit"
        class="flex w-full items-center gap-2 rounded-[2px] border border-white/10 bg-white/5 px-2 py-2 text-left transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]"
      >
        <span
          class="flex size-[28px] shrink-0 items-center justify-center rounded-[2px] bg-emerald-600/90 text-white"
        >
          <IconPlus class="size-[14px]" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-sans text-[12px] font-semibold text-white">Mark today</span>
          <span class="block font-sans text-[10px] leading-tight text-white/55">
            Log the moment you are in
          </span>
        </span>
      </button>
    </form>

    {#if errorMsg}
      <p role="alert" class="px-3 py-2 font-sans text-[11px] text-red-300">
        {errorMsg}
      </p>
    {/if}

    {#if data.rows.length === 0}
      <div class="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <IconSmileySad class="size-[24px] text-white/35" aria-hidden="true" />
        <p class="font-roslindale text-[15px] text-white/55 italic">No sad days marked yet.</p>
      </div>
    {:else}
      <div
        class="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-2 border-b border-white/10 px-3 py-2"
      >
        <span class="font-sans text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase">
          Date
        </span>
        <span class="font-sans text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase">
          Time
        </span>
        <span class="sr-only">Delete</span>
      </div>

      <ol class="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {#each rows as row (row.created_at)}
          <li
            class="grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-2 border-b border-white/8 px-3 py-[3px] transition-colors hover:bg-white/4 last:border-b-0"
          >
            <span class="font-sans text-[12px] text-white tabular-nums">{row.date}</span>
            <span class="font-sans text-[11px] text-white/55 tabular-nums">{row.time}</span>

            <form method="POST" action="?/delete" use:enhance>
              <input type="hidden" name="created_at" value={row.created_at} />
              <button
                type="submit"
                class={deleteBtn}
                aria-label="Delete {row.date}, {row.time}"
                title="Delete {row.date}"
              >
                <IconTrash class="size-[14px]" aria-hidden="true" />
              </button>
            </form>
          </li>
        {/each}
      </ol>
    {/if}

    {#if data.pageCount > 1}
      <div class="shrink-0 border-t border-white/10 px-2 py-2">
        <Pagination
          totalItems={data.total}
          itemsPerPage={PAGE_SIZE}
          currentPage={data.page}
          onPageChange={(p) => {
            const url = new URL(page.url.href);
            url.searchParams.set("page", String(p));
            goto(url, { reset: false });
          }}
        />
      </div>
    {/if}
  </section>
</div>
