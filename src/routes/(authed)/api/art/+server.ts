import { json } from "@sveltejs/kit";
import { getDailyArt } from "#lib/server/dailyart.ts";
import type { RequestHandler } from "./$types";

/** `?start` reads The Idyll; `?page=` continues from a client-held DailyArt URL. */
export const GET: RequestHandler = async ({ fetch, setHeaders, url }) => {
  setHeaders({ "cache-control": "no-store" });
  return json(
    await getDailyArt(fetch, {
      start: url.searchParams.has("start"),
      page: url.searchParams.get("page"),
    }),
  );
};
