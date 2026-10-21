import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { applyOp, emptyTree, type Op, type Tree } from "./tree";
import { treeFromCsv } from "./treeImport";
import { SEED_CSV, SEED_ROOT } from "./treeSeed";

// The tree is one small JSON file. In production it lives in the private Blob store; locally it
// is .data/tree.json, even when .env.local holds the production Blob token, so testing never
// touches the real tree. Set TREE_STORE=blob to override that (the import script does).
const KEY = "tree/tree.json";
const LOCAL = path.resolve(process.cwd(), ".data/tree.json");
const blobStore = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN) &&
  (process.env.NODE_ENV === "production" || process.env.TREE_STORE === "blob");

export async function readTree(): Promise<Tree | null> {
  try {
    if (blobStore()) {
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

/** The tree, loading the starter tree on first use. */
export async function getTree(): Promise<Tree> {
  const existing = await readTree();
  if (existing) return existing;
  const { tree } = treeFromCsv(SEED_CSV, SEED_ROOT);
  await writeTree(tree);
  return tree;
}

const newId = () => "p" + randomBytes(5).toString("hex");

// Edits are applied to the latest saved tree, one at a time per server instance, so two
// relatives adding different people at once both land.
let queue: Promise<unknown> = Promise.resolve();

export function mutate(op: Op, who: string): Promise<Tree> {
  const run = queue.then(async () => {
    const current = await getTree();
    const next = applyOp(current, op, { who, now: new Date().toISOString(), newId });
    await writeTree(next, current);
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

export { emptyTree };
