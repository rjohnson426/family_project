// The folder tree and photo list, written by `export-web` in family_facial_recognition.

export type Folder = {
  name: string;
  path: string; // "Hasan", "Hasan/Shazia Hasan", "Hasan/Hasan Family Friends/Hamilton/John Hamilton"
  photoIds: string[]; // the folder's own photos plus every photo below it, each once
  children: Folder[];
  own?: string[]; // photos placed directly in it, when it also has subfolders
  section?: "bottom"; // top-level folders shown after the families (Famous Figures, Places and Locations)
};

export type Photo = { filename: string; w: number; h: number; hash: string };

export type Manifest = {
  generatedAt: string;
  folders: Folder[];
  photos: Record<string, Photo>;
};

/** Albums folded into their parent folder so they don't show as a separate album. */
export const MERGED_ALBUMS = ["Hasan/Shazia Hasan/Shazia First Haircut"];

/** Removes the merged albums, keeping their photos in the parent folder (own photos and total). */
export function mergeAlbums(manifest: Manifest, paths: string[] = MERGED_ALBUMS): Manifest {
  const walk = (folders: Folder[]): Folder[] =>
    folders.map((f) => {
      const merged = f.children.filter((c) => paths.includes(c.path));
      const children = walk(f.children.filter((c) => !paths.includes(c.path)));
      if (!merged.length) return { ...f, children };
      const extra = merged.flatMap((c) => c.photoIds);
      const unique = (ids: string[]) => [...new Set(ids)];
      return {
        ...f,
        children,
        photoIds: unique([...f.photoIds, ...extra]),
        own: unique([...(f.own ?? (f.children.length ? [] : f.photoIds)), ...extra]),
      };
    });
  return { ...manifest, folders: walk(manifest.folders) };
}

export const SIZES = ["thumb", "large", "full"] as const;
export type Size = (typeof SIZES)[number];

export function isSize(s: string): s is Size {
  return (SIZES as readonly string[]).includes(s);
}

/** Path of the "All photos" view: every photo once, no folders. Can't clash with a name. */
export const ALL_PATH = "*";

export function allPhotos(manifest: Manifest): Folder {
  const photoIds = Object.keys(manifest.photos).sort((a, b) => Number(a) - Number(b));
  return { name: "All photos", path: ALL_PATH, photoIds, children: [] };
}

/** Largest album first, then by name. */
export function byCount(folders: Folder[]): Folder[] {
  return [...folders].sort(
    (a, b) => b.photoIds.length - a.photoIds.length || a.name.localeCompare(b.name),
  );
}

/** A–Z by name, ignoring case, accents, quotes and brackets (so `"Ashu" Ahmed` sorts under A). */
export function byName(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => fold(a.name).localeCompare(fold(b.name)));
}

/** The home page: families first, then the bottom section, each largest first. */
export function homeSections(manifest: Manifest): { families: Folder[]; bottom: Folder[] } {
  const sorted = byCount(manifest.folders);
  return {
    families: sorted.filter((f) => f.section !== "bottom"),
    bottom: sorted.filter((f) => f.section === "bottom"),
  };
}

/**
 * "people" for a family whose subfolders are all people; "albums" when the folder has photos of
 * its own (a person with sub-albums) or some subfolders hold further folders.
 */
export function childLabel(folder: Folder): "people" | "albums" {
  return folder.own?.length || folder.children.some((c) => c.children.length) ? "albums" : "people";
}

/** Finds a folder by its path segments (already URL-decoded). */
export function findFolder(manifest: Manifest, segments: string[]): Folder | null {
  if (segments.length === 1 && segments[0] === ALL_PATH) return allPhotos(manifest);
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
  if (path === ALL_PATH) return "/all";
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
 * The files a folder's zip holds, mirroring its subfolders at any depth (a photo of two people
 * appears in both); photos placed directly in the folder sit at the top. Clashing names get
 * " (2)", " (3)"…; the served files are always JPEGs, so every name ends in .jpg.
 */
export function zipEntries(manifest: Manifest, folder: Folder): ZipEntry[] {
  const walk = (f: Folder, prefix: string): ZipEntry[] => {
    const own = f.children.length ? (f.own ?? []) : f.photoIds;
    return [
      ...own.map((id) => ({ id, name: prefix + (manifest.photos[id]?.filename ?? id) })),
      ...f.children.flatMap((child) => walk(child, `${prefix}${child.name}/`)),
    ];
  };
  return dedupeNames(walk(folder, ""));
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

/** Every folder at any depth, for the search box. Subfolders carry their parent's name. */
export function searchIndex(manifest: Manifest): SearchItem[] {
  const walk = (folders: Folder[], parent?: string): SearchItem[] =>
    folders.flatMap((f) => [
      { name: f.name, path: f.path, count: f.photoIds.length, ...(parent && { family: parent }) },
      ...walk(f.children, f.name),
    ]);
  return walk(manifest.folders);
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
