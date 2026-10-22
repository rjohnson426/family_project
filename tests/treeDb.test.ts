import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { applyOp, type Tree } from "@/lib/tree";
import { dbInsertFirst, dbRead, dbSave, setRunner } from "@/lib/treeDb";
import { treeFromCsv } from "@/lib/treeImport";
import { SEED_CSV, SEED_ROOT } from "@/lib/treeSeed";

// A real Postgres (in memory) behind the same SQL the site runs on Neon.
async function fresh() {
  const pg = new PGlite();
  setRunner(async (text, params = []) => (await pg.query(text, params as never[])).rows as Record<string, unknown>[]);
  return pg;
}
const ctx = (n: string) => ({ who: n, now: "2026-10-22T00:00:00Z", newId: () => "id" + Math.random().toString(36).slice(2, 8) });
const start = () => treeFromCsv(SEED_CSV, SEED_ROOT).tree;

test("the first tree is stored once and read back whole", async () => {
  await fresh();
  assert.equal(await dbRead(), null);
  assert.equal(await dbInsertFirst(start(), "Loaded the starter tree"), true);
  assert.equal(await dbInsertFirst({ ...start(), rev: 99 }, "again"), false); // a second server can't overwrite it
  const t = (await dbRead())!;
  assert.equal(Object.keys(t.people).length, 29);
  assert.equal(t.rev, 0);
});

test("a save lands, bumps the revision and writes a log row", async () => {
  const pg = await fresh();
  await dbInsertFirst(start(), "start");
  const before = (await dbRead())!;
  const next = applyOp(before, { type: "addChild", of: "shazia", person: { name: "Eli" } }, ctx("Rob"));
  assert.equal(await dbSave(next, before.rev, before), true);
  const after = (await dbRead())!;
  assert.equal(after.rev, 1);
  assert.ok(Object.values(after.people).some((p) => p.name === "Eli"));
  const log = (await pg.query("SELECT who, summary, rev FROM family_tree_log ORDER BY id")).rows as { who: string; summary: string; rev: number }[];
  assert.equal(log.length, 2);
  assert.equal(log[1].who, "Rob");
  assert.match(log[1].summary, /Eli/);
});

test("two saves from the same revision: the second is refused, nothing is lost", async () => {
  const pg = await fresh();
  await dbInsertFirst(start(), "start");
  const base = (await dbRead())!;
  const a = applyOp(base, { type: "addChild", of: "shazia", person: { name: "A" } }, ctx("Ann"));
  const b = applyOp(base, { type: "addChild", of: "shazia", person: { name: "B" } }, ctx("Bo"));
  assert.equal(await dbSave(a, base.rev, base), true);
  assert.equal(await dbSave(b, base.rev, base), false); // stale
  const names = Object.values((await dbRead())!.people).map((p) => p.name);
  assert.ok(names.includes("A") && !names.includes("B"));
  assert.equal(((await pg.query("SELECT count(*)::int AS n FROM family_tree_log")).rows[0] as { n: number }).n, 2);
  // Retrying on top of the newer tree works.
  const latest = (await dbRead())!;
  assert.equal(await dbSave(applyOp(latest, { type: "addChild", of: "shazia", person: { name: "B" } }, ctx("Bo")), latest.rev, latest), true);
});

test("an undo is saved and logged too", async () => {
  const pg = await fresh();
  await dbInsertFirst(start(), "start");
  const t0 = (await dbRead())!;
  const t1 = applyOp(t0, { type: "updatePerson", id: "shazia", fields: { birth: "1980" } }, ctx("Rob"));
  await dbSave(t1, t0.rev, t0);
  const stored = (await dbRead())!;
  const t2: Tree = applyOp(stored, { type: "undo", entryId: stored.history.at(-1)!.id }, ctx("Rob"));
  assert.equal(await dbSave(t2, stored.rev, stored), true);
  assert.equal((await dbRead())!.people.shazia.birth, undefined);
  const last = (await pg.query("SELECT who, summary FROM family_tree_log ORDER BY id DESC LIMIT 1")).rows[0] as { who: string };
  assert.equal(last.who, "Undo");
});

test("through the store: first use seeds the database, and simultaneous edits all land", async () => {
  await fresh();
  process.env.DATABASE_URL = "postgres://test";
  process.env.TREE_STORE = "db";
  const { getTree, mutate } = await import("@/lib/treeStore");
  const seeded = await getTree();
  assert.equal(Object.keys(seeded.people).length, 29);
  await Promise.all(
    ["One", "Two", "Three", "Four"].map((n) => mutate({ type: "addChild", of: "shazia", person: { name: n } }, "Tester")),
  );
  const t = (await dbRead())!;
  assert.equal(Object.values(t.people).filter((p) => ["One", "Two", "Three", "Four"].includes(p.name)).length, 4);
  assert.equal(t.rev, 4);
  delete process.env.DATABASE_URL;
  delete process.env.TREE_STORE;
});

test("finds the connection string even under a custom prefix, and ignores unpooled ones", async () => {
  const { dbUrl, dbVarName } = await import("@/lib/treeDb");
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/POSTGRES|DATABASE/i.test(k)) delete process.env[k];
  assert.equal(dbVarName(), null);
  process.env.STORAGE_DATABASE_URL_UNPOOLED = "postgres://unpooled";
  assert.equal(dbVarName(), null);
  process.env.STORAGE_DATABASE_URL = "postgres://pooled";
  assert.equal(dbVarName(), "STORAGE_DATABASE_URL");
  process.env.DATABASE_URL = "postgresql://plain";
  assert.equal(dbUrl(), "postgresql://plain");
  for (const k of ["STORAGE_DATABASE_URL_UNPOOLED", "STORAGE_DATABASE_URL", "DATABASE_URL"]) delete process.env[k];
  Object.assign(process.env, saved);
});

test("album covers are stored per folder and replaced when changed", async () => {
  await fresh();
  const { query } = await import("@/lib/treeDb");
  await query("CREATE TABLE IF NOT EXISTS album_covers (path text PRIMARY KEY, photo_id text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");
  const set = (p: string, id: string) =>
    query("INSERT INTO album_covers (path, photo_id) VALUES ($1, $2) ON CONFLICT (path) DO UPDATE SET photo_id = $2, updated_at = now()", [p, id]);
  await set("Hasan", "5");
  await set("Hasan", "9");
  const rows = await query("SELECT path, photo_id FROM album_covers");
  assert.deepEqual(rows, [{ path: "Hasan", photo_id: "9" }]);
});
