<script lang="ts">
  import { invalidate, invalidateAll } from "$app/navigation";
  import { applyAction, enhance, type SubmitFunction } from "$app/forms";
  import { onDestroy } from "svelte";
  import Circle from "#lib/components/Circle.svelte";
  import Modal, { modalHeader, modalTitle } from "#lib/components/Modal.svelte";
  import { glassButton } from "#lib/styles.ts";
  import { createScheduler, type Word } from "#lib/fsrs.ts";
  import { reviewProgress } from "#lib/review-progress.svelte.ts";
  import {
    getTranslation,
    type WikiTranslationType,
  } from "#lib/translation.ts";
  import { Rating } from "ts-fsrs";
  import { v7 as uuidv7 } from "uuid";
  import BiTranslate from "~icons/bi/translate";
  import MaterialSymbolsAddRounded from "~icons/material-symbols/add-rounded";
  import MaterialSymbolsCloseRounded from "~icons/material-symbols/close-rounded";
  import MaterialSymbolsVolumeUpRounded from "~icons/material-symbols/volume-up-rounded";
  import PhListStar from "~icons/ph/list-star";
  import IconSpinner from "~icons/svg-spinners/ring-resize";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const panel =
    "flex h-auto max-h-[calc(100dvh-2rem)] w-[382px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[2px] bg-white text-[#11130f] ring-1 ring-[#11130f]/15";
  const input =
    "h-9 w-full min-w-0 rounded-[2px] bg-[#11130f]/5 px-2 text-xs text-[#11130f] ring-1 ring-[#5f665c]/70 outline-none placeholder:text-[#5f665c] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2547ff]";
  const label = "mb-1 block text-[10px] font-medium text-[#5f665c]";
  const primary =
    'flex h-9 w-full items-center justify-center gap-1.5 rounded-[2px] bg-[#11130f] text-xs font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-[#2b2f28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-50';
  const topButton =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[2px] bg-white/10 px-2.5 text-[11px] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  const closeButton =
    "flex size-8 shrink-0 items-center justify-center rounded-[2px] text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white";
  const errorText = "mt-2 text-[10px] text-[#b42318]";
  const searchButton =
    "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[2px] bg-[#11130f]/10 px-3 text-xs font-semibold text-[#11130f] ring-1 ring-[#5f665c]/70 transition-colors hover:bg-[#11130f]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:opacity-50";
  const chip = `${glassButton} size-[18px] bg-white/15 text-[#11130f] hover:bg-white/30`;

  let queue = $state<Word[]>([]);
  let batchId = $state(uuidv7());
  let index = $state(0);
  let showTranslation = $state(false);
  let translations = $state<WikiTranslationType[]>([]);
  let translating = $state(false);
  let translationError = $state("");
  let ratingLocked = $state(false);
  let ratingPending = $state(false);
  let ratingError = $state("");
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  let batchBusy = $state(false);
  let ratingForm = $state<HTMLFormElement>();
  let showAdd = $state(false);
  let adding = $state(false);
  let showAddError = $state(false);
  let newWord = $state("");
  let searching = $state(false);
  let searchError = $state("");
  let searchResults = $state<WikiTranslationType[]>([]);
  let duplicateCreatedAt = $state<string | null>(null);
  let searched = $state(false);
  let searchToken = 0;
  let speech: HTMLAudioElement | undefined;

  const current = $derived(queue[index]);

  function calculateTimeDiff(due: Date) {
    const diffMs = due.getTime() - new Date().getTime();
    const diffMin = Math.round(diffMs / (1000 * 60));
    const diffHour = Math.round(diffMs / (1000 * 60 * 60));
    const diffDay = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffMin < 60) return diffMin + "m";
    if (diffHour < 24) return diffHour + "h";
    return diffDay + "d";
  }

  function localDateString(value: string | Date = new Date()) {
    const date = typeof value === "string" ? new Date(value) : value;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  const duplicateDate = $derived(
    duplicateCreatedAt ? localDateString(duplicateCreatedAt) : "",
  );

  function formatCreatedAt(value: string) {
    const date = new Date(value);
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return `${weekday}, ${localDateString(date)} at ${time}`;
  }

  const ratings = $derived.by(() => {
    if (!current) return [];
    const previews = createScheduler().repeat(current.card, new Date());
    return [
      {
        value: Rating.Again,
        label: "Again",
        interval: calculateTimeDiff(previews[Rating.Again].card.due),
        bg: "bg-black/90",
      },
      {
        value: Rating.Hard,
        label: "Hard",
        interval: calculateTimeDiff(previews[Rating.Hard].card.due),
        bg: "bg-black/75",
      },
      {
        value: Rating.Good,
        label: "Good",
        interval: calculateTimeDiff(previews[Rating.Good].card.due),
        bg: "bg-black/60",
      },
      {
        value: Rating.Easy,
        label: "Easy",
        interval: calculateTimeDiff(previews[Rating.Easy].card.due),
        bg: "bg-black/45",
      },
    ];
  });

  function errorFor(action: "addWord" | "rateWord") {
    if (!form || form.action !== action || !("error" in form)) return undefined;
    return form.error;
  }

  async function getBatch() {
    if (batchBusy) return;
    batchBusy = true;
    try {
      await invalidateAll();
      queue = data.words.slice(0, data.batchSize);
      index = 0;
      reviewProgress.total = queue.length;
      reviewProgress.learned = 0;
      batchId = uuidv7();
      showTranslation = false;
      translations = [];
      translationError = "";
      ratingError = "";
    } finally {
      batchBusy = false;
    }
  }

  onDestroy(() => {
    if (cooldownTimer) clearTimeout(cooldownTimer);
  });

  async function toggleTranslation() {
    if (showTranslation) {
      showTranslation = false;
      return;
    }
    showTranslation = true;
    speakWord();
    if (translations.length === 0 && current) {
      const word = current.word;
      translating = true;
      translationError = "";
      try {
        const result = await getTranslation(word);
        if (current?.word !== word) return;
        translations = result;
      } catch {
        if (current?.word === word) {
          translationError = "Could not load translation.";
        }
      } finally {
        if (current?.word === word) translating = false;
      }
    }
  }

  function speakWord() {
    if (!current) return;
    speech?.pause();
    speech = new Audio(
      `https://vocabstts.vercel.app/public/speech?text=${encodeURIComponent(current.word)}`,
    );
    void speech.play().catch(() => {});
  }

  const submitRating: SubmitFunction = ({ formData, cancel }) => {
    if (ratingLocked || ratingPending) {
      cancel();
      return;
    }

    ratingLocked = true;
    ratingPending = true;
    ratingError = "";
    const prevIndex = index;
    const isLast = index === queue.length - 1;

    formData.set("batchId", batchId);
    formData.set("localDate", localDateString());
    formData.set("complete", isLast ? "1" : "0");

    if (cooldownTimer) clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      ratingLocked = false;
      cooldownTimer = undefined;
    }, 500);

    index += 1;
    reviewProgress.learned = Math.min(index, reviewProgress.total);
    showTranslation = false;
    translations = [];
    translationError = "";

    return async ({ result }) => {
      try {
        if (result.type === "redirect") {
          await applyAction(result);
          return;
        }
        if (result.type !== "success") {
          index = prevIndex;
          reviewProgress.learned = Math.min(prevIndex, reviewProgress.total);
          showTranslation = false;
          translations = [];
          translationError = "";
          ratingError =
            result.type === "failure" && typeof result.data?.error === "string"
              ? result.data.error
              : "Could not save rating. Try again.";
          return;
        }
        if (isLast) {
          queue = [];
          index = 0;
          reviewProgress.learned = 0;
          reviewProgress.total = 0;
          void new Audio("/audio/mp3_Ding.mp3").play().catch(() => {});
          void invalidate("app:fsrs-completions").catch(() => {});
        }
      } finally {
        ratingPending = false;
      }
    };
  };

  const submitAddWord: SubmitFunction = () => {
    adding = true;
    showAddError = true;
    return async ({ result, update }) => {
      await update({ reset: false });
      adding = false;
      if (result.type !== "success") return;
      showAddError = false;
      showAdd = false;
      newWord = "";
      clearSearch();
    };
  };

  function clearSearch() {
    searchToken += 1;
    searching = false;
    searchError = "";
    searchResults = [];
    duplicateCreatedAt = null;
    searched = false;
  }

  function openAddModal() {
    clearSearch();
    newWord = "";
    showAddError = false;
    showAdd = true;
  }

  function closeAddModal() {
    showAdd = false;
    newWord = "";
    clearSearch();
  }

  async function searchWord() {
    const candidate = newWord.trim().toLowerCase();
    if (!candidate) {
      searchError = "Enter a word.";
      return;
    }
    const token = ++searchToken;
    searching = true;
    searchError = "";
    searchResults = [];
    duplicateCreatedAt = null;
    searched = true;
    try {
      const response = await fetch(
        `/api/fsrs-lookup?word=${encodeURIComponent(candidate)}`,
      );
      if (!response.ok) throw new Error("Lookup failed");
      const result: {
        word: string;
        translation: WikiTranslationType[];
        duplicateCreatedAt: string | null;
      } = await response.json();
      if (token !== searchToken) return;
      newWord = result.word;
      searchResults = result.translation;
      duplicateCreatedAt = result.duplicateCreatedAt;
    } catch {
      if (token === searchToken) searchError = "Could not look up that word.";
    } finally {
      if (token === searchToken) searching = false;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey ||
      event.repeat
    )
      return;
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, dialog",
      )
    )
      return;

    if (event.key === " ") {
      if (!current) return;
      event.preventDefault();
      toggleTranslation();
      return;
    }

    if (!["1", "2", "3", "4"].includes(event.key) || !current || ratingLocked || ratingPending)
      return;
    event.preventDefault();
    ratingForm
      ?.querySelector<HTMLButtonElement>(
        `button[name="rating"][value="${event.key}"]`,
      )
      ?.click();
  }
</script>

<svelte:head>
  <title>FSRS</title>
</svelte:head>

<svelte:window onkeydown={onKeyDown} />

<div class="flex min-h-full flex-col gap-[3px]">
  <div
    class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-3"
  >
    <div
      class="fixed top-[calc(50%-21px)] left-1/2 w-[548px] max-w-[min(calc(100vw-1rem),calc(100dvh-260px))] -translate-x-1/2 -translate-y-1/2"
    >
      <Circle>
        {#if current}
          {#key current.id}
            {#if showTranslation}
              <div
                class="relative z-3 flex size-full flex-col items-center justify-center gap-1 overflow-y-auto px-5 text-center text-white [text-shadow:0_0_3px_black]"
              >
                {#if translating}
                  <IconSpinner width="16" height="16" aria-hidden="true" />
                {:else if translationError}
                  <p role="alert" class="text-sm leading-snug font-semibold">
                    {translationError}
                  </p>
                {:else if translations.length > 0}
                  <div
                    class="no-scrollbar flex w-full flex-col gap-2 overflow-y-auto text-left"
                  >
                    {#each translations as item (item.partOfSpeech)}
                      <div>
                        <h3
                          class="indent-2 text-[15px] capitalize font-bold text-white italic"
                        >
                          {item.partOfSpeech}
                        </h3>
                        {#each item.translation as line, i (i)}
                          <p class="text-[12px] leading-snug text-white/80">
                            {line}
                          </p>
                        {/each}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm leading-snug font-semibold">
                    No translation found.
                  </p>
                {/if}
              </div>
            {:else}
              <div
                class="relative z-3 flex size-full items-center justify-center text-white [text-shadow:0_0_3px_black]"
              >
                <p
                  class="w-full break-words px-4 text-center font-[Constantine] text-[30px] leading-[36px] font-bold uppercase"
                >
                  {current.word}
                </p>
                <p
                  class="absolute inset-x-0 bottom-1 text-center text-[11px] leading-[15px] font-medium text-white/80"
                >
                  {formatCreatedAt(current.createdAt)}
                </p>
              </div>
            {/if}
          {/key}
        {/if}
      </Circle>

      <div
        class="absolute inset-x-0 top-full mt-3 flex items-center justify-center gap-[3px]"
      >
        <button
          type="button"
          class={chip}
          disabled={ratingLocked || ratingPending || batchBusy}
          aria-label="Get words batch"
          onclick={(event) => {
            event.currentTarget.blur();
            getBatch();
          }}
        >
          {#if batchBusy}
            <IconSpinner width="14" height="14" aria-hidden="true" />
          {:else}
            <PhListStar width="14" height="14" aria-hidden="true" />
          {/if}
        </button>
        <button
          type="button"
          class={chip}
          aria-haspopup="dialog"
          onclick={(event) => {
            event.currentTarget.blur();
            openAddModal();
          }}
        >
          <MaterialSymbolsAddRounded
            width="14"
            height="14"
            aria-hidden="true"
          />
        </button>

        {#if current}
          <button
            type="button"
            aria-label="Toggle translation"
            class={chip}
            onclick={(event) => {
              event.currentTarget.blur();
              toggleTranslation();
            }}
          >
            <BiTranslate width="14" height="14" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Pronounce word"
            class={chip}
            onclick={(event) => {
              event.currentTarget.blur();
              speakWord();
            }}
          >
            <MaterialSymbolsVolumeUpRounded
              width="14"
              height="14"
              aria-hidden="true"
            />
          </button>
        {/if}
      </div>
    </div>
  </div>

  <div
    class="absolute inset-x-0 bottom-[44px] z-10 mx-auto w-full max-w-[382px]"
  >
    <form
      method="POST"
      action="?/rateWord"
      use:enhance={submitRating}
      bind:this={ratingForm}
      class="grid grid-cols-4 gap-[2px]"
    >
      <input type="hidden" name="id" value={current?.id ?? ""} />
      {#each ratings as rating (rating.value)}
        <button
          type="submit"
          name="rating"
          value={rating.value}
          onclick={(event) => event.currentTarget.blur()}
          disabled={!current || ratingLocked || ratingPending}
          class="{glassButton} h-[42px] flex-col gap-0.5 {rating.bg} text-white ring-1 ring-white/10"
        >
          <span class="text-[11px] leading-4 tabular-nums"
            >{rating.interval}</span
          >
          <span class="text-xs leading-4 font-semibold uppercase"
            >{rating.label}</span
          >
        </button>
      {/each}
    </form>
    {#if ratingError}
      <p role="alert" class={errorText}>{ratingError}</p>
    {/if}
  </div>
</div>

<Modal bind:showModal={showAdd} label="Add new word">
  <div class={panel}>
    <div class={modalHeader}>
      <span class={modalTitle}>Add new word</span>
      <button
        type="button"
        class={closeButton}
        aria-label="Close"
        onclick={closeAddModal}
      >
        <MaterialSymbolsCloseRounded
          width="18"
          height="18"
          aria-hidden="true"
        />
      </button>
    </div>

    <form
      method="POST"
      action="?/addWord"
      use:enhance={submitAddWord}
      class="flex min-h-0 flex-1 flex-col"
    >
      <div class="shrink-0 p-4 pb-3">
        <label for="fsrs-word" class={label}>Word</label>
        <div class="flex gap-2">
          <input
            id="fsrs-word"
            name="word"
            type="text"
            maxlength="120"
            required
            autocomplete="off"
            bind:value={newWord}
            oninput={clearSearch}
            onkeydown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                searchWord();
              }
            }}
            class="{input} flex-1"
          />
          <button
            type="button"
            class={searchButton}
            onclick={searchWord}
            disabled={searching || !newWord.trim()}
          >
            Search {#if searching}<IconSpinner
                width="14"
                height="14"
                aria-hidden="true"
              />{/if}
          </button>
        </div>
      </div>

      {#if duplicateCreatedAt || searchError || searchResults.length > 0 || (searched && !searching && !searchError) || (showAddError && errorFor("addWord"))}
        <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div
            class="divide-y divide-[#11130f]/10 rounded-[2px] bg-[#11130f]/[0.02] ring-1 ring-[#11130f]/10"
          >
            {#if duplicateCreatedAt}
              <p
                role="status"
                class="bg-[#b45309]/10 px-2.5 py-2 text-[11px] font-medium text-[#b45309]"
              >
                Already added on {duplicateDate}
              </p>
            {/if}

            {#if searchError}
              <p role="alert" class="{errorText} px-2.5 pb-2">{searchError}</p>
            {/if}

            {#if searchResults.length > 0}
              <div>
                {#each searchResults as item (item.partOfSpeech)}
                  <div class="px-2.5 py-2">
                    <h3 class="text-[10px] font-semibold italic text-[#5f665c]">
                      {item.partOfSpeech}
                    </h3>
                    {#each item.translation as line, i (i)}
                      <p class="text-[11px] leading-snug text-[#11130f]">
                        {line}
                      </p>
                    {/each}
                  </div>
                {/each}
              </div>
            {:else if searched && !searching && !searchError}
              <p class="px-2.5 py-2 text-[11px] text-[#5f665c]">
                No translation found.
              </p>
            {/if}

            {#if showAddError && errorFor("addWord")}
              <p role="alert" class="{errorText} px-2.5 pb-2">
                {errorFor("addWord")}
              </p>
            {/if}
          </div>
        </div>
      {/if}

      <div class="shrink-0 border-t border-[#11130f]/10 px-4 py-3">
        <button
          type="submit"
          class={primary}
          disabled={adding || duplicateCreatedAt !== null}>Add word</button
        >
      </div>
    </form>
  </div>
</Modal>
