<script lang="ts">
  import { enhance, type SubmitFunction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { onDestroy, onMount } from "svelte";
  import { quadInOut } from "svelte/easing";
  import { Spring, Tween } from "svelte/motion";
  import { SvelteMap } from "svelte/reactivity";
  import { innerHeight, innerWidth } from "svelte/reactivity/window";
  import HighlightPage from "#lib/components/HighlightPage.svelte";
  import Modal, { modalHeader, modalTitle } from "#lib/components/Modal.svelte";
  import StarRating from "#lib/components/StarRating.svelte";
  import { readBookInfo, writeBookInfo } from "#lib/book-info-cache.ts";
  import {
    bookInfoKey,
    safeHighlightHtml,
    type BookDetailType,
    type BookPageContentType,
    type Highlight,
  } from "#lib/highlights.ts";
  import {
    clearNoteDraft,
    readNoteDraft,
    writeNoteDraft,
  } from "#lib/note-draft.ts";
  import { paginate } from "#lib/paginate.ts";
  import IconBookmarkSimple from "~icons/ph/bookmark-simple";
  import IconCheck from "~icons/ph/check";
  import IconX from "~icons/ph/x";
  import MaterialSymbolsTranslateRounded from "~icons/material-symbols/translate-rounded";
  import MaterialSymbolsContentCopyOutlineRounded from "~icons/material-symbols/content-copy-outline-rounded";
  import MaterialSymbolsShuffleRounded from "~icons/material-symbols/shuffle-rounded";
  import MaterialSymbolsEditSquareOutlineRounded from "~icons/material-symbols/edit-square-outline-rounded";
  import MaterialSymbolsDatabaseUploadOutlineRounded from "~icons/material-symbols/database-upload-outline-rounded";
  import MaterialSymbolsDeleteForeverOutlineRounded from "~icons/material-symbols/delete-forever-outline-rounded";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const RATIO = 1.61803398875;

  const PANEL =
    "mt-9 light flex min-h-0 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[2px] text-[#11130f] shadow-2xl ring-1 ring-black/15";
  const CLOSE =
    "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[2px] text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-300";
  const FIELD =
    "w-full rounded-[2px] border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#11130f] outline-hidden transition-colors placeholder:text-black/50";
  const EDIT_FIELD =
    "h-8 w-full rounded-[2px] border border-slate-300 bg-white px-2 text-[11px] text-[#11130f] outline-hidden transition-colors placeholder:text-black/50";
  const LABEL = "mb-1 block text-[10px] font-medium text-black/70";
  const BUTTON =
    "h-7 cursor-pointer rounded-[2px] px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]";
  const QUIET =
    "h-7 cursor-pointer rounded-[2px] px-3 text-[11px] font-medium text-black/70 transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]";

  // An action's returned row wins over the load until the next action, so an
  // in-flight `invalidateAll()` cannot interrupt a page animation.
  let animated = $state<Highlight | null>(null);
  let highlight = $derived(animated ?? data.current);
  let bookInfo = $state<BookDetailType | null>(null);
  const infoCache = new SvelteMap<string, BookDetailType | null>();
  let infoToken = 0;

  let likeBookmark = $state(false);
  let keyPressed = $state(false);
  let busy = $state(false);
  let actionError = $state("");

  const tweenCover = new Spring(0, { stiffness: 0.06, damping: 0.4 });
  const tweenRibbon = new Tween(21, { duration: 150, easing: quadInOut });

  let flipCover = $state(false);
  let currentPage = $state(0);
  let flipPages = $state<BookPageContentType[]>([]);

  let showEdit = $state(false);
  let showInsert = $state(false);
  let showDelete = $state(false);
  let showNote = $state(false);
  let expandDesc = $state(false);
  let isSubmitting = $state(false);
  let deleting = $state(false);
  let highlightEdit = $state<Highlight | null>(null);
  let noteContent = $state("");
  let noteBase = $state("");
  let showTranslated = $state(false);
  let translatedContent = $state("");

  let likePending: { id: string; like: number; liked: boolean } | null = null;
  let notePending: { id: string; previous: string } | null = null;
  let deleteId: string | null = null;

  let flipTimeout: ReturnType<typeof setTimeout> | undefined;
  let flagTimeout: ReturnType<typeof setTimeout> | undefined;
  let resetTimeout: ReturnType<typeof setTimeout> | undefined;
  let measureEl: HTMLDivElement | undefined;

  const modalOpen = $derived(showEdit || showInsert || showDelete);

  /* The book keeps its golden-ratio proportions and shrinks to fit whichever
     side of the viewport runs out first. */
  const pageWidth = $derived.by(() => {
    const viewportHeight = innerHeight.current ?? 800;
    const viewportWidth = innerWidth.current ?? 1200;
    const byHeight = Math.round(RATIO * Math.max(220, viewportHeight - 160));
    const byWidth = Math.max(320, Math.round(viewportWidth - 32));
    const width = Math.min(byHeight, byWidth);
    return width % 2 === 0 ? width : width - 1;
  });
  const pageHeight = $derived(Math.round(pageWidth / RATIO));
  const textWidth = $derived(pageWidth / 2 - 12 - 112);
  const textHeight = $derived(pageHeight - 24 - 96);

  const dialogWidth = $derived(Math.max(320, pageWidth));
  const dialogHeight = $derived(
    Math.min(Math.max(360, pageHeight), (innerHeight.current ?? 800) - 48),
  );

  const likes = $derived(highlight?.like ?? 0);
  const noteDirty = $derived(
    !!highlight && noteContent !== (highlight.note ?? ""),
  );
  const bookRatingCount = $derived(
    Number((bookInfo?.numberOfRatings ?? "").replace(/,/g, "")) || 0,
  );

  const timeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateFormat = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function prettyStamp(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : `${timeFormat.format(date)} ${dateFormat.format(date)}`;
  }

  function ribbonFontSize(value: number) {
    const digits = String(Math.max(0, value)).length;
    return Math.max(14, 27 - (digits - 1) * 4);
  }

  function ribbonFor(like: number, liked: boolean) {
    tweenRibbon.target = like === 0 ? 21 : liked ? 580 : 480;
  }

  // === Book pagination ===================================================
  function measureHeight(markup: string, width: number, firstPage = false) {
    if (!measureEl) {
      measureEl = document.createElement("div");
      measureEl.setAttribute("aria-hidden", "true");
      measureEl.style.position = "absolute";
      measureEl.style.visibility = "hidden";
      measureEl.style.left = "-9999px";
      measureEl.style.top = "0";
      measureEl.style.pointerEvents = "none";
      document.body.appendChild(measureEl);
    }

    measureEl.className = firstPage
      ? "highlightContent highlightContentFirstPage"
      : "highlightContent";
    measureEl.innerHTML = safeHighlightHtml(markup);
    measureEl.style.width = `${width}px`;
    return measureEl.clientHeight;
  }

  function setBookContent(content: string) {
    const blocks = paginate(content, textWidth, textHeight, measureHeight);

    flipPages = blocks.reduce<BookPageContentType[]>((pages, block, index) => {
      if (index % 2 === 0) {
        pages.push({
          id: 1 + index / 2,
          front: block,
          back: blocks[index + 1] ?? "",
          flip: false,
        });
      }
      return pages;
    }, []);
  }

  let repaginateTimer: ReturnType<typeof setTimeout> | undefined;

  // The printed page is sized from the viewport, so resize must re-paginate.
  function onResize() {
    if (!highlight) return;
    clearTimeout(repaginateTimer);
    repaginateTimer = setTimeout(() => {
      setBookContent(highlight.content);
      currentPage = 0;
    }, 150);
  }

  // === Data ==============================================================
  async function loadBookInfo(row: Highlight) {
    const author = (row.authors ?? "").split(";")[0].trim();
    const key = bookInfoKey(row.bookTile, row.authors);
    const token = ++infoToken;

    if (infoCache.has(key)) {
      bookInfo = infoCache.get(key) ?? null;
      return;
    }

    const stored = readBookInfo(key);
    if (stored) {
      infoCache.set(key, stored);
      bookInfo = stored;
      return;
    }

    bookInfo = null;

    try {
      const params = new URLSearchParams({ query: row.bookTile, author });
      const response = await fetch(`/api/bookinfo?${params}`);
      if (!response.ok) {
        if (response.status === 404) infoCache.set(key, null);
        return;
      }

      const info = (await response.json()) as BookDetailType | null;
      infoCache.set(key, info);
      if (info) writeBookInfo(key, info);
      if (token === infoToken && highlight?.id === row.id) bookInfo = info;
    } catch {
      // Leave uncached so a transient failure can retry.
    }
  }

  function applyHighlight(row: Highlight) {
    animated = row;
    noteBase = row.note ?? "";
    const draft = readNoteDraft(row.id, noteBase);
    noteContent = draft ?? noteBase;
    likeBookmark = false;
    showTranslated = false;
    translatedContent = "";
    currentPage = 0;
    infoToken += 1;
    bookInfo = null;
    setBookContent(row.content ?? "");
    void loadBookInfo(row);
  }

  function applyCurrent() {
    if (data.current) applyHighlight(data.current);
    else {
      animated = null;
      flipCover = false;
      currentPage = 0;
      infoToken += 1;
      bookInfo = null;
      tweenCover.target = 0;
    }
  }

  onMount(applyCurrent);

  function rememberNoteDraft(event: Event) {
    const id = highlight?.id;
    if (!id) return;
    writeNoteDraft(
      id,
      (event.currentTarget as HTMLTextAreaElement).value,
      noteBase,
    );
  }

  async function saveNote() {
    const current = highlight;
    if (!current || !noteDirty) return;

    const next = noteContent;
    notePending = { id: current.id, previous: current.note ?? "" };
    // Snapshot the text being written; the reader may type on while it is in flight.
    animated = { ...current, note: next };
    submitWith(getForm("note"), { id: current.id, note: next });
  }

  // === Form actions ======================================================
  function getForm(action: string) {
    return document.getElementById(
      `highlight-${action}-form`,
    ) as HTMLFormElement | null;
  }

  function submitWith(
    form: HTMLFormElement | null,
    values: Record<string, string>,
  ) {
    if (!form) return;
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      ) {
        field.value = value;
      }
    }
    form.requestSubmit();
  }

  function afterSuccess(
    onSuccess: (
      payload: Record<string, unknown> | undefined,
      form: HTMLFormElement,
    ) => void | Promise<void>,
    onFailure?: () => void,
    afterRefresh?: () => void,
    refresh = true,
  ): SubmitFunction {
    return () =>
      async ({ result, update, formElement: form }) => {
        if (result.type !== "success") {
          const data = "data" in result ? result.data : undefined;
          actionError =
            typeof data?.error === "string"
              ? data.error
              : "Could not complete that action.";
          onFailure?.();
          await update({ reset: false });
          return;
        }
        actionError = "";
        await onSuccess(result.data, form);
        // Like and note return their new value; a reload would only re-sort the
        // whole highlights table for no benefit.
        if (refresh) await invalidateAll();
        afterRefresh?.();
      };
  }

  const selectDone = afterSuccess(
    (payload) => {
      busy = false;
      const row = payload?.highlight as Highlight | undefined;
      if (row) closeBook(row);
    },
    () => {
      busy = false;
    },
  );

  const saveDone = afterSuccess(
    (payload) => {
      isSubmitting = false;
      showEdit = false;
      const row = payload?.highlight as Highlight | undefined;
      if (row) closeBook(row);
    },
    () => {
      isSubmitting = false;
    },
  );

  const insertDone = afterSuccess(
    (_payload, form) => {
      isSubmitting = false;
      showInsert = false;
      animated = null;
      form.reset();
    },
    () => {
      isSubmitting = false;
    },
    applyCurrent,
  );

  const likeDone = afterSuccess(
    (payload) => {
      const like = Number(payload?.like);
      if (
        likePending &&
        highlight?.id === likePending.id &&
        Number.isFinite(like)
      ) {
        animated = { ...highlight, like };
        ribbonFor(like, likeBookmark);
      }
      likePending = null;
    },
    () => {
      if (!likePending || highlight?.id !== likePending.id) return;
      animated = { ...highlight, like: likePending.like };
      likeBookmark = likePending.liked;
      ribbonFor(likePending.like, likePending.liked);
      likePending = null;
    },
    undefined,
    false,
  );

  const noteDone = afterSuccess(
    (payload) => {
      const saved = payload?.note;
      const id = notePending?.id;
      if (typeof saved === "string" && id) {
        if (highlight?.id === id) {
          noteBase = saved;
          animated = { ...highlight, note: saved };
          if (noteContent !== saved) writeNoteDraft(id, noteContent, saved);
          else clearNoteDraft(id);
        }
      }
      notePending = null;
    },
    () => {
      const id = notePending?.id;
      const previous = notePending?.previous;
      if (id && previous !== undefined && highlight?.id === id) {
        animated = { ...highlight, note: previous };
        writeNoteDraft(id, noteContent, previous);
      }
      notePending = null;
    },
    undefined,
    false,
  );

  const deleteDone = afterSuccess(
    () => {
      deleting = false;
      if (deleteId) clearNoteDraft(deleteId);
      deleteId = null;
      showDelete = false;
      animated = null;
    },
    () => {
      deleting = false;
    },
    applyCurrent,
  );

  // === Book motion =======================================================
  function openBook() {
    if (!highlight) return;

    flipCover = true;
    tweenCover.target = -180;

    if (likes > 0) {
      setTimeout(() => ribbonFor(likes, likeBookmark), 250);
    }
  }

  function closeBook(next: Highlight) {
    keyPressed = true;
    tweenRibbon.target = 21;

    const anyFlipped = flipPages.some((page) => page.flip);

    if (anyFlipped) {
      flipPages.forEach((page, index) => {
        setTimeout(
          () => {
            page.flip = false;
          },
          (flipPages.length - index - 1) * 150,
        );
      });

      flipTimeout = setTimeout(() => {
        tweenCover.target = 0;
        flipCover = false;
      }, flipPages.length * 150);

      resetTimeout = setTimeout(
        () => {
          applyHighlight(next);
          keyPressed = false;
        },
        flipPages.length * 150 + 300,
      );
    } else {
      tweenCover.target = 0;
      flipCover = false;

      flipTimeout = setTimeout(() => {
        applyHighlight(next);
        keyPressed = false;
      }, 300);
    }
  }

  function flipPage(id: number) {
    keyPressed = true;
    tweenRibbon.target = 21;
    currentPage = id;

    const page = flipPages[id - 1];
    if (page) page.flip = !page.flip;

    flipTimeout = setTimeout(() => {
      keyPressed = false;
    }, 400);

    if (flipCover && highlight && likes > 0) {
      flagTimeout = setTimeout(() => ribbonFor(likes, likeBookmark), 400);
    }
  }

  // === Navigation ========================================================
  function navigate(direction: 1 | -1) {
    if (!highlight || keyPressed || busy) return;

    showNote = false;
    void saveNote();

    const adjacent = direction > 0 ? data.nextId : data.prevId;
    // With a single screenful of highlights the old reader wrapped around.
    const wrapped =
      data.recent.length === data.total
        ? direction > 0
          ? data.recent.at(-1)?.id
          : data.recent[0]?.id
        : undefined;
    const id = adjacent ?? wrapped;
    if (!id) return;

    busy = true;
    submitWith(getForm("select"), { id });
  }

  function randomBookmark() {
    if (!highlight || !data.randomId || keyPressed || busy) return;

    showNote = false;
    void saveNote();
    busy = true;
    submitWith(getForm("select"), { id: data.randomId });
  }

  function toggleLike() {
    const current = highlight;
    if (!current) return;

    const nextLiked = !likeBookmark;
    const nextLike = Math.max(0, current.like + (nextLiked ? 1 : -1));
    likePending = { id: current.id, like: current.like, liked: likeBookmark };

    likeBookmark = nextLiked;
    animated = { ...current, like: nextLike };
    ribbonFor(nextLike, nextLiked);
    submitWith(getForm("like"), {
      id: current.id,
      delta: nextLiked ? "1" : "-1",
    });
  }

  function copyHighlight() {
    if (!highlight) return;
    void navigator.clipboard
      .writeText(
        `Break down this quote, after that give me a clear, everyday example of what this looks like in practice today: ${highlight.content}`,
      )
      .catch(() => {});
  }

  async function translateHighlight() {
    if (!highlight) return;

    if (!translatedContent) {
      busy = true;
      try {
        const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=vi&q=${encodeURIComponent(highlight.content)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("translate failed");

        const payload = (await response.json()) as unknown;
        const first = Array.isArray(payload) ? payload[0] : null;
        const text = Array.isArray(first) ? first[0] : first;
        if (typeof text !== "string" || text.length === 0)
          throw new Error("empty");

        translatedContent = text;
      } catch {
        busy = false;
        return;
      }
      busy = false;
    }

    tweenRibbon.target = 21;
    tweenCover.target = 0;
    flipCover = false;

    flipTimeout = setTimeout(() => {
      showTranslated = !showTranslated;
      setBookContent(
        showTranslated ? translatedContent : (highlight?.content ?? ""),
      );
      currentPage = 0;
      keyPressed = false;
    }, 300);
  }

  function deleteHighlight() {
    if (!highlight) return;
    deleteId = highlight.id;
    deleting = true;
    submitWith(getForm("delete"), { id: highlight.id });
  }

  // === Dialogs ===========================================================
  function openInsert() {
    isSubmitting = false;
    showInsert = true;
  }

  function openEdit() {
    if (!highlight) return;
    void saveNote();
    highlightEdit = { ...highlight };
    isSubmitting = false;
    showEdit = true;
  }

  // === Keyboard ==========================================================
  function onKeyDown(event: KeyboardEvent) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, [contenteditable="true"]')
    ) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (modalOpen || !highlight) return;
    if (keyPressed) {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!flipCover) openBook();
      else if (currentPage === 0) flipPage(1);
      else if (currentPage >= flipPages.length) {
        if (flipPages[currentPage - 1]?.flip) navigate(1);
        else flipPage(currentPage);
      } else if (flipPages[currentPage - 1]?.flip) flipPage(currentPage + 1);
      else flipPage(currentPage);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!flipCover) return;
      if (currentPage === 0) navigate(-1);
      else if (currentPage === 1) {
        if (flipPages[0]?.flip) flipPage(1);
        else navigate(-1);
      } else if (flipPages[currentPage - 1]?.flip) flipPage(currentPage);
      else flipPage(currentPage - 1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (flipCover) toggleLike();
    }
  }

  onDestroy(() => {
    clearTimeout(flipTimeout);
    clearTimeout(flagTimeout);
    clearTimeout(resetTimeout);
    clearTimeout(repaginateTimer);
    measureEl?.remove();
    measureEl = undefined;
    void saveNote();
  });
</script>

<svelte:head>
  <title>{highlight ? `📖 ${highlight.bookTile}` : "📖"}</title>
  <meta
    name="description"
    content="Read your saved book highlights as a flipping book."
  />
</svelte:head>

<div class="relative flex min-h-0 w-full flex-1 flex-col">
  {#if actionError}
    <div
      role="alert"
      class="absolute top-2 left-1/2 z-50 -translate-x-1/2 rounded-[2px] bg-red-700 px-3 py-1 text-[11px] text-white shadow-lg"
    >
      {actionError}
    </div>
  {/if}

  {#if highlight}
    <div
      class="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-3 pt-9"
    >
      <div class="book" style="width: {pageWidth}px; height: {pageHeight}px;">
        <!-- Closed cover; rotates around the spine when opened. -->
        <div
          class="flip flipCover"
          style="z-index: {tweenCover.current <= -90
            ? 4
            : 4 +
              flipPages.length}; transform: rotateY({tweenCover.current}deg);"
        >
          <div class="frontPage">
            <div
              class="frontCover"
              style="width: {pageWidth / 2}px; height: {pageHeight}px;"
            >
              {#if bookInfo?.coverImage}
                <img
                  src={bookInfo.coverImage}
                  alt="Cover of {highlight.bookTile}"
                  class="h-full w-full object-contain"
                  loading="lazy"
                />
              {:else}
                <div class="flex h-full w-full items-center p-[12%]">
                  <p
                    class="font-serif text-[40px] leading-[1.15] font-semibold text-[#d0c9c5]"
                  >
                    take a small step every day
                  </p>
                </div>
              {/if}
            </div>

            <button
              type="button"
              class="pageButton"
              aria-label="Open the book"
              onclick={openBook}
            ></button>
          </div>

          <div class="backPage">
            <div
              class="infoPage"
              style="width: {pageWidth / 2}px; height: {pageHeight}px;"
            >
              <div class="infoPageContent frontCoverPaper">
                <div class="info-scroll no-scrollbar">
                  {#if bookInfo?.coverImage}
                    <img
                      src={bookInfo.coverImage}
                      alt=""
                      class="h-2/5 object-contain"
                      style="filter: drop-shadow(0 2px 8px rgba(0,0,0,.2));"
                    />
                  {/if}

                  <p class="book-title">
                    {bookInfo?.title ?? highlight.bookTile}
                  </p>

                  <p class="book-authors">
                    {(bookInfo?.authors?.length
                      ? bookInfo.authors.join(", ")
                      : highlight.authors) ?? ""}
                  </p>

                  {#if bookInfo && Number(bookInfo.rating) > 0 && bookRatingCount > 0}
                    <div
                      class="mt-1 mb-2 flex items-center justify-center gap-2"
                    >
                      <StarRating rating={Number(bookInfo.rating)} />
                      <span class="book-meta text-[12px]"
                        >{bookInfo.rating}</span
                      >
                    </div>
                    <p class="book-meta">
                      {bookRatingCount.toLocaleString()} ratings
                    </p>
                  {/if}

                  {#if bookInfo?.description}
                    <div class="mt-2 w-full text-left">
                      <p class={["book-description", { clamped: !expandDesc }]}>
                        {bookInfo.description}
                      </p>
                      <button
                        type="button"
                        onclick={() => (expandDesc = !expandDesc)}
                        class="mt-1 float-right text-[10px] font-semibold text-[#1e1915] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2547ff]"
                      >
                        {expandDesc ? "Show less" : "Show more"}
                      </button>
                    </div>
                  {/if}

                  {#if bookInfo?.numberOfPages}
                    <p class="book-meta">
                      {bookInfo.numberOfPages} pages, Paperback
                    </p>
                  {/if}

                  {#if bookInfo?.firstPublished}
                    <p class="book-meta">
                      First published {bookInfo.firstPublished}
                    </p>
                  {/if}

                  <p class="book-meta">
                    Page {highlight.page}, bookmarked at {prettyStamp(
                      highlight.dateOfCreation,
                    )}
                  </p>
                </div>

                <div class="toolbar">
                  <button
                    type="button"
                    class="tool-btn"
                    aria-label={showTranslated
                      ? "Show the original highlight"
                      : "Translate the highlight"}
                    title={showTranslated ? "Original" : "Translate"}
                    onclick={translateHighlight}
                  >
                    <MaterialSymbolsTranslateRounded
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    class="tool-btn"
                    aria-label="Copy the highlight"
                    title="Copy"
                    onclick={copyHighlight}
                  >
                    <MaterialSymbolsContentCopyOutlineRounded
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    class="tool-btn"
                    aria-label="Random highlight"
                    title="Random"
                    disabled={!data.randomId || busy}
                    onclick={randomBookmark}
                  >
                    <MaterialSymbolsShuffleRounded
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    class="tool-btn"
                    aria-label="Edit the highlight"
                    title="Edit"
                    onclick={openEdit}
                  >
                    <MaterialSymbolsEditSquareOutlineRounded
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    class="tool-btn"
                    aria-label="Import Kindle highlights"
                    title="Import"
                    onclick={openInsert}
                  >
                    <MaterialSymbolsDatabaseUploadOutlineRounded
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    class="tool-btn tool-btn-danger"
                    aria-label="Delete the highlight"
                    title="Delete"
                    onclick={() => (showDelete = true)}
                  >
                    <MaterialSymbolsDeleteForeverOutlineRounded
                      class="size-4"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="pageButton"
              aria-label="Previous highlight"
              disabled={!data.prevId || busy}
              onclick={() => navigate(-1)}
            ></button>
          </div>
        </div>

        <!-- Printed sheets: only mounted once the cover has swung aside. -->
        {#if tweenCover.current < -90}
          {#each flipPages as sheet (sheet.id)}
            <HighlightPage
              data={sheet}
              innerWidth={textWidth}
              innerHeight={textHeight}
              length={flipPages.length}
              handleFlip={flipPage}
            />
          {/each}
        {/if}

        {#if tweenCover.current < -90}
          <div class="bookShadow" aria-hidden="true"></div>
        {/if}

        <div class="backCover" style="z-index: 3;">
          <div class="h-full w-full backCoverPaper"></div>
          <button
            type="button"
            class="pageButton"
            aria-label="Next highlight"
            disabled={!data.nextId || keyPressed || busy}
            onclick={() => navigate(1)}
          ></button>
        </div>

        <button
          type="button"
          class="ribbon {tweenRibbon.current > 150
            ? 'ribbonLong'
            : 'ribbonShort'}"
          aria-label={likeBookmark ? "Remove like" : "Like this highlight"}
          aria-pressed={likeBookmark}
          style="height: {tweenRibbon.current}px; {tweenRibbon.current > 21
            ? 'box-shadow: 1px 1px 3px rgba(0,0,0,0.6); z-index: 999;'
            : 'z-index: 3;'}"
          onclick={toggleLike}
        >
          {#if tweenRibbon.current > 240}
            <span
              class="ribbonContent"
              style="font-size: {ribbonFontSize(likes)}px;"
            >
              {likes > 0 ? likes : ""}
            </span>
          {/if}
          {#if tweenRibbon.current > 21}
            <span
              class="ribbonTail {tweenRibbon.current > 150
                ? 'ribbonTailLong'
                : 'ribbonTailShort'}"
            ></span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Sticky note, clipped to a tab until pulled out. -->
    <form
      id="highlight-note-form"
      method="POST"
      action="?/note"
      use:enhance={noteDone}
      class={["note-drawer", { ready: flipCover, open: flipCover && showNote }]}
      inert={!flipCover}
    >
      <input type="hidden" name="id" value={highlight.id} />
      <button
        type="button"
        class={["note-tape", { dirty: noteDirty }]}
        aria-label="Save note"
        title="Save note"
        inert={!flipCover || !showNote}
        onclick={() => void saveNote()}
      >
        <IconCheck class="size-3" aria-hidden="true" />
        <span>{noteDirty ? "Save" : "Saved"}</span>
      </button>

      <div class="note-page" inert={!flipCover || !showNote}>
        <textarea
          name="note"
          aria-label="Note for this highlight"
          placeholder="Write a note…"
          bind:value={noteContent}
          oninput={rememberNoteDraft}
          onblur={() => void saveNote()}></textarea>
      </div>

      <button
        type="button"
        class="note-toggle"
        aria-label={showNote ? "Hide the note" : "Show the note"}
        aria-expanded={showNote}
        onclick={() => {
          showNote = !showNote;
          if (!showNote) void saveNote();
        }}
      >
      </button>
    </form>
  {:else}
    <div class="flex min-h-0 flex-1 items-center justify-center px-4">
      <div
        class="dark flex w-full max-w-sm flex-col items-center gap-2 rounded-[2px] border border-white/10 px-6 py-8 text-center"
      >
        <IconBookmarkSimple
          class="size-7 text-emerald-300"
          aria-hidden="true"
        />
        <p class="text-xs font-semibold text-white">No highlights yet</p>
        <p class="max-w-[30ch] text-[11px] leading-relaxed text-slate-300">
          Import your Kindle clippings and they will be bound into a book here.
        </p>
        <button
          type="button"
          onclick={openInsert}
          class="mt-2 h-8 cursor-pointer rounded-[2px] bg-emerald-400 px-4 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Import highlights
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Programmatic form actions: values are written just before requestSubmit. -->
<form
  id="highlight-select-form"
  method="POST"
  action="?/select"
  use:enhance={selectDone}
  hidden
>
  <input type="hidden" name="id" />
</form>
<form
  id="highlight-like-form"
  method="POST"
  action="?/like"
  use:enhance={likeDone}
  hidden
>
  <input type="hidden" name="id" />
  <input type="hidden" name="delta" />
</form>
<form
  id="highlight-delete-form"
  method="POST"
  action="?/delete"
  use:enhance={deleteDone}
  hidden
>
  <input type="hidden" name="id" />
</form>

<!-- === Edit ============================================================ -->
<Modal bind:showModal={showEdit} label="Edit highlight">
  <div class={PANEL} style="width: {dialogWidth}px; height: {dialogHeight}px;">
    <div class={modalHeader}>
      <p class={modalTitle}>Edit highlight</p>
      <button
        type="button"
        onclick={() => (showEdit = false)}
        aria-label="Close"
        class={CLOSE}
      >
        <IconX class="size-4" aria-hidden="true" />
      </button>
    </div>

    {#if highlightEdit}
      <form
        method="post"
        action="?/save"
        class="grid min-h-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
        use:enhance={saveDone}
      >
        <input type="hidden" name="id" value={highlightEdit.id} />

        <div class="flex min-h-0 flex-col gap-4">
          <label class="block">
            <span class={LABEL}>Book title</span>
            <input
              type="text"
              name="bookTile"
              autocomplete="off"
              class={EDIT_FIELD}
              bind:value={highlightEdit.bookTile}
            />
          </label>

          <label class="block">
            <span class={LABEL}>Authors</span>
            <input
              type="text"
              name="authors"
              autocomplete="off"
              class={EDIT_FIELD}
              bind:value={highlightEdit.authors}
            />
          </label>

          <label class="block">
            <span class={LABEL}>Date of creation</span>
            <input
              type="text"
              name="dateOfCreation"
              autocomplete="off"
              class={EDIT_FIELD}
              bind:value={highlightEdit.dateOfCreation}
            />
          </label>

          <label class="block">
            <span class={LABEL}>Likes</span>
            <input
              type="number"
              name="like"
              min="0"
              class={EDIT_FIELD}
              bind:value={highlightEdit.like}
            />
          </label>
        </div>

        <div class="flex min-h-0 flex-col gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="mr-2 text-[10px] font-medium text-black/70"
              >Content</span
            >
            {#each [{ label: "Open paragraph", tag: "<p>" }, { label: "Close paragraph", tag: "</p>" }, { label: "Open quote", tag: "<cite>" }, { label: "Close quote", tag: "</cite>" }] as helper (helper.label)}
              <button
                type="button"
                class="h-7 cursor-pointer rounded-[2px] border border-slate-300 bg-slate-50 px-2 font-mono text-[10px] text-black/70 transition-colors hover:bg-slate-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2547ff]"
                aria-label="Copy {helper.label} tag"
                onclick={() =>
                  navigator.clipboard.writeText(helper.tag).catch(() => {})}
              >
                {helper.tag}
              </button>
            {/each}
          </div>
          <textarea
            name="content"
            spellcheck="false"
            class="book-field min-h-45 flex-1 resize-none"
            bind:value={highlightEdit.content}></textarea>
        </div>

        <div class="mt-2 flex items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            class="{BUTTON} bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            class={QUIET}
            onclick={() => (showEdit = false)}
          >
            Cancel
          </button>
        </div>
      </form>
    {/if}
  </div>
</Modal>

<!-- === Import ========================================================== -->
<Modal bind:showModal={showInsert} label="Import Kindle highlights">
  <div class={PANEL} style="width: {dialogWidth}px; height: {dialogHeight}px;">
    <div class={modalHeader}>
      <p class={modalTitle}>Import highlights</p>
      <button
        type="button"
        onclick={() => (showInsert = false)}
        aria-label="Close"
        class={CLOSE}
      >
        <IconX class="size-4" aria-hidden="true" />
      </button>
    </div>

    <div
      class="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-4 sm:grid-cols-2"
    >
      <form
        method="post"
        action="?/insert"
        class="flex min-h-0 flex-col gap-3"
        use:enhance={insertDone}
      >
        <label class="flex min-h-0 flex-1 flex-col">
          <span class={LABEL}>Kindle clippings</span>
          <textarea
            name="content"
            required
            spellcheck="false"
            placeholder="Paste the contents of My Clippings.txt"
            class="{FIELD} min-h-40 flex-1 resize-none font-mono text-[10px] leading-relaxed"
          ></textarea>
        </label>

        <div class="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            class="{BUTTON} bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {isSubmitting ? "Importing…" : "Import"}
          </button>
          <button
            type="button"
            class={QUIET}
            onclick={() => (showInsert = false)}
          >
            Cancel
          </button>
        </div>
      </form>

      <div class="flex min-h-0 flex-col border-slate-200 sm:border-l sm:pl-6">
        {#if data.recent.length > 0}
          <p
            class="mb-2 text-[10px] font-semibold tracking-[0.18em] text-black/60 uppercase"
          >
            Latest highlights · {data.total} total
          </p>
          <div
            class="min-h-0 flex-1 overflow-auto rounded-[2px] border border-slate-300"
          >
            <table class="w-full text-left text-[10px]">
              <thead class="bg-slate-50 text-black/60">
                <tr>
                  <th scope="col" class="px-2 py-1.5 font-medium">Book</th>
                  <th scope="col" class="px-2 py-1.5 font-medium">Added</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                {#each data.recent as item (item.id)}
                  <tr class="text-black/80">
                    <td class="max-w-40 truncate px-2 py-1.5"
                      >{item.bookTile}</td
                    >
                    <td class="px-2 py-1.5 whitespace-nowrap tabular-nums">
                      {prettyStamp(item.dateOfCreation)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div
            class="flex flex-1 items-center justify-center rounded-[2px] border border-dashed border-slate-300 px-4 text-center"
          >
            <p class="max-w-[24ch] text-[10px] leading-relaxed text-black/60">
              Imported highlights will be listed here.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</Modal>

<!-- === Delete ========================================================== -->
<Modal bind:showModal={showDelete} label="Delete highlight">
  <div
    class="w-[min(94vw,22rem)] overflow-hidden rounded-[2px] light text-[#11130f] shadow-2xl ring-1 ring-black/15"
  >
    <div class={modalHeader}>
      <p class={modalTitle}>Delete highlight</p>
      <button
        type="button"
        onclick={() => (showDelete = false)}
        aria-label="Close"
        class={CLOSE}
      >
        <IconX class="size-4" aria-hidden="true" />
      </button>
    </div>
    <div class="p-5">
      <p class="text-xs leading-relaxed text-black/70">
        “{highlight?.bookTile ?? ""}” will be removed from your book. This
        cannot be undone.
      </p>
      <div class="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          class={QUIET}
          onclick={() => (showDelete = false)}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={deleting}
          class="{BUTTON} bg-red-600 text-white hover:bg-red-500"
          onclick={deleteHighlight}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
</Modal>

<svelte:window onkeydown={onKeyDown} onresize={onResize} />

<style lang="postcss">
  .book {
    perspective: 6000px;
    position: relative;
    display: flex;
    justify-content: center;
  }

  .flip {
    transform-style: preserve-3d;
    position: absolute;
    bottom: 12px;
    top: 12px;
  }

  .flipCover {
    bottom: 0;
    top: 0;
  }

  .frontPage {
    position: absolute;
    user-select: text;
    top: 0;
    left: 0;
    z-index: 0;
    backface-visibility: hidden;
    box-shadow: 2px 0 2px rgba(0, 0, 0, 0.45);
  }

  .backPage {
    position: absolute;
    user-select: text;
    backface-visibility: hidden;
    top: 0;
    left: 0;
    z-index: 1;
    transform: rotateY(180deg);
    box-shadow: -2px 0 2px rgba(0, 0, 0, 0.45);
  }

  .flipCover .frontPage {
    border-top-right-radius: 2px;
    border-bottom-right-radius: 2px;
    overflow: hidden;
  }

  .flipCover .backPage {
    border-top-left-radius: 2px;
    border-bottom-left-radius: 2px;
    overflow: hidden;
  }

  .frontCoverPaper {
    background: linear-gradient(
      to right,
      #efebe5 0%,
      #efebe5 90%,
      #e9e4dc 97%,
      #d2cdc3 100%
    );
  }

  .backCoverPaper {
    background: linear-gradient(
      to right,
      #d2cdc3 0%,
      #e9e4dc 3%,
      #efebe5 10%,
      #efebe5 100%
    );
  }

  .bookShadow {
    position: absolute;
    z-index: 0;
    pointer-events: none;
    left: -4%;
    right: -4%;
    bottom: -8px;
    height: 24px;
    background: radial-gradient(
      ellipse at 50% 50%,
      rgba(0, 0, 0, 0.6) 0%,
      rgba(0, 0, 0, 0.3) 50%,
      rgba(0, 0, 0, 0) 85%
    );
    filter: blur(4px);
  }

  .frontCover {
    position: relative;
    background: #0a0905;
  }

  .infoPage {
    background: #0a0905;
    padding: 12px 0 12px 12px;
  }

  .infoPageContent {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .frontCover::after {
    content: "";
    position: absolute;
    top: 0;
    left: 9px;
    bottom: 0;
    width: 2px;
    background: rgba(81, 81, 81, 0.3);
    box-shadow: 1px 0 3px rgba(255, 255, 255, 0.1);
  }

  .backCover {
    position: absolute;
    height: 100%;
    width: 50%;
    top: 0;
    right: 0;
    background: #0a0905;
    border-top-right-radius: 2px;
    border-bottom-right-radius: 2px;
    padding: 12px 12px 12px 0;
  }

  .pageButton {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 60px;
    cursor: pointer;
    background: transparent;
    border: 0;
    padding: 0;
  }

  .pageButton:disabled {
    cursor: not-allowed;
  }

  .pageButton:focus-visible {
    outline: 2px solid #2547ff;
    outline-offset: -2px;
  }

  .frontPage .pageButton {
    right: 0;
  }

  .backPage .pageButton {
    left: 0;
  }

  .flipCover .backPage .pageButton {
    top: 12px;
    bottom: 12px;
    left: 12px;
  }

  .backCover .pageButton {
    top: 12px;
    bottom: 12px;
    right: 12px;
  }

  /* Info page type */
  .info-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 20px;
    text-align: center;
  }

  .book-title {
    margin-top: 8px;
    font-family: "Libre Baskerville", Georgia, serif;
    font-size: 36px;
    line-height: 1.4;
    font-weight: 400;
    color: #1e1915;
  }

  .book-authors {
    margin: 3px 0 6px;
    font-family: "Libre Baskerville", Georgia, serif;
    font-size: 20px;
    line-height: 1.3;
    font-weight: 400;
    color: #1e1915;
  }

  .book-meta {
    font-size: 11px;
    line-height: 1.4;
    color: #4f4f4d;
  }

  .book-description {
    font-size: 11px;
    line-height: 1.4;
    color: #1e1915;
  }

  .clamped {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 2px;
    padding: 2px 4px 4px;
  }

  .tool-btn {
    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    color: #4f4f4d;
    cursor: pointer;
    transition:
      color 150ms,
      background-color 150ms;
  }

  .tool-btn:hover:not(:disabled) {
    color: #1e1915;
    background: rgba(0, 0, 0, 0.06);
  }

  .tool-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .tool-btn-danger:hover {
    color: #b91c1c;
    background: rgba(185, 28, 28, 0.08);
  }

  .tool-btn:focus-visible {
    outline: 2px solid #047857;
    outline-offset: 1px;
  }

  /* Ribbon */
  .ribbon {
    position: relative;
    top: -9px;
    left: 21px;
    width: 36px;
    user-select: none;
    border-top-left-radius: 2px;
    cursor: pointer;
  }

  .ribbonContent {
    font-family: "Bookerly", serif;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    user-select: none;
  }

  .ribbon::before {
    content: "";
    position: absolute;
    height: 9px;
    width: 6px;
    right: -6px;
    top: 0;
    z-index: 1;
    border-bottom: 9px solid #600909;
    border-right: 6px solid transparent;
  }

  .ribbonShort {
    background: #a90909;
  }

  .ribbonLong {
    background: linear-gradient(
      180deg,
      rgb(169, 9, 9) 0%,
      rgb(229, 33, 28) 20%,
      rgb(164, 5, 2) 40%,
      rgb(229, 10, 0) 100%
    );
  }

  .ribbonTail {
    position: absolute;
    bottom: -21px;
    left: 0;
    width: 0;
    height: 0;
    z-index: inherit;
    border-left: 18px solid transparent;
    border-right: 18px solid transparent;
  }

  .ribbonTailLong {
    border-top: 21px solid #e40900;
  }

  .ribbonTailShort {
    border-top: 21px solid #a90909;
  }

  /* Note drawer */
  .note-drawer {
    position: absolute;
    top: 40px;
    bottom: 16px;
    right: 0;
    z-index: 30;
    width: min(300px, 82vw);
    transform: translateX(100%);
    transition: transform 300ms ease-in-out;
  }

  .note-drawer.ready {
    transform: translateX(calc(100% - 26px));
  }

  .note-drawer.open {
    transform: translateX(0);
  }

  .note-page {
    position: relative;
    height: 100%;
    overflow: hidden;
    border: 1px solid #e0e0e0;
    border-right: 0;
    border-radius: 2px 0 0 2px;
    background-color: #fff;
    box-shadow:
      -6px 0 14px rgba(0, 0, 0, 0.35),
      0 4px 8px rgba(0, 0, 0, 0.5);
  }

  /* Folded paper edge so the peeking strip reads as a page, not a panel. */
  .note-page::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 12px;
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.09),
      rgba(0, 0, 0, 0.02) 55%,
      transparent
    );
    pointer-events: none;
  }

  .note-tape {
    position: absolute;
    top: -18px;
    left: 50%;
    z-index: 4;
    display: flex;
    width: 120px;
    height: 35px;
    align-items: center;
    justify-content: center;
    gap: 3px;
    cursor: pointer;
    transform: translateX(-50%) rotate(3deg);
    background-color: rgba(108, 212, 255, 0.82);
    box-shadow: 0 -3px 3px rgba(0, 0, 0, 0.3);
    color: rgba(8, 47, 66, 0.55);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    transition:
      background-color 150ms,
      color 150ms,
      box-shadow 150ms,
      transform 150ms;
  }

  .note-tape:hover {
    background-color: rgba(126, 222, 255, 0.95);
    color: rgba(8, 47, 66, 0.85);
    box-shadow: 0 -3px 4px rgba(0, 0, 0, 0.35);
  }

  .note-tape:active {
    transform: translateX(-50%) rotate(3deg) translateY(2px);
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.25);
  }

  .note-tape:focus-visible {
    outline: 2px solid #047857;
    outline-offset: 2px;
  }

  .note-tape.dirty {
    color: rgba(8, 47, 66, 0.85);
    box-shadow:
      0 -3px 3px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.35) inset;
  }

  .note-page textarea {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 30px 14px 16px 30px;
    font-family: "Comic Sans MS", cursive, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #333;
    outline: none;
    resize: none;
    background: transparent;
  }

  .note-page textarea::placeholder {
    color: rgba(30, 25, 21, 0.3);
  }

  .note-toggle {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 3;
    display: flex;
    width: 26px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 2px 0 0 2px;
    color: rgba(30, 25, 21, 0.3);
    font-size: 14px;
    line-height: 1;
    transition:
      color 150ms,
      background-color 150ms;
  }

  /* Content editor imitates a printed page so the highlight reads the way it
     will once bound into the book. */
  .book-field {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid rgba(0, 0, 0, 0.14);
    border-radius: 2px;
    background: linear-gradient(to right, #f3efe9 0%, #fbf9f5 5%, #fbf9f5 100%);
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.07),
      0 1px 0 rgba(255, 255, 255, 0.35);
    color: #1e1915;
    font-family: "Bookerly", serif;
    font-size: 13px;
    line-height: 1.7;
    outline: none;
    caret-color: #1e1915;
    transition:
      border-color 150ms,
      box-shadow 150ms;
  }

  .book-field::placeholder {
    color: rgba(30, 25, 21, 0.35);
  }

  .book-field::selection,
  .note-page textarea::selection {
    background-color: #fef135;
    color: #1e1915;
  }

  @media (prefers-reduced-motion: reduce) {
    .note-drawer {
      transition: none;
    }
  }
</style>
