import type { NamedPerson, Snapshot } from "./tree";

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/["'“”‘’()]/g, "").toLowerCase().trim();

/**
 * Who the family tree should open on for a photo folder: the person linked to that folder's
 * photo name, else the person with the folder's name, else the first person with the family's
 * last name. Undefined when nothing matches (the tree then opens on its usual root).
 */
export function treeFocusFor(
  tree: Snapshot,
  named: NamedPerson[],
  folder: { path: string; name: string },
): string | undefined {
  const people = Object.values(tree.people);
  const linkedIds = new Set(named.filter((n) => n.folderPath === folder.path).map((n) => n.personId));
  const linked = people.find((p) => p.linkedPersonId !== undefined && linkedIds.has(p.linkedPersonId));
  if (linked) return linked.id;
  const name = fold(folder.name);
  const exact = people.find((p) => fold(p.name) === name || (p.nickname && fold(p.nickname) === name));
  if (exact) return exact.id;
  if (!folder.path.includes("/")) {
    return people.find((p) => fold(p.name).split(/\s+/).pop() === name)?.id;
  }
  return undefined;
}

/**
 * The album (folder path) for a person in the tree: their linked photo name's folder, else the
 * folder with exactly their name or nickname (the biggest one if several). Missing means no album.
 */
export function albumsFor(
  tree: Snapshot,
  named: NamedPerson[],
  folders: { name: string; path: string; count: number }[],
): Record<string, string> {
  const byName = new Map<string, { path: string; count: number }>();
  for (const f of folders) {
    const k = fold(f.name);
    if ((byName.get(k)?.count ?? -1) < f.count) byName.set(k, f);
  }
  const out: Record<string, string> = {};
  for (const p of Object.values(tree.people)) {
    const linked = named.find((n) => n.personId === p.linkedPersonId)?.folderPath;
    const path = linked ?? byName.get(fold(p.name))?.path ?? (p.nickname ? byName.get(fold(p.nickname))?.path : undefined);
    if (path) out[p.id] = path;
  }
  return out;
}
