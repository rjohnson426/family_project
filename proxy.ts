import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

// Every page and image needs the password cookie; only the login page and static assets don't.
export async function proxy(request: NextRequest) {
  if (await isValidToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|_next/|favicon.ico|icon.svg|robots.txt).*)"],
};
