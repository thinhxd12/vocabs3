<script lang="ts">
  import TablerChevronLeft from "~icons/tabler/chevron-left";
  import TablerChevronRight from "~icons/tabler/chevron-right";

  interface Props {
    rows: { date: string; time: number }[];
  }

  let { rows }: Props = $props();

  type Day = { date: string; month: number; day: number; time: number };

  const MONTHS = [
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
  const LEVELS = [
    "bg-[#eff2f5]",
    "bg-[#dcfce7]",
    "bg-[#bbf7d0]",
    "bg-[#86efac]",
    "bg-[#4ade80]",
    "bg-[#22c55e]",
    "bg-[#16a34a]",
    "bg-[#15803d]",
    "bg-[#166534]",
    "bg-[#14532d]",
    "bg-[#052e16]",
  ];

  const todayKey = dateKey(new Date());

  let year = $state(new Date().getFullYear());
  let detail = $state<Day>();

  const times = $derived(new Map(rows.map((row) => [row.date, row.time])));
  const maxValue = $derived(Math.max(1, ...rows.map((row) => row.time)));
  const months = $derived.by(() =>
    MONTHS.map((_, month) => {
      const count = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { date, month, day, time: times.get(date) ?? 0 };
      });
    }),
  );
  const allDays = $derived(months.flat());
  const totalMinutes = $derived(
    rows.reduce(
      (sum, row) => (row.date.startsWith(`${year}-`) ? sum + row.time : sum),
      0,
    ),
  );
  const shown = $derived(
    detail ??
      allDays.find((day) => day.date === todayKey) ??
      allDays.findLast((day) => day.time > 0) ??
      allDays.at(-1),
  );

  function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function level(time: number) {
    return Math.round((time / maxValue) * 10);
  }

  function formatHours(total: number) {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  }

  function shiftYear(delta: number) {
    const next = Math.min(2100, Math.max(2025, year + delta));
    if (next === year) return;
    year = next;
    detail = undefined;
  }
</script>

<div class="flex h-full flex-col gap-5 overflow-auto bg-white p-3">
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-[3px] border border-[#e5e7eb] bg-white text-[#11130f] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#2547ff] disabled:opacity-40"
        aria-label="Previous year"
        disabled={year <= 2025}
        onclick={() => shiftYear(-1)}
      >
        <TablerChevronLeft width="16" height="16" />
      </button>
      <span class="w-14 text-center text-[22px] font-semibold tabular-nums"
        >{year}</span
      >
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-[3px] border border-[#e5e7eb] bg-white text-[#11130f] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#2547ff] disabled:opacity-40"
        aria-label="Next year"
        disabled={year >= 2100}
        onclick={() => shiftYear(1)}
      >
        <TablerChevronRight width="16" height="16" />
      </button>
    </div>
    <p class="text-[11px]">{formatHours(totalMinutes)} focused</p>
  </div>

  <div class="-mx-2 flex flex-col gap-[2px]">
    <div class="flex items-center gap-1.5">
      <span class="w-5 shrink-0"></span>
      <div
        class="grid grid-cols-[repeat(31,10px)] gap-[1px] text-[9px] leading-none text-[#6b7280]"
      >
        {#each Array(31) as _, i (i)}
          <span class="whitespace-nowrap">{i % 7 === 0 ? i + 1 : ""}</span>
        {/each}
      </div>
    </div>

    {#each months as days, month (month)}
      <div class="flex items-center">
        <span class="w-5 shrink-0 text-[10px] leading-none text-[#11130f]">
          {MONTHS[month].slice(0, 3)}
        </span>
        <div
          class="grid grid-cols-[repeat(31,10px)] gap-[1px]"
          aria-hidden="true"
        >
          {#each days as day (day.date)}
            <button
              type="button"
              tabindex="-1"
              title="{day.date} · {formatHours(day.time)}"
              class="size-[10px] rounded-[2px] border border-[#1f23280d] p-0 hover:border-black {LEVELS[
                level(day.time)
              ]}"
              onmouseenter={() => (detail = day)}
            ></button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="flex items-center justify-center gap-[2px]">
    <span class="mr-[3px] text-[10px]">Less</span>
    {#each LEVELS as levelClass (levelClass)}
      <span class="size-3.5 rounded-[2px] {levelClass}"></span>
    {/each}
    <span class="ml-[3px] text-[10px]">More</span>
  </div>

  {#if shown}
    <div
      class="flex items-center gap-4 rounded-[4px] border border-[#7ee2b8] bg-white px-4 py-3"
    >
      <span class="text-[40px] leading-none font-semibold text-[#0b7a4b]"
        >{shown.day}</span
      >
      <div>
        <p class="text-[17px] leading-tight font-semibold">{shown.date}</p>
        <p class="text-[11px] text-[#6b7280]">{formatHours(shown.time)}</p>
      </div>
    </div>
  {/if}
</div>
