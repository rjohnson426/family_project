import assert from "node:assert/strict";
import { test } from "node:test";
import { feedbackFile, slug } from "@/lib/feedback";

test("slug is safe for a branch name", () => {
  assert.equal(slug("Fix Shazia's spelling!!"), "fix-shazia-s-spelling");
  assert.equal(slug("???"), "request");
});

test("feedbackFile names the branch and file from the time and title", () => {
  const f = feedbackFile("Move photos", "Put them in Hasan", "/f/Hasan", "2026-10-22T14:03:09.123Z");
  assert.equal(f.branch, "feedback/20261022-140309z-move-photos");
  assert.equal(f.path, "feedback/20261022-140309z-move-photos.md");
  assert.match(f.content, /^# Move photos\n\nPut them in Hasan\n/);
  assert.match(f.content, /Page: \/f\/Hasan/);
});
