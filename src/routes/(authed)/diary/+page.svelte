<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  // date-fns not installed; use Intl for formatting.
  import { onMount } from "svelte";
  // no reactive Set needed; derived Set is recreated from data.
  import IconCaretDoubleLeft from "~icons/ph/caret-double-left";
  import IconCaretDoubleRight from "~icons/ph/caret-double-right";
  import IconCaretLeft from "~icons/ph/caret-left";
  import IconCaretRight from "~icons/ph/caret-right";
  import IconFloppyDisk from "~icons/ph/floppy-disk";
  import IconTrash from "~icons/ph/trash";
  import IconX from "~icons/ph/x";
  import Modal from "#lib/components/Modal.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const MONTH_IMAGES = Array.from(
    { length: 12 },
    (_, i) => `/images/${i + 1}.webp`,
  );
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const WEEKDAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function isoLocal(value: Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatLong(year: number, month: number, day: number) {
    const at = new Date(year, month, day);
    return `${WEEKDAY_NAMES[at.getDay()]}, ${MONTH_NAMES[month]} ${day}, ${year}`;
  }

  let busy = $state(false);
  let flash = $state("");
  let editing = $state(false);
  let confirmDelete = $state(false);
  let clientToday = $state<string | null>(null);
  let browsed = $state<{ year: number; month: number; from: string } | null>(
    null,
  );

  const todayLocal = $derived(clientToday ?? data.today);
  const errorMsg = $derived(form?.error ?? "");
  const hasEntry = $derived(data.entry !== null);
  const draft = $derived(data.entry?.text ?? "");

  onMount(() => {
    clientToday = isoLocal(new Date());
    if (data.isDefault && clientToday !== data.date) {
      void goto(`?date=${clientToday}`, { replaceState: true });
    }
  });

  function monthOf(iso: string) {
    const [year, month] = iso.split("-").map(Number);
    return { year, month: month - 1 };
  }

  const view = $derived.by(() => {
    if (browsed && browsed.from === data.date)
      return { year: browsed.year, month: browsed.month };
    return monthOf(data.date);
  });

  const todayMonth = $derived(monthOf(todayLocal));

  function browseTo(next: Date) {
    const ahead =
      next.getFullYear() > todayMonth.year ||
      (next.getFullYear() === todayMonth.year &&
        next.getMonth() > todayMonth.month);
    const at = ahead ? new Date(todayMonth.year, todayMonth.month, 1) : next;
    browsed = { from: data.date, year: at.getFullYear(), month: at.getMonth() };
  }

  const canStepForward = $derived(
    view.year < todayMonth.year ||
      (view.year === todayMonth.year && view.month < todayMonth.month),
  );
  const canStepYearForward = $derived(view.year < todayMonth.year);
  const isCurrentMonth = $derived(
    view.year === todayMonth.year && view.month === todayMonth.month,
  );
  const monthLabel = $derived(`${MONTH_NAMES[view.month]} ${view.year}`);
  const image = $derived(MONTH_IMAGES[view.month]);

  const plate = $derived.by(() => {
    const [year, month, selected] = data.date.split("-").map(Number);
    const inView = year === view.year && month - 1 === view.month;
    const lastDay = new Date(view.year, view.month + 1, 0).getDate();
    const day = inView
      ? selected
      : Math.min(Number(todayLocal.slice(8, 10)), lastDay);
    return {
      day,
      weekday: WEEKDAY_NAMES[new Date(view.year, view.month, day).getDay()],
    };
  });

  const entrySet = $derived(new Set(data.dates));
  const entryCount = $derived(
    data.dates.filter((day) => {
      const at = monthOf(day);
      return at.year === view.year && at.month === view.month;
    }).length,
  );

  type DayCell = { day: number; year: number; month: number; inMonth: boolean };

  const weeks = $derived.by(() => {
    const { year, month } = view;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = prevMonth === 11 ? year - 1 : year;
    const nextMonth = (month + 1) % 12;
    const nextYear = month === 11 ? year + 1 : year;
    const cells: DayCell[] = [];

    for (let i = daysInPrev - firstDay; i < daysInPrev; i++) {
      cells.push({ day: i + 1, year: prevYear, month: prevMonth, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, year, month, inMonth: true });
    }
    for (let day = 1; cells.length % 7; day++) {
      cells.push({ day, year: nextYear, month: nextMonth, inMonth: false });
    }

    const rows: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  });

  function isoOf(cell: DayCell) {
    return `${cell.year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
  }

  function dayLabel(cell: DayCell, marked: boolean) {
    const label = formatLong(cell.year, cell.month, cell.day);
    return marked ? `${label}, has an entry` : label;
  }

  function dayClass(_key: string, _selected: boolean, sunday: boolean) {
    return sunday ? "text-[#ff3333]" : "text-white";
  }

  async function openDay(key: string) {
    flash = "";
    confirmDelete = false;
    if (key !== data.date) {
      try {
        await goto(`?date=${key}`);
      } catch {
        return;
      }
    }
    editing = true;
  }

  function goToday() {
    browsed = null;
    if (data.date !== todayLocal) void goto(`?date=${todayLocal}`);
  }

  function closeModal() {
    editing = false;
    flash = "";
    confirmDelete = false;
  }

  const dateLabel = $derived.by(() => {
    if (!ISO_DATE.test(data.date)) return data.date;
    const [year, month, day] = data.date.split("-").map(Number);
    return `${WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()]}, ${data.date}`;
  });

  const NAV =
    "inline-flex size-8 touch-manipulation items-center justify-center rounded-[2px] border border-white/15 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
  const ACTION =
    "inline-flex h-[30px] shrink-0 touch-manipulation items-center gap-1.5 rounded-[2px] px-3 text-xs font-semibold transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-50";
  const SAVE = `${ACTION} bg-[#11130f] text-white ring-1 ring-white/25 hover:bg-[#2b2f28]`;
  const DELETE_BTN =
    "inline-flex h-[30px] shrink-0 touch-manipulation items-center gap-1.5 rounded-[2px] border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-50";
</script>

<svelte:head>
  <title>Diary</title>
</svelte:head>

<div class="mx-auto w-full max-w-[382px]">
  <div
    class="calendar overflow-hidden rounded-[2px] border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
  >
    <div class="relative aspect-3/2 w-full">
      <img
        src={image}
        alt=""
        aria-hidden="true"
        decoding="async"
        class="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
      />
      <div class="absolute inset-0 bg-black/15" aria-hidden="true"></div>

      <div
        class="absolute top-1/2 left-2 z-10 flex -translate-y-1/2 items-center gap-1"
      >
        <button
          type="button"
          onclick={() => browseTo(new Date(view.year - 1, view.month, 1))}
          aria-label="Previous year"
          title="Previous year"
          class={NAV}
        >
          <IconCaretDoubleLeft class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onclick={() => browseTo(new Date(view.year, view.month - 1, 1))}
          aria-label="Previous month"
          title="Previous month"
          class={NAV}
        >
          <IconCaretLeft class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div
        class="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center gap-1"
      >
        <button
          type="button"
          onclick={() => browseTo(new Date(view.year, view.month + 1, 1))}
          disabled={!canStepForward}
          aria-label="Next month"
          title="Next month"
          class={NAV}
        >
          <IconCaretRight class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onclick={() => browseTo(new Date(view.year + 1, view.month, 1))}
          disabled={!canStepYearForward}
          aria-label="Next year"
          title="Next year"
          class={NAV}
        >
          <IconCaretDoubleRight class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div
        class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.65)]"
      >
        <div class="flex min-w-0 items-end gap-3">
          <span
            class="font-roslindale text-5xl leading-none font-light text-white tabular-nums sm:text-6xl"
          >
            {plate.day}
          </span>
          <div class="min-w-0 pb-1">
            <p
              class="truncate font-garamond text-lg font-light text-white sm:text-xl"
            >
              {plate.weekday}
            </p>
            <p
              class="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-white/85"
            >
              {monthLabel}
              <span class="inline-flex shrink-0 items-center gap-1">
                <span
                  class="size-1.5 rounded-full bg-emerald-400"
                  aria-hidden="true"
                ></span>
                {entryCount}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick={goToday}
          disabled={isCurrentMonth && data.date === todayLocal}
          class="shrink-0 touch-manipulation rounded-[2px] border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          Today
        </button>
      </div>
    </div>

    <div class="px-2 pt-1.5 pb-2 sm:px-2.5">
      <table
        class="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-1"
      >
        <caption class="sr-only">
          {monthLabel}, {entryCount}
          {entryCount === 1 ? "entry" : "entries"}
        </caption>
        <thead>
          <tr>
            {#each WEEKDAYS as weekday, index (weekday)}
              <th
                scope="col"
                class="border-b border-white/10 pb-1 font-sans text-[10px] font-medium tracking-[0.08em] uppercase {index ===
                0
                  ? 'text-red-400'
                  : 'text-white/60'}"
              >
                {weekday}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each weeks as week, weekIndex (weekIndex)}
            <tr>
              {#each week as cell, dayIndex (dayIndex)}
                {@const key = isoOf(cell)}
                {@const marked = entrySet.has(key)}
                {@const future = key > todayLocal}
                {@const sunday = dayIndex === 0}
                <td class="p-0 text-center">
                  <button
                    type="button"
                    onclick={() => openDay(key)}
                    disabled={future}
                    aria-current={key === todayLocal ? "date" : undefined}
                    aria-label={dayLabel(cell, marked)}
                    class="relative mx-auto flex h-7 w-full max-w-[50px] touch-manipulation items-center justify-center font-sans text-xs tabular-nums transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none {marked ? 'cursor-pointer' : ''} {!future && !cell.inMonth ? 'opacity-30' : ''} {dayClass(key, false, sunday)}"
                  >
                    {cell.day}
                    {#if marked}
                      <span
                        class="absolute top-0 right-3 text-[8px] leading-[8px] font-semibold {sunday ? 'text-[#ff3333]' : 'text-[#38e07b]'}"
                        aria-hidden="true">•</span
                      >
                    {/if}
                    {#if key === todayLocal}
                      <span
                        class="absolute bottom-[2px] left-1/2 h-[2px] w-[18px] -translate-x-1/2 rounded-full {sunday ? 'bg-[#ff3333]' : 'bg-[#38e07b]'}"
                        aria-hidden="true"
                      ></span>
                    {/if}
                  </button>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<Modal bind:showModal={editing} label="Diary entry">
  <div
    class="flex h-[calc(100vh-42px)] min-h-0 w-full min-w-[382px] flex-col overflow-hidden bg-[#fffef9] text-[#333] shadow-2xl"
  >
    <div
      class="flex min-h-11 shrink-0 items-center justify-between gap-2 bg-black px-4 py-2 text-white"
    >
      <div class="min-w-0">
        <p class="truncate text-base font-semibold leading-tight">
          {dateLabel}
        </p>
        <p class="text-[11px]">
          {hasEntry ? "Saved entry" : "New entry"}
        </p>
      </div>
      <button
        type="button"
        onclick={closeModal}
        aria-label="Close the entry"
        class="flex size-8 shrink-0 items-center justify-center rounded-[2px] text-[#333]/60 transition-colors hover:bg-black/5 hover:text-[#333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]"
      >
        <IconX class="size-4" aria-hidden="true" />
      </button>
    </div>

    <form
      method="POST"
      use:enhance={() => {
        busy = true;
        flash = "";
        return async ({ result, update }) => {
          await update({ reset: false, invalidateAll: true });
          busy = false;
          confirmDelete = false;
          if (result.type === "success") {
            const scope = (result.data as { scope?: string } | undefined)
              ?.scope;
            flash = scope === "delete" ? "Entry deleted" : "Entry saved";
          }
        };
      }}
      aria-busy={busy}
      class="flex min-h-0 flex-1 flex-col"
    >
      <input type="hidden" name="date" value={data.date} />

      <label for="diary-text" class="sr-only">Diary entry for {dateLabel}</label
      >
      <textarea
        id="diary-text"
        name="text"
        value={draft}
        placeholder="What happened today?"
        aria-invalid={errorMsg ? "true" : undefined}
        aria-describedby={errorMsg ? "diary-status" : undefined}
        class="bg-[#fffef9] block min-h-0 w-full flex-1 resize-none px-4 py-4 font-sans text-sm leading-7 text-[#333] outline-none placeholder:text-[#333]/35"
      ></textarea>

      <div
        class="flex flex-wrap items-center gap-[3px] border-t border-[#e0ddd5] bg-[#f7f5ef] p-[3px]"
      >
        <button type="submit" formaction="?/save" disabled={busy} class={SAVE}>
          <IconFloppyDisk class="size-3.5" aria-hidden="true" />
          Save
        </button>
        {#if confirmDelete}
          <span class="text-[11px] font-medium text-red-700">Delete this entry?</span>
          <button
            type="submit"
            formaction="?/delete"
            formnovalidate
            disabled={!hasEntry || busy}
            class={DELETE_BTN}
          >
            Confirm
          </button>
          <button
            type="button"
            onclick={() => (confirmDelete = false)}
            disabled={busy}
            class="inline-flex h-9 shrink-0 items-center rounded-[2px] px-2 text-xs font-medium text-[#333]/70 transition-colors hover:bg-black/5 hover:text-[#333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        {:else}
          <button
            type="button"
            onclick={() => (confirmDelete = true)}
            disabled={!hasEntry || busy}
            class={DELETE_BTN}
          >
            <IconTrash class="size-3.5" aria-hidden="true" />
            Delete
          </button>
        {/if}

        <span
          id="diary-status"
          aria-live="polite"
          class="ml-auto min-w-0 truncate text-[11px] font-medium {errorMsg
            ? 'text-red-600'
            : 'text-emerald-700'}"
        >
          {errorMsg || flash}
        </span>
      </div>
    </form>
  </div>
</Modal>

<style>
  .calendar {
    color: white;
    background-color: rgba(15, 20, 25, 0.75);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E");
    font-family:
      "SF Pro Display",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial,
      sans-serif;
  }
</style>
