import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { cleanName, suggest, type Suggestion } from "@/lib/uploads";
import { createUpload, getCentroids, listSamples, saveImage, type FaceRow } from "@/lib/uploadsStore";

export const maxDuration = 60; // the first photo after a quiet spell waits for the face models to load

const MAX_BYTES = { thumb: 300_000, large: 1_500_000, full: 3_000_000 };

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

/** Finds the faces in a photo with the same InsightFace models as the library (embedder/). */
async function embed(request: Request, jpeg: Buffer): Promise<{ faces: { bbox: number[]; embedding: number[] }[] } | null> {
  const base = process.env.EMBED_URL || new URL("/api/embed", request.url).toString();
  try {
    const res = await fetch(base, {
      method: "POST",
      body: new Uint8Array(jpeg),
      headers: { "x-embed-secret": process.env.AUTH_SECRET ?? "", cookie: request.headers.get("cookie") ?? "" },
      signal: AbortSignal.timeout(55_000),
    });
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.error("Face detection unavailable", e);
    return null;
  }
}

/**
 * One photo: multipart with who, filename, w, h and the thumb / large / full JPEGs (the browser
 * resizes them, which also keeps the request under Vercel's 4.5 MB body limit). Stores them, finds
 * the faces, and returns suggested names for each. The photo is visible to everyone straight away;
 * tags are added with PUT /api/uploads/<id>.
 */
export async function POST(request: Request) {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) return new Response("Unauthorized", { status: 401 });
  const form = await request.formData().catch(() => null);
  const who = cleanName(String(form?.get("who") ?? ""));
  if (!form || !who) return Response.json({ error: "Please add your name first." }, { status: 400 });

  const files = {} as Record<keyof typeof MAX_BYTES, Buffer>;
  for (const size of Object.keys(MAX_BYTES) as (keyof typeof MAX_BYTES)[]) {
    const file = form.get(size);
    const buf = file instanceof Blob ? Buffer.from(await file.arrayBuffer()) : null;
    if (!buf || !isJpeg(buf) || buf.length > MAX_BYTES[size]) {
      return Response.json({ error: "That photo couldn't be read. Please try another." }, { status: 400 });
    }
    files[size] = buf;
  }
  const w = Math.round(Number(form.get("w")));
  const h = Math.round(Number(form.get("h")));
  if (!(w > 0 && h > 0 && w < 20000 && h < 20000)) return Response.json({ error: "That photo couldn't be read." }, { status: 400 });

  const id = "u" + randomBytes(6).toString("hex");
  const found = await embed(request, files.large);
  const faces: FaceRow[] = found?.faces ?? [];
  const [centroids, samples] = faces.length ? await Promise.all([getCentroids(), listSamples().catch(() => [])]) : [[], []];

  await Promise.all(Object.entries(files).map(([size, buf]) => saveImage(id, size as keyof typeof MAX_BYTES, buf)));
  await createUpload(
    { id, who, filename: (cleanName(String(form.get("filename") ?? "")).replace(/\.[^.]+$/, "") || id) + ".jpg", w, h, createdAt: new Date().toISOString(), tags: [] },
    faces.map((f) => ({ bbox: f.bbox, embedding: f.embedding })),
  );

  const result: { bbox: number[]; suggestions: Suggestion[] }[] = faces.map((f) => ({
    bbox: f.bbox,
    suggestions: suggest(f.embedding, [...centroids, ...samples]),
  }));
  return Response.json({ id, faces: result, detection: found ? "ok" : "unavailable" }, { headers: { "Cache-Control": "private, no-store" } });
}
