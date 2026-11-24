import { DEFAULT_ART, type ArtImage } from "#lib/art.ts";
import { addToast } from "#lib/toast.svelte.ts";

type ArtStep = { image: ArtImage; next: string | null };

/**
 * The walk always starts on the built-in painting, then The Idyll, then a
 * random painting from there. Every visit starts over, so going back is instant.
 */
export const art = $state<{
  image: ArtImage;
  loading: boolean;
  hasPrevious: boolean;
}>({
  image: DEFAULT_ART,
  loading: false,
  hasPrevious: false,
});

const history: ArtStep[] = [];
let index = -1;
/** Bumped by every visit, so a request from the last one cannot land here. */
let generation = 0;

async function step(direction: 1 | -1) {
  const target = index + direction;

  if (target >= -1 && target < history.length) {
    index = target;
    art.image = index === -1 ? DEFAULT_ART : history[index].image;
    art.hasPrevious = index > -1;
    return;
  }

  if (direction < 0 || art.loading) return;

  const from = index;
  const fromNext = index >= 0 ? history[index].next : null;
  const endpoint =
    history.length === 0
      ? "/api/art?start"
      : fromNext
        ? `/api/art?page=${encodeURIComponent(fromNext)}`
        : "/api/art?start";

  const visit = generation;
  art.loading = true;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`/api/art answered ${response.status}`);

    const stepResult = (await response.json()) as ArtStep;
    if (visit !== generation) return;

    history.push(stepResult);

    // The reader may have walked back while the request was in flight.
    if (index === from) {
      index = history.length - 1;
      art.image = history[index].image;
      art.hasPrevious = index > -1;
    }
  } catch {
    // Offline or the magazine is down: the painting on the wall stays put.
    if (visit === generation) {
      addToast({
        type: "error",
        title: "Could not reach DailyArt",
        message: "Showing the painting already on the wall.",
      });
    }
  } finally {
    if (visit === generation) art.loading = false;
  }
}

/** Opens the walk on the built-in painting, whatever was read last visit. */
export function showArt() {
  generation += 1;
  history.length = 0;
  index = -1;
  art.image = DEFAULT_ART;
  art.hasPrevious = false;
  art.loading = false;
}

export function nextArt() {
  void step(1);
}

export function prevArt() {
  void step(-1);
}
