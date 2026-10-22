import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { FEEDBACK_MAX, FEEDBACK_REPO, openFeedbackPr } from "@/lib/feedback";

/** One change request from the family: { title, description, page }. Opens a pull request on GitHub. */
export async function POST(request: Request) {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const page = typeof body?.page === "string" ? body.page.slice(0, 300) : "";
  if (!title || !description) {
    return Response.json({ error: "Please add a title and a description." }, { status: 400 });
  }
  if (title.length > FEEDBACK_MAX.title || description.length > FEEDBACK_MAX.description) {
    return Response.json({ error: "That's too long. Please shorten it." }, { status: 400 });
  }

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) {
    console.error("Feedback not sent: GITHUB_FEEDBACK_TOKEN is not set.", { title });
    return Response.json({ error: "Feedback isn't set up yet." }, { status: 503 });
  }
  try {
    await openFeedbackPr(token, process.env.FEEDBACK_REPO || FEEDBACK_REPO, { title, description, page });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Couldn't send that. Please try again." }, { status: 502 });
  }
}
