// Shared-password login. The cookie holds an HMAC of the password, so changing FAMILY_PASSWORD
// (or AUTH_SECRET) logs everyone out. Uses Web Crypto so it runs in the proxy and in route handlers.

export const AUTH_COOKIE = "fp_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function config() {
  const password = process.env.FAMILY_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) throw new Error("FAMILY_PASSWORD and AUTH_SECRET must be set");
  return { password, secret };
}

export function tokenFor(password: string, secret: string): Promise<string> {
  return hmac(secret, `family-photos:${password}`);
}

/** The cookie value to set after a correct password, or null if the password is wrong. */
export async function login(attempt: string): Promise<string | null> {
  const { password, secret } = config();
  return safeEqual(attempt.trim().toLowerCase(), password.toLowerCase()) ? tokenFor(password, secret) : null;
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const { password, secret } = config();
  return safeEqual(token, await tokenFor(password, secret));
}
