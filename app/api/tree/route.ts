import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { publicTree, TreeError, type Op } from "@/lib/tree";
import { getTree, mutate, storeName } from "@/lib/treeStore";

async function authorized() {
  return isValidToken((await cookies()).get(AUTH_COOKIE)?.value);
}

/** The whole tree (without undo snapshots). */
export async function GET() {
  if (!(await authorized())) return new Response("Unauthorized", { status: 401 });
  return Response.json({ tree: publicTree(await getTree()), store: storeName() }, { headers: { "Cache-Control": "private, no-store" } });
}

/** One edit: { op, who }. Returns the updated tree, or { error } with a message to show. */
export async function POST(request: Request) {
  if (!(await authorized())) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => null)) as { op?: Op; who?: string } | null;
  if (!body?.op || typeof body.op !== "object" || typeof body.op.type !== "string") {
    return Response.json({ error: "Nothing to do." }, { status: 400 });
  }
  try {
    const tree = await mutate(body.op, typeof body.who === "string" ? body.who : "");
    return Response.json({ tree: publicTree(tree) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof TreeError) return Response.json({ error: e.message }, { status: 409 });
    console.error(e);
    return Response.json({ error: "Couldn't save that. Please try again." }, { status: 500 });
  }
}
