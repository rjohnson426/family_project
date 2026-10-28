import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { getNamedPeople } from "@/lib/people";
import { cleanName, fold, isUploadId, type UploadTag } from "@/lib/uploads";
import { getUpload, saveTags } from "@/lib/uploadsStore";

/**
 * Sets the people in an uploaded photo: { tags: [{ name, personId?, faceIndex? }] }. Anyone in the
 * family can fix tags. A name that isn't a known person creates a new person (and, when the library
 * is read, their folder). `faceIndex` says which detected face it is, so that face is remembered
 * and the person is suggested on later uploads.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const upload = isUploadId(id) ? await getUpload(id) : null;
  if (!upload) return Response.json({ error: "That photo isn't there any more." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { tags?: { name?: unknown; personId?: unknown; faceIndex?: unknown }[] } | null;
  if (!Array.isArray(body?.tags) || body.tags.length > 40) return Response.json({ error: "Nothing to save." }, { status: 400 });

  const named = await getNamedPeople();
  const tags: UploadTag[] = [];
  const samples: { name: string; personId: number | null; embedding: number[] }[] = [];
  for (const t of body.tags) {
    const name = cleanName(typeof t.name === "string" ? t.name : "");
    if (!name || tags.some((x) => fold(x.name) === fold(name))) continue;
    // A known person is matched by id, or by name, so typing "Shazia Hasan" never makes a second Shazia.
    const person = named.find((p) => p.personId === t.personId) ?? named.find((p) => fold(p.name) === fold(name));
    const tag = { name: person?.name ?? name, personId: person?.personId ?? null };
    tags.push(tag);
    const face = typeof t.faceIndex === "number" ? upload.faces[t.faceIndex] : undefined;
    if (face) samples.push({ ...tag, embedding: face.embedding });
  }
  await saveTags(id, tags, samples);
  return Response.json({ tags }, { headers: { "Cache-Control": "private, no-store" } });
}
