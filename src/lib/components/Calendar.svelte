<script lang="ts">
  import { fly } from 'svelte/transition';

  type CalendarProps = {
    counts: Record<string, number>;
    today: string;
  };

  let { counts, today }: CalendarProps = $props();

  type DayType = {
    key: string;
    date: number;
    month: number;
    year: number;
    enabled: boolean;
    count: number;
  };

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parts(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month: month - 1, day };
  }

  const todayParts = $derived(parts(today));
  const todayDate = $derived(new Date(todayParts.year, todayParts.month, todayParts.day));
  const todayKey = $derived(today);
  const weekday = $derived(
    new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(todayDate)
  );

  let viewed = $state<{ year: number; month: number } | null>(null);
  const year = $derived(viewed?.year ?? todayParts.year);
  const month = $derived(viewed?.month ?? todayParts.month);
  const isCurrentMonth = $derived(year === todayParts.year && month === todayParts.month);
  let isNext = $state(true);

  function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  const days = $derived.by<DayType[]>(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInThisMonth = new Date(year, month + 1, 0).getDate();
    const daysInLastMonth = new Date(year, month, 0).getDate();
    const prevMonth = month === 0 ? 11 : month - 1;
    const nextMonth = (month + 1) % 12;
    const result: DayType[] = [];

    for (let i = daysInLastMonth - firstDay; i < daysInLastMonth; i++) {
      const dayYear = prevMonth === 11 ? year - 1 : year;
      result.push({
        key: dateKey(new Date(dayYear, prevMonth, i + 1)),
        date: i + 1,
        month: prevMonth,
        year: dayYear,
        enabled: false,
        count: 0
      });
    }

    for (let i = 1; i <= daysInThisMonth; i++) {
      const key = dateKey(new Date(year, month, i));
      result.push({
        key,
        date: i,
        month,
        year,
        enabled: true,
        count: counts[key] ?? 0
      });
    }

    for (let i = 1; result.length % 7; i++) {
      const dayYear = month === 11 ? year + 1 : year;
      result.push({
        key: dateKey(new Date(dayYear, nextMonth, i)),
        date: i,
        month: nextMonth,
        year: dayYear,
        enabled: false,
        count: 0
      });
    }

    return result;
  });

  function next() {
    isNext = true;
    viewed = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  }

  function prev() {
    isNext = false;
    viewed = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  }
</script>

<div class="w-full overflow-hidden rounded-[2px] border border-[#2f3336]">
  <div class="calendar relative aspect-[1.61803398875] w-full overflow-hidden">
    {#key month}
      <img
        src={`/images/${month + 1}.webp`}
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        in:fly={{
          x: isNext ? 30 : -30,
          duration: reduceMotion ? 0 : 150,
          delay: reduceMotion ? 0 : 150
        }}
        out:fly={{ x: isNext ? -30 : 30, duration: reduceMotion ? 0 : 150 }}
      />
    {/key}
  </div>

  <div class="calendar">
    <div
      class="flex flex-col gap-3 pt-1 pb-2 sm:flex-row sm:items-start sm:justify-between sm:px-1"
    >
      <div class="flex select-none items-center gap-1 text-[#71767b]">
        <button
          type="button"
          class="month-hit flex size-11 shrink-0 items-center justify-center rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38e07b]"
          aria-label="Previous month"
          onclick={prev}
        >
          <span class="month-button left-button"></span>
        </button>
        <h3 class="text-[54px] leading-[45px] font-light font-roslindale text-white tabular-nums">{todayParts.day}</h3>
        <div class="flex flex-col">
          <div class="text-[18px] leading-[16px] font-light text-white">{weekday}</div>
          <div class="flex items-center text-white">
            <span class="min-w-[90px] text-[12px] leading-[24px] font-normal">
              {MONTH_NAMES[month]} {year}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="month-hit -mx-3.5 flex size-11 shrink-0 items-center justify-center rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38e07b]"
          aria-label="Next month"
          onclick={next}
        >
          <span class="month-button right-button"></span>
        </button>
      </div>
      {#if !isCurrentMonth}
        <button
          type="button"
          class="self-end rounded-[2px] bg-white/10 px-2 py-1 text-[10px] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38e07b]"
          aria-label="Today, go to current month"
          onclick={() => {
            isNext = year < todayParts.year || (year === todayParts.year && month < todayParts.month);
            viewed = null;
          }}
        >
          Today
        </button>
      {/if}
    </div>

    <div class="w-full">
      <div
        class="grid w-full grid-cols-7 justify-items-center border-y border-[#424c56]"
      >
        {#each DAY_NAMES as day (day)}
          <span
            class="h-[24px] w-[50px] max-w-full text-center text-[13px] leading-[22px] font-normal text-white select-none first-of-type:text-[#ff3333]"
          >
            {day}
          </span>
        {/each}
      </div>

      <div
        class="no-scrollbar grid w-full auto-rows-[24px] grid-cols-7 justify-items-center pb-[3px]"
      >
        {#each days as day (day.key)}
          <div
            class="day relative flex h-full w-[50px] max-w-full items-center justify-center text-[12px] leading-[22px] font-normal text-white select-none {day.enabled
              ? 'opacity-100'
              : 'opacity-30'}"
          >
            {day.date}
            {#if day.count > 0}
              <span
                class="schedule absolute top-0 right-[6px] text-[8px] leading-[8px] font-semibold"
              >
                {day.count}
              </span>
            {/if}
            {#if day.key === todayKey}
              <span
                class="today absolute bottom-[3px] left-1/2 h-[2px] w-[18px] -translate-x-1/2 rounded-full bg-[#38e07b]"
              ></span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .calendar {
    color: white;
    background-color: rgba(15, 20, 25, 0.75);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E");
    font-family:
      'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif;
  }

  .day:nth-of-type(7n + 1) {
    color: #ff3333;
  }

  .day:nth-of-type(7n + 1) .today {
    background-color: #ff3333;
  }

  .day:nth-of-type(7n + 1) .schedule {
    color: #ff3333;
  }

  .month-button {
    width: 16px;
    height: 42px;
    transition: background-color 0.1s;
  }

  .month-hit:hover .month-button {
    background-color: #71767b;
  }

  .month-hit:active .month-button {
    filter: brightness(1.1);
  }

  .left-button {
    clip-path: polygon(0 50%, 100% 0, 100% 100%);
  }

  .right-button {
    clip-path: polygon(100% 50%, 0 0, 0 100%);
  }

  @media (prefers-reduced-motion: reduce) {
    .month-button {
      transition: none;
    }
  }
</style>
