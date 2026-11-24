<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Calendar from '#lib/components/Calendar.svelte';
  import Pagination from '#lib/components/Pagination.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const today = $derived((page.data.today as string | undefined) ?? data.today);

  const PAGE_SIZE = 5;
</script>

<svelte:head>
  <title>Calendar</title>
</svelte:head>

<Calendar counts={data.counts} today={today} />

<figure
  class="relative mt-[3px] flex h-24 w-full flex-col justify-center overflow-hidden rounded-[2px] border border-[#2f3336] bg-[#0f1419]"
>
  <img
    src="/images/grunge-image-tree.webp"
    alt=""
    aria-hidden="true"
    class="absolute inset-0 h-full w-full object-cover"
  />
  <div class="absolute inset-0 bg-black/65" aria-hidden="true"></div>

  <blockquote class="relative px-3 pt-1 font-garamond text-[10px] leading-[12px] font-light text-white sm:px-4">
    <span aria-hidden="true" class="mr-0.5 text-[10px] leading-[12px] text-white/70">“</span
    >The tree that is supposed to grow to a proud height can dispense with bad weather and storms. Whether misfortune and external resistance, some kinds of hatred, jealousy, stubbornness, mistrust, hardness, avarice, and violence do not belong among the favorable conditions without which any great growth. The poison of which weaker natures perish strengthens the strong — nor do they call it poison.”
  </blockquote>
  <figcaption class="relative px-3 pt-1 pb-1 font-sans text-[10px] leading-[10px] font-normal text-white/80 sm:px-4">
    — Friedrich Nietzsche
  </figcaption>
</figure>

{#if data.totalItems > 0}
  <section class="mt-[3px] flex w-full flex-col gap-[3px]" aria-label="Cycle progress">
    <Pagination
      totalItems={data.totalItems}
      itemsPerPage={PAGE_SIZE}
      currentPage={data.currentPage}
      onPageChange={(p) => {
        goto(`${page.url.pathname}?page=${p}`, { reset: false });
      }}
    />

    <div class="flex w-full flex-col gap-[2px]">
      {#each data.progress as row (row.id)}
        <div class="flex h-[21px] w-full overflow-hidden rounded-[2px] font-sans text-[12px] leading-[21px] select-none">
          <div class="dark h-full min-w-[120px] text-center">{row.cycle}</div>
          <div class="light flex h-full min-w-0 flex-1">
            <div class="h-full w-1/2 text-center">{row.startDate}</div>
            <div class="h-full w-1/2 text-center">{row.endDate}</div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
