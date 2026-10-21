import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { readFace } from "@/lib/people";

// A cropped face for a person named in the photo library, streamed from the private store
// behind the password cookie, the same way /api/img serves photos.
export async function GET(_request: Request, ctx: RouteContext<"/api/tree/face/[personId]">) {
  const { personId } = await ctx.params;
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!/^\d+$/.test(personId)) return new Response("Not found", { status: 404 });
  const face = await readFace(Number(personId));
  if (!face) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" });
  if (face.length) headers.set("Content-Length", String(face.length));
  return new Response(face.body, { headers });
}
