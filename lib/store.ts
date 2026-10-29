import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import { isUploadId } from "./uploads";
import { hiddenIds } from "./removals";
import { hidePhotos, mergeAlbums, type Manifest, type Size } from "./manifest";

// Production reads the private Vercel Blob store. Without a token (local dev), it reads the
// export folder next door, so the site works before anything is uploaded.
export const LOCAL_EXPORT = path.resolve(process.cwd(), "../family_facial_recognition/data/web_export");
export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const MANIFEST_TTL_MS = 5 * 60 * 1000;
let cached: { manifest: Manifest; at: number } | null = null;

/** The library: the exported manifest plus the family's uploads. A broken uploads database never hides the exported photos. */
export async function getManifest(): Promise<Manifest> {
  const library = await getUnhiddenManifest();
  try {
    return hidePhotos(library, await hiddenIds());
  } catch (e) {
    console.error("Removal list unavailable", e);
    return library;
  }
}

async function getUnhiddenManifest(): Promise<Manifest> {
  const base = await getBaseManifest();
  try {
    const [{ listUploads }, { getNamedPeople }, { mergeUploads }] = await Promise.all([
      import("./uploadsStore"), import("./people"), import("./uploads"),
    ]);
    const uploads = await listUploads();
    return uploads.length ? mergeUploads(base, uploads, await getNamedPeople()) : base;
  } catch (e) {
    console.error("Uploads unavailable", e);
    return base;
  }
}

async function getBaseManifest(): Promise<Manifest> {
  if (cached && Date.now() - cached.at < MANIFEST_TTL_MS) return cached.manifest;
  let text: string;
  if (blobEnabled()) {
    const res = await get("manifest.json", { access: "private", useCache: false });
    if (!res) throw new Error("manifest.json is missing from the Blob store; run `npm run sync`");
    text = await new Response(res.stream).text();
  } else {
    text = await readFile(path.join(LOCAL_EXPORT, "manifest.json"), "utf8");
  }
  cached = { manifest: mergeAlbums(JSON.parse(text)), at: Date.now() };
  return cached.manifest;
}

export async function readPhoto(
  id: string,
  size: Size,
): Promise<{ body: ReadableStream; length?: number } | null> {
  if (isUploadId(id)) return (await import("./uploadsStore")).readUploadImage(id, size);
  const key = `photos/${id}/${size}.jpg`;
  if (blobEnabled()) {
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
