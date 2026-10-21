import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import { blobEnabled, LOCAL_EXPORT } from "./store";

// Like the tree itself, locally these come from the export folder, even when .env.local has the Blob token
// (before the first `npm run sync` after `export-people`, the store has no people files yet).
const fromBlob = () => blobEnabled() && process.env.NODE_ENV === "production";
import type { NamedPerson } from "./tree";

// The people already named in family_facial_recognition: `people.json` plus one cropped face per
// person, written by `export-people` and uploaded by `npm run sync`. Both stay in the private store.

export async function getNamedPeople(): Promise<NamedPerson[]> {
  try {
    let text: string;
    if (fromBlob()) {
      const res = await get("people/people.json", { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return [];
      text = await new Response(res.stream).text();
    } else {
      text = await readFile(path.join(LOCAL_EXPORT, "people/people.json"), "utf8");
    }
    const rows = JSON.parse(text) as { personId: number; name: string; folderPath?: string | null }[];
    return rows.map((r) => ({ personId: r.personId, name: r.name, folderPath: r.folderPath ?? null }));
  } catch {
    return [];
  }
}

export async function readFace(personId: number): Promise<{ body: ReadableStream; length?: number } | null> {
  const key = `people/${personId}.jpg`;
  if (fromBlob()) {
    const res = await get(key, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return { body: res.stream, length: res.blob.size };
  }
  const file = path.join(LOCAL_EXPORT, key);
  try {
    const { size: length } = await stat(file);
    return { body: Readable.toWeb(createReadStream(file)) as ReadableStream, length };
  } catch {
    return null;
  }
}
