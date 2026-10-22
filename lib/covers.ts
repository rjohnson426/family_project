import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "./treeDb";
import { dbStore } from "./treeStore";

// Album covers chosen by the family: folder path -> photo id. They live next to the family tree
// in Postgres (table album_covers); locally they go to .data/covers.json so testing never touches
// the real ones. A folder with no row keeps its default cover (its first photo).

const LOCAL = path.resolve(process.cwd(), ".data/covers.json");
export type Covers = Record<string, string>;

async function ensure() {
  await query(`CREATE TABLE IF NOT EXISTS album_covers (
    path text PRIMARY KEY,
    photo_id text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function getCovers(): Promise<Covers> {
  try {
    if (dbStore()) {
      await ensure();
      const rows = await query("SELECT path, photo_id FROM album_covers");
      return Object.fromEntries(rows.map((r) => [String(r.path), String(r.photo_id)]));
    }
    return JSON.parse(await readFile(LOCAL, "utf8"));
  } catch {
    return {};
  }
}

export async function setCover(folderPath: string, photoId: string): Promise<void> {
  if (dbStore()) {
    await ensure();
    await query(
      `INSERT INTO album_covers (path, photo_id) VALUES ($1, $2)
       ON CONFLICT (path) DO UPDATE SET photo_id = $2, updated_at = now()`,
      [folderPath, photoId],
    );
    return;
  }
  const all = await getCovers();
  all[folderPath] = photoId;
  await mkdir(path.dirname(LOCAL), { recursive: true });
  await writeFile(LOCAL, JSON.stringify(all));
}
