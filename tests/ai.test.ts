import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { AI_TOOLS, findTool } from "@/lib/ai";
import { takeOne, today, usedToday } from "@/lib/usage";

beforeEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN; // in-memory counter
});

test("every tool builds an input that carries the image", () => {
  for (const tool of AI_TOOLS) {
    const input = tool.input("data:image/jpeg;base64,AAAA");
    assert.ok(Object.values(input).includes("data:image/jpeg;base64,AAAA"), tool.id);
    // Community models must be pinned so a model update can't change results or break inputs.
    if (!tool.model.startsWith("flux-kontext-apps/")) assert.match(tool.version ?? "", /^[0-9a-f]{64}$/, tool.id);
  }
  assert.equal(findTool("colorize")?.model, "piddnad/ddcolor");
  assert.equal(findTool("nope"), undefined);
});

test("the daily counter stops at the limit", async () => {
  const start = await usedToday();
  assert.equal(await takeOne(start + 2), true);
  assert.equal(await takeOne(start + 2), true);
  assert.equal(await takeOne(start + 2), false);
  assert.equal(await usedToday(), start + 2);
});

test("days roll over at midnight Central, not UTC", () => {
  // 03:00 UTC on Oct 21 is still Oct 20 in Iowa.
  assert.equal(today(new Date("2026-10-21T03:00:00Z")), "2026-10-20");
  assert.equal(today(new Date("2026-10-21T06:00:00Z")), "2026-10-21");
});

test("a failed edit is handed back", async () => {
  const { giveBack } = await import("@/lib/usage");
  const start = await usedToday();
  await takeOne(start + 1);
  await giveBack();
  assert.equal(await usedToday(), start);
});
