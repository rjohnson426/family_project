import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { applyOp, emptyTree, type Op, type Tree } from "./tree";
import { treeFromCsv } from "./treeImport";
import { dbInsertFirst, dbRead, dbSave, dbUrl } from "./treeDb";
import { SEED_CSV, SEED_ROOT } from "./treeSeed";

// Where the tree lives, in order of preference:
//   1. Postgres (lib/treeDb.ts) when DATABASE_URL is set, in production. This is the real home.
//      The first time it's used it copies the tree from the old Blob file, so nothing is lost.
//   2. The private Blob store (tree/tree.json), the original home, used until a database is attached.
//   3. .data/tree.json locally, even when .env.local holds the production tokens, so testing never
//      touches the real tree. TREE_STORE=db or TREE_STORE=blob overrides that.
const dbStore = () =>
  Boolean(dbUrl()) && (process.env.NODE_ENV === "production" || process.env.TREE_STORE === "db");
const KEY = "tree/tree.json";
const LOCAL = path.resolve(process.cwd(), ".data/tree.json");
const blobStore = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN) &&
  (process.env.NODE_ENV === "production" || process.env.TREE_STORE === "blob");

export async function readTree(forceBlob = false): Promise<Tree | null> {
  try {
    if (forceBlob ? Boolean(process.env.BLOB_READ_WRITE_TOKEN) : blobStore()) {
      const res = await get(KEY, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return JSON.parse(await new Response(res.stream).text());
    }
    return JSON.parse(await readFile(LOCAL, "utf8"));
  } catch {
    return null;
  }
}

let lastBackupDay = "";

export async function writeTree(tree: Tree, previous?: Tree | null): Promise<void> {
  const body = JSON.stringify(tree);
  if (!blobStore()) {
    await mkdir(path.dirname(LOCAL), { recursive: true });
    await writeFile(LOCAL, body);
    return;
  }
  // First save of the day also keeps the tree as it was before, in case a bad edit slips past undo.
  const day = new Date().toISOString().slice(0, 10);
  if (previous && lastBackupDay !== day) {
    lastBackupDay = day;
    const key = `tree/backups/${day}.json`;
    const exists = await get(key, { access: "private", useCache: false }).catch(() => null);
    if (!exists || exists.statusCode !== 200) {
      await put(key, JSON.stringify(previous), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
      });
    }
  }
  await put(KEY, body, {
    access: "private", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 0,
  });
}

const starter = () => treeFromCsv(SEED_CSV, SEED_ROOT).tree;

/** The tree, loading the starter tree on first use (or, for a new database, the Blob copy). */
export async function getTree(): Promise<Tree> {
  if (dbStore()) {
    const existing = await dbRead();
    if (existing) return existing;
    const old = await readTree(true); // the Blob file the tree lived in before the database
    await dbInsertFirst(old ?? starter(), old ? "Copied the tree from file storage" : "Loaded the starter tree");
    return (await dbRead()) ?? starter();
  }
  const existing = await readTree();
  if (existing) return existing;
  const tree = starter();
  await writeTree(tree);
  return tree;
}

const newId = () => "p" + randomBytes(5).toString("hex");

// Edits are applied to the latest saved tree, one at a time per server instance, so two
// relatives adding different people at once both land.
let queue: Promise<unknown> = Promise.resolve();

export function mutate(op: Op, who: string): Promise<Tree> {
  const run = queue.then(async () => {
    // With the database, another server instance may save between our read and write; the save
    // then fails and we redo the edit on top of the newer tree.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await getTree();
      const next = applyOp(current, op, { who, now: new Date().toISOString(), newId });
      if (!dbStore()) {
        await writeTree(next, current);
        return next;
      }
      if (await dbSave(next, current.rev, current)) return next;
    }
    throw new Error("The tree is being edited by several people at once. Please try again.");
  });
  queue = run.catch(() => undefined);
  return run;
}

export { emptyTree };
