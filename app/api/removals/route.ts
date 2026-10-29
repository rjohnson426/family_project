import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { FEEDBACK_REPO, openFeedbackPr } from "@/lib/feedback";
import { REMOVAL_REASON_MAX, hidePhoto } from "@/lib/removals";
import { getManifest } from "@/lib/store";

/**
 * A family member asks to remove a photo: { photoId, reason, page }. The photo is hidden from the
 * site right away and a pull request tells Rob (GitHub emails him). The original files are kept.
 */
export async function POST(request: Request) {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const photoId = typeof body?.photoId === "string" ? body.photoId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 300) : "";
  if (reason.length > REMOVAL_REASON_MAX) {
    return Response.json({ error: "That's too long. Please shorten it." }, { status: 400 });
  }
  const photo = (await getManifest()).photos[photoId];
  if (!photo) return Response.json({ error: "That photo isn't on the site." }, { status: 404 });

  try {
    await hidePhoto({ photoId, reason, page });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Couldn't remove that. Please try again." }, { status: 502 });
  }

  // The photo is already hidden, so a failed notification must not fail the request.
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) {
    console.error("Removal hidden but nobody notified: GITHUB_FEEDBACK_TOKEN is not set.", { photoId });
  } else {
    const description =
      `**${photo.filename}** (photo ${photoId})\n\nReason: ${reason || "none given"}\n\nThis photo is **already hidden** from the site. ` +
      `The original files are untouched. To restore it, delete its row from \`photo_removals\` in Neon ` +
      `(\`DELETE FROM photo_removals WHERE photo_id = '${photoId}'\`).`;
    try {
      await openFeedbackPr(token, process.env.FEEDBACK_REPO || FEEDBACK_REPO, {
        title: `Photo removed: ${photo.filename}`,
        description,
        page,
      });
    } catch (e) {
      console.error("Removal hidden but the notification PR failed", e);
    }
  }
  return Response.json({ ok: true });
}
