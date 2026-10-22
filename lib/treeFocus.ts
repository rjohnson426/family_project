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
