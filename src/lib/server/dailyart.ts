import { load } from "cheerio";
import { DEFAULT_ART, type ArtImage } from "#lib/art.ts";

/**
 * DailyArt has no feed: each painting's page ends with "also on DailyArt"
 * tiles. The first read of a visit is The Idyll; after that the walk follows a
 * random tile from the page it just read. The next URL is returned to the
 * client so the walk stays per-visitor, not server-global.
 */
const START_URL = "https://www.getdailyart.com/en/24707/mykola-pymonenko/the-idyll";
const UPSTREAM_TIMEOUT_MS = 8_000;

export type DailyArtResult = { image: ArtImage; next: string | null };

/** Take the first image candidate and make it absolute. */
function imageUrl(value: string | undefined, base: string): string {
  const first = value?.trim().split(/\s+/)[0]?.replace(/,$/, "");
  if (!first) return "";

  try {
    return new URL(first, base).href;
  } catch {
    return "";
  }
}

function allowedPageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.getdailyart.com") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export async function getDailyArt(
  fetchFn: typeof fetch = fetch,
  { start = false, page }: { start?: boolean; page?: string | null } = {},
): Promise<DailyArtResult> {
  const pageUrl = start ? START_URL : (allowedPageUrl(page ?? null) ?? START_URL);

  try {
    const response = await fetchFn(pageUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "cache-control": "no-cache",
        "user-agent": "Mozilla/5.0 (compatible; svelte-opencode/1.0)",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) return { image: DEFAULT_ART, next: null };

    const $ = load(await response.text());
    const text = (selector: string) =>
      $(selector).first().text().replace(/\s+/g, " ").trim();

    const image: ArtImage = {
      mainImage: imageUrl($(".main-image img").attr("srcset"), pageUrl),
      shareDate: text(".main-description__share-date"),
      title: text(".main-description__title"),
      attr: text(".main-description__attr"),
      authorImage: imageUrl($(".main-description__author img").attr("src"), pageUrl),
      author: text(".main-description__author"),
      authorYears: text(".main-description__author-years"),
      // Third-party caption text is rendered as text, never as markup.
      content: $(".main-description__text-content p")
        .map((_, paragraph) => $(paragraph).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean),
    };

    if (!image.mainImage || !image.title) return { image: DEFAULT_ART, next: null };

    const also = $(".also__item a").toArray();
    const picked = also[Math.floor(Math.random() * also.length)];
    const href = picked ? $(picked).attr("href") : undefined;
    let next: string | null = null;
    if (href) {
      try {
        next = allowedPageUrl(new URL(href, pageUrl).href);
      } catch {
        next = null;
      }
    }

    return { image, next };
  } catch {
    return { image: DEFAULT_ART, next: null };
  }
}
