// Uploads the `export-web` output to the private Vercel Blob store.
//
//   npm run sync               upload new/changed photos, then the manifest, then prune
//   npm run sync -- --dry-run  report what would change
//
// A photo's three files are re-uploaded only when its hash differs from the manifest already in
// Blob (or a file is missing). The manifest goes up last, so the site never points at photos
// that aren't uploaded yet. Needs BLOB_READ_WRITE_TOKEN in .env.local.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

const EXPORT_DIR = path.resolve(
  process.env.WEB_EXPORT_DIR ?? path.join(import.meta.dirname, "../../family_facial_recognition/data/web_export"),
);
const SIZES = ["full", "large", "thumb"];
const CONCURRENCY = 8;
const dryRun = process.argv.includes("--dry-run");

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set (add it to .env.local).");
  process.exit(1);
}

const manifestText = await readFile(path.join(EXPORT_DIR, "manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);

async function remoteManifest() {
  try {
    const res = await get("manifest.json", { access: "private", useCache: false });
    return res?.statusCode === 200 ? JSON.parse(await new Response(res.stream).text()) : null;
  } catch {
    return null;
  }
}

async function remotePaths() {
  const paths = new Set();
  let cursor;
  do {
    const page = await list({ prefix: "photos/", cursor, limit: 1000 });
    page.blobs.forEach((b) => paths.add(b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

async function pool(items, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

const [previous, existing] = await Promise.all([remoteManifest(), remotePaths()]);
const ids = Object.keys(manifest.photos);
const toUpload = ids.filter(
  (id) =>
    previous?.photos?.[id]?.hash !== manifest.photos[id].hash ||
    SIZES.some((s) => !existing.has(`photos/${id}/${s}.jpg`)),
);
const keep = new Set(ids);
const toDelete = [...existing].filter((p) => !keep.has(p.split("/")[1]));

console.log(`${ids.length} photos in export · ${toUpload.length} to upload · ${toDelete.length} stale files to delete`);
if (dryRun) process.exit(0);

let done = 0;
await pool(toUpload, async (id) => {
  for (const size of SIZES) {
    const body = await readFile(path.join(EXPORT_DIR, "photos", id, `${size}.jpg`));
    await put(`photos/${id}/${size}.jpg`, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg",
    });
  }
  if (++done % 100 === 0 || done === toUpload.length) console.log(`uploaded ${done}/${toUpload.length}`);
});

await put("manifest.json", manifestText, {
  access: "private",
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
  cacheControlMaxAge: 60,
});
console.log("manifest uploaded");

for (let i = 0; i < toDelete.length; i += 500) await del(toDelete.slice(i, i + 500));
if (toDelete.length) console.log(`deleted ${toDelete.length} stale files`);
