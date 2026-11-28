import { eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.ts";
import { dictionary } from "#lib/server/db/schema.ts";
import type { WikiTranslationType } from "#lib/translation.ts";

const POS_LABELS: Record<string, string> = {
  n: "Danh từ",
  adj: "Tính từ",
  v: "Động từ",
  adv: "Trạng từ",
  phrv: "Cụm động từ",
  phrase: "Cụm từ",
  other: "Khác",
  abbr: "Viết tắt",
  interject: "Thán từ",
  interjection: "Thán từ",
  p: "Giới từ",
  pro: "Đại từ",
  pp: "Phân từ",
  prefix: "Tiền tố",
  suffix: "Hậu tố",
  conjun: "Liên từ",
  determiner: "Từ hạn định",
  symbol: "Ký hiệu",
  number: "Số từ",
  comb: "Kết hợp",
  "combining form": "Kết hợp",
  "short form": "Dạng rút gọn",
  "cụm từ": "Cụm từ",
  adj_adv: "Tính từ, Trạng từ",
  pro_ask: "Đại từ nghi vấn",
  pro_relation: "Đại từ quan hệ",
};

export function normalizeDictionaryWord(word: string): string {
  return word.trim().normalize("NFC").toLowerCase();
}

function parsePro(pro: string | null): {
  labels: string[];
  pronunciation: string;
} {
  if (!pro) return { labels: [], pronunciation: "" };

  const [rawPronunciation = "", rawTags = ""] = pro.split("#;#");
  const pronunciation = rawPronunciation
    .trim()
    .replace(/^(\[[^\]]+\])\s+\1$/, "$1");

  const labels: string[] = [];
  for (const raw of rawTags.split(",")) {
    const tag = raw.trim().toLowerCase().replace(/\d+$/, "");
    if (!tag || tag === "." || tag === "normal" || tag.startsWith("idiom"))
      continue;
    const label = POS_LABELS[tag] ?? tag;
    if (!labels.includes(label)) labels.push(label);
  }

  return { labels, pronunciation: pronunciation === "." ? "" : pronunciation };
}

function parseStoredMean(
  value: WikiTranslationType[] | string | null,
  pro: string | null
): WikiTranslationType[] {
  if (Array.isArray(value)) {
    const entries: WikiTranslationType[] = [];
    for (const entry of value) {
      if (!entry || typeof entry.partOfSpeech !== "string" || !Array.isArray(entry.translation)) continue;
      const translation = entry.translation
        .filter((line): line is string => typeof line === "string")
        .map((line) => line.replace(/^\d+\.(?!\d)\s*/, "").trim())
        .filter(Boolean);
      if (translation.length > 0) {
        entries.push({ partOfSpeech: entry.partOfSpeech, translation });
      }
    }
    return entries;
  }
  if (typeof value !== "string" || !value) return [];

  const translation = value
    .replace(/#$/, "")
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean);
  if (translation.length === 0) return [];

  const { labels } = parsePro(pro);
  const heading = labels.length > 0 ? labels.join(", ") : "Nghĩa";
  return [{ partOfSpeech: heading, translation }];
}

export async function lookupEnVn(word: string): Promise<WikiTranslationType[]> {
  const normalized = normalizeDictionaryWord(word);
  if (normalized.length < 1 || normalized.length > 120) return [];

  const [row] = await db
    .select({ pro: dictionary.pro, mean: dictionary.mean })
    .from(dictionary)
    .where(eq(dictionary.word, normalized))
    .limit(1);
  if (!row) return [];

  return parseStoredMean(row.mean, row.pro);
}
