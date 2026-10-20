import { cookies } from "next/headers";
import { AI_DAILY_LIMIT, findTool, runTool } from "@/lib/ai";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { readPhoto } from "@/lib/store";
import { giveBack, takeOne, usedToday } from "@/lib/usage";

export const maxDuration = 120;

const MAX_SOURCE_BYTES = 3_000_000; // a previous result sent back for chaining (data: URL)

async function authorized() {
  return isValidToken((await cookies()).get(AUTH_COOKIE)?.value);
}

/** Edits left today, for the AI panel. */
export async function GET() {
  if (!(await authorized())) return new Response("Unauthorized", { status: 401 });
  return Response.json({ remaining: Math.max(AI_DAILY_LIMIT - (await usedToday()), 0), limit: AI_DAILY_LIMIT });
}

/**
 * Runs one AI tool. Body: { tool, id } to start from a stored photo (its 1,400px version), or
 * { tool, source } with a data: URL to keep working on a previous result. Returns the image.
 */
export async function POST(request: Request) {
  if (!(await authorized())) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { tool?: string; id?: string; source?: string };
  const tool = findTool(body.tool ?? "");
  if (!tool) return Response.json({ error: "Unknown tool." }, { status: 400 });

  let image: string;
  if (typeof body.source === "string") {
    if (!body.source.startsWith("data:image/") || body.source.length > MAX_SOURCE_BYTES * 1.4) {
      return Response.json({ error: "That image is too large to send." }, { status: 400 });
    }
    image = body.source;
  } else if (typeof body.id === "string" && /^\d+$/.test(body.id)) {
    const photo = await readPhoto(body.id, "large");
    if (!photo) return Response.json({ error: "Photo not found." }, { status: 404 });
    const bytes = Buffer.from(await new Response(photo.body).arrayBuffer());
    image = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } else {
    return Response.json({ error: "No photo given." }, { status: 400 });
  }

  if (!(await takeOne(AI_DAILY_LIMIT))) {
    return Response.json(
      { error: `The family has used all ${AI_DAILY_LIMIT} AI edits for today. They reset at midnight (Central).` },
      { status: 429 },
    );
  }

  try {
    const output = await runTool(tool, image);
    const result = await fetch(output);
    if (!result.ok || !result.body) throw new Error("Couldn't download the AI result.");
    return new Response(result.body, {
      headers: {
        "Content-Type": result.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    await giveBack();
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
