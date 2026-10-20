// The folder tree and photo list, written by `export-web` in family_facial_recognition.

export type Folder = {
  name: string;
  path: string; // "Hasan" or "Hasan/Shazia Hasan"
  photoIds: string[];
  children: Folder[];
};

export type Photo = { filename: string; w: number; h: number; hash: string };

export type Manifest = {
  generatedAt: string;
  folders: Folder[];
  photos: Record<string, Photo>;
};

export const SIZES = ["thumb", "large", "full"] as const;
export type Size = (typeof SIZES)[number];

export function isSize(s: string): s is Size {
  return (SIZES as readonly string[]).includes(s);
}

/** Finds a folder by its path segments (already URL-decoded). */
export function findFolder(manifest: Manifest, segments: string[]): Folder | null {
  let level = manifest.folders;
  let found: Folder | null = null;
  for (let i = 0; i < segments.length; i++) {
    const path = segments.slice(0, i + 1).join("/");
    found = level.find((f) => f.path === path) ?? null;
    if (!found) return null;
    level = found.children;
  }
  return found;
}

export function folderHref(path: string): string {
  return "/f/" + path.split("/").map(encodeURIComponent).join("/");
}

export function photoHref(id: string, from: string): string {
  return `/p/${id}?from=${encodeURIComponent(from)}`;
}

export function imgSrc(id: string, size: Size, download = false): string {
  return `/api/img/${id}/${size}${download ? "?download=1" : ""}`;
}

/** Splits a filename into base and extension ("IMG_1.jpg" -> ["IMG_1", ".jpg"]). */
function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

export type ZipEntry = { id: string; name: string };

/**
 * The files a folder's zip holds. A family zip has one subfolder per person (a photo of two
 * people appears in both); other folders are flat. Clashing names get " (2)", " (3)"…; the
 * served files are always JPEGs, so every name ends in .jpg.
 */
export function zipEntries(manifest: Manifest, folder: Folder): ZipEntry[] {
  const raw: ZipEntry[] = folder.children.length
    ? folder.children.flatMap((child) =>
        child.photoIds.map((id) => ({ id, name: `${child.name}/${manifest.photos[id]?.filename ?? id}` })),
      )
    : folder.photoIds.map((id) => ({ id, name: manifest.photos[id]?.filename ?? id }));
  return dedupeNames(raw);
}

export function dedupeNames(entries: ZipEntry[]): ZipEntry[] {
  const used = new Set<string>();
  return entries.map(({ id, name }) => {
    const [base] = splitExt(name);
    let candidate = `${base}.jpg`;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n}).jpg`;
    used.add(candidate.toLowerCase());
    return { id, name: candidate };
  });
}

/** A safe zip filename for a folder: "Hasan.zip", "Shazia Hasan.zip". */
export function zipName(folder: Folder): string {
  return `${folder.name.replace(/[\\/:*?"<>|]/g, "").trim() || "photos"}.zip`;
}

export type SearchItem = { name: string; path: string; count: number; family?: string };

/** Every family and person, for the search box. People carry their family's name. */
export function searchIndex(manifest: Manifest): SearchItem[] {
  return manifest.folders.flatMap((f) => [
    { name: f.name, path: f.path, count: f.photoIds.length },
    ...f.children.map((c) => ({ name: c.name, path: c.path, count: c.photoIds.length, family: f.name })),
  ]);
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/["'“”‘’()]/g, "").toLowerCase();

/**
 * Matches items whose name contains every word of the query (ignoring case, accents, quotes and
 * brackets, so `baba` finds `Ghias "Baba" Asadi`). Names where a word starts with the query rank first.
 */
export function searchFolders(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = items.flatMap((item) => {
    const name = fold(item.name);
    if (!words.every((w) => name.includes(w))) return [];
    const nameWords = name.split(/\s+/);
    const prefixHits = words.filter((w) => nameWords.some((nw) => nw.startsWith(w))).length;
    return [{ item, score: prefixHits * 1000 + Math.min(item.count, 999) }];
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}
