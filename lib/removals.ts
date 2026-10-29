import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "./treeDb";
import { dbStore } from "./treeStore";

// Photos the family asked to have removed. A request hides the photo from the site at once (the
// files stay untouched in the Blob store and in family_facial_recognition), and a pull request
// tells Rob, who can restore it by deleting the row. Rows live next to the family tree in
// Postgres (table photo_removals); locally they go to .data/removals.json.

const LOCAL = path.resolve(process.cwd(), ".data/removals.json");

export type Removal = { photoId: string; page: string; at: string };

async function ensure() {
  await query(`CREATE TABLE IF NOT EXISTS photo_removals (
    photo_id text PRIMARY KEY, page text NOT NULL DEFAULT '',
    requested_at timestamptz NOT NULL DEFAULT now()
  )`);
}

async function readLocal(): Promise<Removal[]> {
  return readFile(LOCAL, "utf8").then(JSON.parse, () => []);
}

let cache: { at: number; ids: string[] } | null = null;

/** Ids of every removed photo, cached for a few seconds because every page view reads it. */
export async function hiddenIds(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 5000) return cache.ids;
  let ids: string[];
  if (dbStore()) {
    await ensure();
    ids = (await query("SELECT photo_id FROM photo_removals")).map((r) => String(r.photo_id));
  } else {
    ids = (await readLocal()).map((r) => r.photoId);
  }
  cache = { at: Date.now(), ids };
  return ids;
}

/** Hides a photo. Asking twice for the same photo is harmless. */
export async function hidePhoto(r: { photoId: string; page: string }): Promise<void> {
  if (dbStore()) {
    await ensure();
    await query(
      `INSERT INTO photo_removals (photo_id, page) VALUES ($1, $2) ON CONFLICT (photo_id) DO NOTHING`,
      [r.photoId, r.page],
    );
  } else {
    const all = await readLocal();
    if (!all.some((x) => x.photoId === r.photoId)) {
      all.push({ ...r, at: new Date().toISOString() });
      await mkdir(path.dirname(LOCAL), { recursive: true });
      await writeFile(LOCAL, JSON.stringify(all));
    }
  }
  cache = null;
}
