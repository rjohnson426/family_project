import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

const TO = "rajohnson426@gmail.com";
const MAX = { title: 120, description: 2000, who: 60 };

/** One change request from the family: { title, description, page }. Emailed to Rob through Resend. */
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
  if (title.length > MAX.title || description.length > MAX.description) {
    return Response.json({ error: "That's too long. Please shorten it." }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("Feedback not sent: RESEND_API_KEY is not set.", { title });
    return Response.json({ error: "Feedback email isn't set up yet." }, { status: 503 });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM || "Family Photos <onboarding@resend.dev>",
      to: [TO],
      subject: `Family Photos request: ${title}`,
      text: `${description}\n\n---\nPage: ${page || "unknown"}\nSent from the Submit Feedback form on the family photo site.`,
    }),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("Feedback email failed", res?.status, await res?.text().catch(() => ""));
    return Response.json({ error: "Couldn't send that. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
