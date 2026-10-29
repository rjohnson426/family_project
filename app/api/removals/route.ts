import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { FEEDBACK_REPO, openFeedbackPr } from "@/lib/feedback";
import { hidePhoto } from "@/lib/removals";
import { getManifest } from "@/lib/store";

/**
 * A family member asks to remove a photo: { photoId, page }. The photo is hidden from the
 * site right away and a pull request tells Rob (GitHub emails him). The original files are kept.
 */
export async function POST(request: Request) {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const photoId = typeof body?.photoId === "string" ? body.photoId : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 300) : "";
  const photo = (await getManifest()).photos[photoId];
  if (!photo) return Response.json({ error: "That photo isn't on the site." }, { status: 404 });

  try {
    await hidePhoto({ photoId, page });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Couldn't remove that. Please try again." }, { status: 502 });
  }

  // The photo is already hidden, so a failed notification must not fail the request.
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) {
    console.error("Removal hidden but nobody notified: GITHUB_FEEDBACK_TOKEN is not set.", { photoId });
  } else {
    const title = `Photo removed: ${photo.filename}`;
    try {
      await openFeedbackPr(token, process.env.FEEDBACK_REPO || FEEDBACK_REPO, {
        title,
        description: title,
        page,
      });
    } catch (e) {
      console.error("Removal hidden but the notification PR failed", e);
    }
  }
  return Response.json({ ok: true });
}
