import { neon } from "@neondatabase/serverless";
import type { Tree } from "./tree";

// The family tree in Postgres (Neon, added through the Vercel Marketplace, which puts DATABASE_URL
// in the project's env for us, so there is no token to copy around).
//
//   family_tree      one row (id = 1): the whole tree as JSONB plus a revision number
//   family_tree_log  one row per change, forever: who, what, when, and the tree as it was before
//
// Saves are compare-and-swap on `rev`, so two people saving at the same instant can't overwrite
// each other: the second one is told to retry against the newer tree.

export const dbUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

type Row = Record<string, unknown>;
/** Runs one SQL statement with $1, $2… parameters. Tests swap in an in-memory Postgres. */
export type Run = (text: string, params?: unknown[]) => Promise<Row[]>;

let runner: Run | null = null;
let ready: Promise<void> | null = null;

export function setRunner(run: Run | null) {
  runner = run;
  ready = null;
}

const run: Run = (text, params = []) => {
  runner ??= (text, params = []) => neon(dbUrl()).query(text, params) as Promise<Row[]>;
  return runner(text, params);
};

export function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    await run(`CREATE TABLE IF NOT EXISTS family_tree (
      id int PRIMARY KEY CHECK (id = 1),
      rev int NOT NULL,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await run(`CREATE TABLE IF NOT EXISTS family_tree_log (
      id bigserial PRIMARY KEY,
      rev int NOT NULL,
      at timestamptz NOT NULL DEFAULT now(),
      who text NOT NULL,
      summary text NOT NULL,
      before jsonb
    )`);
  })().catch((e) => {
    ready = null; // try again next time
    throw e;
  });
  return ready;
}

export async function dbRead(): Promise<Tree | null> {
  await ensureSchema();
  const rows = await run("SELECT data FROM family_tree WHERE id = 1");
  return rows.length ? (rows[0].data as Tree) : null;
}

/** Stores the first version of the tree; does nothing if someone already did. Returns whether it wrote. */
export async function dbInsertFirst(tree: Tree, note: string): Promise<boolean> {
  await ensureSchema();
  const rows = await run(
    `WITH ins AS (
       INSERT INTO family_tree (id, rev, data) VALUES (1, $1, $2::jsonb)
       ON CONFLICT (id) DO NOTHING RETURNING rev
     )
     INSERT INTO family_tree_log (rev, who, summary) SELECT rev, 'System', $3 FROM ins RETURNING id`,
    [tree.rev, JSON.stringify(tree), note],
  );
  return rows.length > 0;
}

/**
 * Saves `next` only if the stored tree is still at revision `expectedRev`. Returns false when
 * someone else saved first (the caller reloads and tries again).
 */
export async function dbSave(next: Tree, expectedRev: number, before: Tree): Promise<boolean> {
  await ensureSchema();
  const entry = next.history[next.history.length - 1];
  const undo = next.history.length < before.history.length; // an undo drops its entry instead of adding one
  const who = undo ? "Undo" : (entry?.who ?? "Someone");
  const summary = undo ? "undid the last change" : (entry?.summary ?? "changed the tree");
  const snapshot = { people: before.people, parents: before.parents, unions: before.unions };
  const rows = await run(
    `WITH upd AS (
       UPDATE family_tree SET data = $1::jsonb, rev = $2, updated_at = now()
       WHERE id = 1 AND rev = $3 RETURNING rev
     )
     INSERT INTO family_tree_log (rev, who, summary, before)
     SELECT rev, $4, $5, $6::jsonb FROM upd RETURNING id`,
    [JSON.stringify(next), next.rev, expectedRev, who, summary, JSON.stringify(snapshot)],
  );
  return rows.length > 0;
}
