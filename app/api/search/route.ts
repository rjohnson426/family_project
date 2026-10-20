import { cookies } from "next/headers";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";
import { searchIndex } from "@/lib/manifest";
import { getManifest } from "@/lib/store";

// The list of families and people the search box filters in the browser.
export async function GET() {
  if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(searchIndex(await getManifest()), {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
