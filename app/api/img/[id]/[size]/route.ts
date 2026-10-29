import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { isUploadId } from "@/lib/uploads";
import { isSize } from "@/lib/manifest";
import { getManifest, readPhoto } from "@/lib/store";

// Streams one size of one photo from the private store. The proxy already checks the
// cookie; checking again here keeps images private even if the proxy matcher changes.
export async function GET(request: Request, ctx: RouteContext<"/api/img/[id]/[size]">) {
  const { id, size } = await ctx.params;
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(/^\d+$/.test(id) || isUploadId(id)) || !isSize(size)) return new Response("Not found", { status: 404 });

  if (!(id in (await getManifest()).photos)) return new Response("Not found", { status: 404 });
  const photo = await readPhoto(id, size);
  if (!photo) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, max-age=86400",
  });
  if (photo.length) headers.set("Content-Length", String(photo.length));
  if (new URL(request.url).searchParams.has("download")) {
    const original = (await getManifest()).photos[id]?.filename ?? `${id}.jpg`;
    const filename = original.replace(/\.[^.]+$/, "") + ".jpg";
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
  }
  return new Response(photo.body, { headers });
}
