import { findFolder } from "@/lib/manifest";
import { setCover } from "@/lib/covers";
import { getManifest } from "@/lib/store";

/** Sets a folder's cover: { path, photoId }. The photo must be one of the folder's own photos. */
export async function POST(request: Request) {
  // proxy.ts has already checked the password cookie for every /api route.
  const body = (await request.json().catch(() => null)) as { path?: unknown; photoId?: unknown } | null;
  if (typeof body?.path !== "string" || typeof body.photoId !== "string") {
    return Response.json({ error: "Nothing to do." }, { status: 400 });
  }
  const folder = findFolder(await getManifest(), body.path.split("/"));
  if (!folder || folder.path === "*" || !folder.photoIds.includes(body.photoId)) {
    return Response.json({ error: "That photo isn't in this album." }, { status: 400 });
  }
  try {
    await setCover(folder.path, body.photoId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Couldn't save that. Please try again." }, { status: 500 });
  }
}
