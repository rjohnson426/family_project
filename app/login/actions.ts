"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE, login } from "@/lib/auth";

export async function signIn(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const token = await login(String(form.get("password") ?? ""));
  if (!token) return { error: "That password isn't right." };
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  const next = String(form.get("next") ?? "");
  // Only same-site paths, never "//evil.com".
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
