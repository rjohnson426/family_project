import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { get, put } from "@vercel/blob";
import { LOCAL_EXPORT } from "./store";
import { query } from "./treeDb";
import { dbStore } from "./treeStore";
import type { Size } from "./manifest";
import type { Centroid, Upload, UploadTag } from "./uploads";

// Where uploads live. Production: images in the private Blob store under `uploads/` (not `photos/`,
// which `npm run sync` prunes) and rows in Postgres next to the family tree. Locally, everything
// goes to .data/ so testing never touches the real library, the same rule as the tree and covers.

const blobImages = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN) && process.env.NODE_ENV === "production";
const DATA = path.resolve(process.cwd(), ".data");
const LOCAL_ROWS = path.join(DATA, "uploads.json");

export type FaceRow = { bbox: number[]; embedding: number[] };
type Sample = { uploadId: string; name: string; personId: number | null; embedding: number[] };
type LocalDb = { uploads: (Upload & { faces: FaceRow[] })[]; samples: Sample[] };

// ---------- rows ----------

let ensured: Promise<void> | null = null;
function ensure() {
  ensured ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS family_uploads (
      id text PRIMARY KEY, who text NOT NULL, filename text NOT NULL, w int NOT NULL, h int NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), tags jsonb NOT NULL DEFAULT '[]', faces jsonb NOT NULL DEFAULT '[]'
    )`);
    await query(`CREATE TABLE IF NOT EXISTS family_face_samples (
      id bigserial PRIMARY KEY, upload_id text NOT NULL, name text NOT NULL, person_id int, embedding jsonb NOT NULL
    )`);
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

let queue: Promise<unknown> = Promise.resolve();
async function local<T>(fn: (db: LocalDb) => T | Promise<T>, write = false): Promise<T> {
  const run = queue.then(async () => {
    const db: LocalDb = await readFile(LOCAL_ROWS, "utf8").then(JSON.parse, () => ({ uploads: [], samples: [] }));
    const out = await fn(db);
    if (write) {
      await mkdir(DATA, { recursive: true });
      await writeFile(LOCAL_ROWS, JSON.stringify(db));
    }
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

const toUpload = (r: Record<string, unknown>): Upload => ({
  id: String(r.id), who: String(r.who), filename: String(r.filename), w: Number(r.w), h: Number(r.h),
  createdAt: new Date(r.created_at as string).toISOString(), tags: (r.tags as UploadTag[]) ?? [],
});

let cache: { at: number; rows: Upload[] } | null = null;
const forget = () => void (cache = null);

/** Every upload (without face data), cached for a few seconds because every page view reads it. */
export async function listUploads(): Promise<Upload[]> {
  if (cache && Date.now() - cache.at < 5000) return cache.rows;
  let rows: Upload[];
  if (dbStore()) {
    await ensure();
    rows = (await query("SELECT id, who, filename, w, h, created_at, tags FROM family_uploads ORDER BY created_at")).map(toUpload);
  } else {
    rows = await local((db) =>
      db.uploads.map((u) => ({ id: u.id, who: u.who, filename: u.filename, w: u.w, h: u.h, createdAt: u.createdAt, tags: u.tags })),
    );
  }
  cache = { at: Date.now(), rows };
  return rows;
}

export async function createUpload(u: Upload, faces: FaceRow[]): Promise<void> {
  if (dbStore()) {
    await ensure();
    await query(
      "INSERT INTO family_uploads (id, who, filename, w, h, created_at, faces) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)",
      [u.id, u.who, u.filename, u.w, u.h, u.createdAt, JSON.stringify(faces)],
    );
  } else {
    await local((db) => void db.uploads.push({ ...u, faces }), true);
  }
  forget();
}

export async function getUpload(id: string): Promise<(Upload & { faces: FaceRow[] }) | null> {
  if (dbStore()) {
    await ensure();
    const rows = await query("SELECT id, who, filename, w, h, created_at, tags, faces FROM family_uploads WHERE id = $1", [id]);
    return rows.length ? { ...toUpload(rows[0]), faces: (rows[0].faces as FaceRow[]) ?? [] } : null;
  }
  return local((db) => db.uploads.find((u) => u.id === id) ?? null);
}

/** Replaces a photo's tags. `samples` are the faces the family confirmed, kept to improve later suggestions. */
export async function saveTags(id: string, tags: UploadTag[], samples: Omit<Sample, "uploadId">[]): Promise<void> {
  if (dbStore()) {
    await ensure();
    await query("UPDATE family_uploads SET tags = $2::jsonb WHERE id = $1", [id, JSON.stringify(tags)]);
    await query("DELETE FROM family_face_samples WHERE upload_id = $1", [id]);
    for (const s of samples) {
      await query("INSERT INTO family_face_samples (upload_id, name, person_id, embedding) VALUES ($1,$2,$3,$4::jsonb)", [
        id, s.name, s.personId, JSON.stringify(s.embedding),
      ]);
    }
  } else {
    await local((db) => {
      const u = db.uploads.find((x) => x.id === id);
      if (u) u.tags = tags;
      db.samples = [...db.samples.filter((s) => s.uploadId !== id), ...samples.map((s) => ({ ...s, uploadId: id }))];
    }, true);
  }
  forget();
}

/** Faces confirmed on earlier uploads, so a person added from an upload is suggested next time. */
export async function listSamples(): Promise<Centroid[]> {
  const toCentroid = (s: { name: string; personId: number | null; embedding: number[] }): Centroid => ({
    name: s.name, personId: s.personId, vector: s.embedding,
  });
  if (dbStore()) {
    await ensure();
    const rows = await query("SELECT name, person_id, embedding FROM family_face_samples");
    return rows.map((r) => toCentroid({ name: String(r.name), personId: r.person_id == null ? null : Number(r.person_id), embedding: r.embedding as number[] }));
  }
  return local((db) => db.samples.map(toCentroid));
}

// ---------- images ----------

const imageKey = (id: string, size: Size) => `uploads/${id}/${size}.jpg`;

export async function saveImage(id: string, size: Size, body: Buffer): Promise<void> {
  if (blobImages()) {
    await put(imageKey(id, size), body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg" });
    return;
  }
  const file = path.join(DATA, imageKey(id, size));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function readUploadImage(id: string, size: Size): Promise<{ body: ReadableStream; length?: number } | null> {
  if (blobImages()) {
    const res = await get(imageKey(id, size), { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return { body: res.stream, length: res.blob.size };
  }
  const file = path.join(DATA, imageKey(id, size));
  try {
    const { size: length } = await stat(file);
    return { body: Readable.toWeb(createReadStream(file)) as ReadableStream, length };
  } catch {
    return null;
  }
}

// ---------- the named people's face fingerprints ----------

let centroids: { at: number; rows: Centroid[] } | null = null;

/** One averaged face per named person, from `export-people` (people/centroids.json). Empty if not synced yet. */
export async function getCentroids(): Promise<Centroid[]> {
  if (centroids && Date.now() - centroids.at < 10 * 60 * 1000) return centroids.rows;
  let rows: Centroid[] = [];
  try {
    let text: string;
    if (blobImages()) {
      const res = await get("people/centroids.json", { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) throw new Error("missing");
      text = await new Response(res.stream).text();
    } else {
      text = await readFile(path.join(LOCAL_EXPORT, "people/centroids.json"), "utf8");
    }
    rows = (JSON.parse(text) as { personId: number; name: string; centroid: number[] }[]).map((r) => ({
      personId: r.personId, name: r.name, vector: r.centroid,
    }));
  } catch {}
  centroids = { at: Date.now(), rows };
  return rows;
}
