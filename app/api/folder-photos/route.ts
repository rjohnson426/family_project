import { findFolder } from "@/lib/manifest";
import { getManifest } from "@/lib/store";

/** Photo ids in a folder ("*" is every photo), for the thumbnail picker. */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "*";
  const folder = findFolder(await getManifest(), path.split("/"));
  if (!folder) return Response.json({ ids: [] }, { status: 404 });
  return Response.json({ ids: folder.photoIds }, { headers: { "Cache-Control": "private, max-age=300" } });
}
