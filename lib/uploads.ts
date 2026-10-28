import type { Folder, Manifest } from "./manifest";

// Photos uploaded by the family. They live apart from the exported library (Blob prefix `uploads/`,
// rows in Postgres) and are merged into the manifest on every read, so a tagged upload shows up in the
// person's folder straight away and a new person gets a new folder.

export type UploadTag = { name: string; personId: number | null };
export type Upload = {
  id: string; // "u" + 12 hex, so it can never clash with an exported photo's number
  who: string;
  filename: string;
  w: number;
  h: number;
  createdAt: string;
  tags: UploadTag[];
};
export type NamedFolder = { personId: number; name: string; folderPath: string | null };

export const UPLOAD_ID = /^u[0-9a-f]{12}$/;
export const isUploadId = (id: string) => UPLOAD_ID.test(id);

export const cleanName = (s: string) => s.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
export const fold = (s: string) => cleanName(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The family folder a new person goes in: their last word, or their own folder for names like `Ann (Smith)`. */
export function familyFor(name: string): string {
  const n = cleanName(name);
  if (/[)"'”’]$/.test(n)) return n;
  return n.split(" ").pop() || n;
}

// ---------- matching a face against the named people ----------

export type Centroid = { personId: number | null; name: string; vector: number[] };
export type Suggestion = { name: string; personId: number | null; distance: number };

/** Cosine distance (1 - similarity) between two vectors. */
export function cosineDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? 1 - dot / Math.sqrt(na * nb) : 1;
}

// consolidate_attach_threshold in family_facial_recognition's config.yaml is 0.5; a little looser
// here because these are only suggestions the uploader confirms.
export const SUGGEST_MAX_DISTANCE = 0.55;

/** The closest named people (at most `limit`), one entry per name, nearest first. */
export function suggest(embedding: number[], candidates: Centroid[], limit = 3): Suggestion[] {
  const best = new Map<string, Suggestion>();
  for (const c of candidates) {
    const distance = cosineDistance(embedding, c.vector);
    const key = fold(c.name);
    const have = best.get(key);
    if (distance <= SUGGEST_MAX_DISTANCE && (!have || distance < have.distance)) {
      best.set(key, { name: c.name, personId: c.personId ?? have?.personId ?? null, distance: +distance.toFixed(3) });
    }
  }
  return [...best.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
}

// ---------- merging uploads into the manifest ----------

function folderByName(folders: Folder[], key: string): Folder[] {
  return folders.flatMap((f) => [...(fold(f.name) === key ? [f] : []), ...folderByName(f.children, key)]);
}

export function findByPath(folders: Folder[], path: string): Folder | null {
  const parts = path.split("/");
  let level = folders;
  let found: Folder | null = null;
  for (let i = 0; i < parts.length; i++) {
    found = level.find((f) => f.path === parts.slice(0, i + 1).join("/")) ?? null;
    if (!found) return null;
    level = found.children;
  }
  return found;
}

/**
 * Where a tagged person's photos go: their folder if they have one (by exported person, else by an
 * unambiguous folder of that name), otherwise a new `<Family>/<Name>` folder.
 */
export function folderPathFor(tag: UploadTag, folders: Folder[], named: NamedFolder[]): string {
  const person = tag.personId != null ? named.find((p) => p.personId === tag.personId) : undefined;
  if (person?.folderPath && findByPath(folders, person.folderPath)) return person.folderPath;
  const matches = folderByName(folders, fold(tag.name));
  if (matches.length === 1) return matches[0].path;
  const family = familyFor(tag.name);
  return fold(family) === fold(tag.name) ? cleanName(tag.name) : `${family}/${cleanName(tag.name)}`;
}

const unique = (ids: string[]) => [...new Set(ids)];

/** A copy of the manifest with every upload added to the photos, its folders, and its uploader's list. */
export function mergeUploads(manifest: Manifest, uploads: Upload[], named: NamedFolder[]): Manifest {
  if (!uploads.length) return manifest;
  const photos = { ...manifest.photos };
  const uploaders: Record<string, string[]> = {};
  // Folders are copied as they're touched, so the 12,000-photo base lists aren't all cloned.
  const folders = [...manifest.folders];
  const touched = new WeakSet<Folder>();

  const edit = (path: string): Folder => {
    const parts = path.split("/");
    let level = folders;
    let parent: Folder | null = null;
    for (let i = 0; i < parts.length; i++) {
      const p = parts.slice(0, i + 1).join("/");
      let idx = level.findIndex((f) => f.path === p);
      if (idx < 0) {
        level.push({ name: parts[i], path: p, photoIds: [], children: [] });
        idx = level.length - 1;
      } else if (!touched.has(level[idx])) {
        level[idx] = { ...level[idx], photoIds: [...level[idx].photoIds], children: [...level[idx].children], ...(level[idx].own && { own: [...level[idx].own!] }) };
      }
      touched.add(level[idx]);
      parent = level[idx];
      level = parent.children;
    }
    return parent!;
  };

  for (const u of [...uploads].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    photos[u.id] = { filename: u.filename, w: u.w, h: u.h, hash: u.id };
    (uploaders[u.who] ??= []).push(u.id);
    const seen = new Set<string>();
    for (const tag of u.tags) {
      const path = folderPathFor(tag, folders, named);
      if (seen.has(path)) continue;
      seen.add(path);
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i++) {
        const f = edit(parts.slice(0, i).join("/"));
        f.photoIds = unique([...f.photoIds, u.id]);
        if (i === parts.length && (f.children.length || f.own)) f.own = unique([...(f.own ?? []), u.id]);
      }
    }
  }
  return { ...manifest, folders, photos, uploaders };
}
