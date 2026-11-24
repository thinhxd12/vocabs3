import { json } from "@sveltejs/kit";
import { getSpotlight } from "#lib/server/spotlight.ts";
import type { RequestHandler } from "./$types";

/** `?start` reads image 28991; `?page=` continues from a client-held URL. */
export const GET: RequestHandler = async ({ fetch, setHeaders, url }) => {
  setHeaders({ "cache-control": "no-store" });
  return json(
    await getSpotlight(fetch, {
      start: url.searchParams.has("start"),
      page: url.searchParams.get("page"),
    }),
  );
};
