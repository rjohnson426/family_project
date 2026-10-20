import { get, put } from "@vercel/blob";

// Site-wide count of AI edits per day (Central time). Kept as a small JSON file in the Blob
// store so every serverless instance sees it; two edits at the same instant can overshoot by
// one, which is fine for a spending guard. Locally (no Blob token) it's kept in memory.

const memory = new Map<string, number>();

export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now); // YYYY-MM-DD
}

const key = (day: string) => `ai-usage/${day}.json`;

export async function usedToday(): Promise<number> {
  const day = today();
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memory.get(day) ?? 0;
  try {
    const res = await get(key(day), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return 0;
    return Number(JSON.parse(await new Response(res.stream).text()).count) || 0;
  } catch {
    return 0;
  }
}

/** Counts one edit if under the limit. Returns false when today's limit is already reached. */
export async function takeOne(limit: number): Promise<boolean> {
  const day = today();
  const used = await usedToday();
  if (used >= limit) return false;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    memory.set(day, used + 1);
    return true;
  }
  await put(key(day), JSON.stringify({ count: used + 1 }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return true;
}

/** Hands back an edit that failed, so errors don't eat into the family's daily allowance. */
export async function giveBack(): Promise<void> {
  const day = today();
  const used = await usedToday();
  if (used <= 0) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    memory.set(day, used - 1);
    return;
  }
  await put(key(day), JSON.stringify({ count: used - 1 }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}
