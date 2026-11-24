import { fail, redirect } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.ts";
import { saddays } from "#lib/server/db/schema.ts";
import type { Actions, PageServerLoad } from "./$types";

/** Rows of `saddays` shown per page. */
const PAGE_SIZE = 15;

export type SadDay = {
  created_at: string;
  date: string;
  time: string;
};

function stamp(createdAt: string): Pick<SadDay, "date" | "time"> {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return { date: "", time: "" };

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")} ${part("dayPeriod")}`,
  };
}

export const load: PageServerLoad = async ({ url }) => {
  const requested = Number(url.searchParams.get("page"));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const rows = await db
    .select({ created_at: saddays.createdAt })
    .from(saddays)
    .orderBy(desc(saddays.createdAt));

  const stamps = rows.map((row) => row.created_at);
  const total = stamps.length;

  // The short page is the first one, so every later page holds PAGE_SIZE.
  const head = total % PAGE_SIZE || PAGE_SIZE;
  const pageCount = total === 0 ? 1 : 1 + Math.ceil((total - head) / PAGE_SIZE);

  if (page > pageCount) {
    const target = new URL(url);
    target.searchParams.set("page", String(pageCount));
    redirect(307, `${target.pathname}${target.search}`);
  }

  const size = page === 1 ? head : PAGE_SIZE;
  const offset = page === 1 ? 0 : head + (page - 2) * PAGE_SIZE;

  // Each page reads oldest -> newest, so the times run down the list.
  const pageRows: SadDay[] = stamps
    .slice(offset, offset + size)
    .reverse()
    .map((created_at) => ({ created_at, ...stamp(created_at) }));

  return { rows: pageRows, page, pageCount, total, offset };
};

export const actions: Actions = {
  add: async () => {
    try {
      await db.insert(saddays).values({ createdAt: new Date().toISOString() });
    } catch {
      return fail(500, { error: "Could not add the day." });
    }

    redirect(303, "/sad");
  },

  delete: async ({ request }) => {
    const createdAt = String((await request.formData()).get("created_at") ?? "").trim();

    if (!createdAt) {
      return fail(400, { error: "Pick a day to delete." });
    }

    try {
      await db.delete(saddays).where(eq(saddays.createdAt, createdAt));
    } catch {
      return fail(500, { error: "Could not delete that day." });
    }

    return { error: "" };
  },
};
