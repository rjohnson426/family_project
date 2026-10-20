import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { isValidToken, login, tokenFor } from "@/lib/auth";

beforeEach(() => {
  process.env.FAMILY_PASSWORD = "secret-pw";
  process.env.AUTH_SECRET = "test-secret";
});

test("the right password returns a token that validates", async () => {
  const token = await login("secret-pw");
  assert.ok(token);
  assert.equal(await isValidToken(token), true);
});

test("the password ignores case and surrounding spaces", async () => {
  assert.ok(await login("  Secret-PW "));
});

test("a wrong password returns null", async () => {
  assert.equal(await login("nope"), null);
  assert.equal(await login(""), null);
});

test("missing or forged cookies are rejected", async () => {
  assert.equal(await isValidToken(undefined), false);
  assert.equal(await isValidToken("deadbeef"), false);
  assert.equal(await isValidToken(await tokenFor("secret-pw", "other-secret")), false);
});

test("changing the password invalidates existing cookies", async () => {
  const token = await login("secret-pw");
  process.env.FAMILY_PASSWORD = "new-pw";
  assert.equal(await isValidToken(token!), false);
});
