import { load } from "cheerio";

/**
 * Windows Spotlight has no feed: each image page ends with a "related posts"
 * list. The walk follows a random one, one request per change. The next URL is
 * returned to the client so the walk stays per-visitor, not server-global.
 */
const SITE = "https://windows10spotlight.com";
const START_URL = `${SITE}/images/28991`;
const UPSTREAM_TIMEOUT_MS = 8_000;

export type SpotlightImage = { url: string; title: string; place: string };
export type SpotlightResult = { image: SpotlightImage; next: string | null };

/** An empty URL tells the client to keep the wallpaper already on the wall. */
const FALLBACK: SpotlightImage = { url: "", title: "", place: "" };

function httpsUrl(value: string | undefined, base: string): string {
  if (!value) return "";

  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function allowedPageUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "windows10spotlight.com" ||
      !url.pathname.startsWith("/images/")
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export async function getSpotlight(
  fetchFn: typeof fetch = fetch,
  { start = false, page }: { start?: boolean; page?: string | null } = {},
): Promise<SpotlightResult> {
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

    if (!response.ok) return { image: FALLBACK, next: null };

    const $ = load(await response.text());
    const text = (selector: string) =>
      $(selector).first().text().replace(/\s+/g, " ").trim();

    const image: SpotlightImage = {
      url: httpsUrl($(".entry a").first().attr("href"), SITE),
      title: text("h1"),
      place: text(".date"),
    };

    if (!image.url) return { image: FALLBACK, next: null };

    const related = $(".relatedposts a").toArray();
    const picked = related[Math.floor(Math.random() * related.length)];
    const href = picked ? $(picked).attr("href") : undefined;
    let next: string | null = null;
    if (href) {
      try {
        next = allowedPageUrl(new URL(href, SITE).href);
      } catch {
        next = null;
      }
    }

    return { image, next };
  } catch {
    return { image: FALLBACK, next: null };
  }
}
