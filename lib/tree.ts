// The family tree: people, parent links and marriages, plus the pure operations that change them.
// Everything here is plain data in and out so it can be unit-tested and shared with the browser.

export type Person = {
  id: string;
  name: string;
  nickname?: string;
  birth?: string; // free text: "1941", "1941-03-02", "about 1940"
  death?: string;
  notes?: string;
  linkedPersonId?: number; // id of the named person in family_facial_recognition
};

export type ParentLink = { child: string; parent: string };
export type Union = { id: string; a: string; b: string; date?: string; place?: string };

export type Snapshot = { people: Record<string, Person>; parents: ParentLink[]; unions: Union[] };
export type HistoryEntry = { id: string; at: string; who: string; summary: string; before: Snapshot };
export type Tree = Snapshot & { rev: number; root?: string; history: HistoryEntry[] };
export type PublicTree = Omit<Tree, "history"> & { history: Omit<HistoryEntry, "before">[] };

export type PersonFields = {
  name: string;
  nickname?: string;
  birth?: string;
  death?: string;
  notes?: string;
};
/** Either a brand-new person or one already in the tree. */
export type NewOrExisting = PersonFields | { existing: string };

export type Op =
  | { type: "addParent"; of: string; person: NewOrExisting }
  | { type: "addChild"; of: string; person: NewOrExisting; with?: string }
  | { type: "addSibling"; of: string; person: NewOrExisting }
  | { type: "addPartner"; of: string; person: NewOrExisting; date?: string; place?: string }
  | { type: "updatePerson"; id: string; fields: Partial<PersonFields> }
  | { type: "updateUnion"; id: string; date?: string; place?: string }
  | { type: "removeUnion"; id: string }
  | { type: "removeParentLink"; child: string; parent: string }
  | { type: "removePerson"; id: string }
  | { type: "link"; id: string; linkedPersonId: number | null }
  | { type: "undo"; entryId: string };

export class TreeError extends Error {}

export const HISTORY_LIMIT = 20;
const MAX = { name: 120, nickname: 80, date: 40, notes: 1000, place: 120, who: 60 };

export function emptyTree(): Tree {
  return { rev: 0, people: {}, parents: [], unions: [], history: [] };
}

// ---------- reading ----------

export const parentsOf = (t: Snapshot, id: string): string[] =>
  t.parents.filter((l) => l.child === id).map((l) => l.parent);

export const childrenOf = (t: Snapshot, id: string): string[] =>
  t.parents.filter((l) => l.parent === id).map((l) => l.child);

/** Everyone `id` is married to / partnered with, with the union that links them. */
export function partnersOf(t: Snapshot, id: string): { partner: string; union: Union }[] {
  return t.unions
    .filter((u) => u.a === id || u.b === id)
    .map((union) => ({ partner: union.a === id ? union.b : union.a, union }));
}

export function siblingsOf(t: Snapshot, id: string): string[] {
  const mine = new Set(parentsOf(t, id));
  if (!mine.size) return [];
  const out = new Set<string>();
  for (const l of t.parents) if (mine.has(l.parent) && l.child !== id) out.add(l.child);
  return [...out];
}

/** First 4-digit year in a free-text date, for sorting. */
export function yearOf(text?: string): number | null {
  const m = text?.match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/** Oldest first; people without a birth year go last, in their existing order. */
export function byBirth(t: Snapshot, ids: string[]): string[] {
  const key = (id: string) => yearOf(t.people[id]?.birth) ?? Infinity;
  return [...ids].sort((a, b) => key(a) - key(b));
}

function ancestorsOf(t: Snapshot, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    for (const p of parentsOf(t, stack.pop()!)) {
      if (seen.has(p)) continue;
      seen.add(p);
      stack.push(p);
    }
  }
  return seen;
}

/** "1900–1974", "b. 1941", "d. 1999", or "" when there is nothing to show. */
export function lifespan(p: Person): string {
  if (p.birth && p.death) return `${p.birth}–${p.death}`;
  if (p.birth) return `b. ${p.birth}`;
  if (p.death) return `d. ${p.death}`;
  return "";
}

export function publicTree(t: Tree): PublicTree {
  return {
    ...t,
    history: t.history.map((h) => ({ id: h.id, at: h.at, who: h.who, summary: h.summary })),
  };
}

// ---------- changing ----------

const clean = (s: unknown, max: number): string | undefined => {
  if (typeof s !== "string") return undefined;
  const v = s.trim().replace(/\s+/g, " ").slice(0, max);
  return v || undefined;
};

function cleanFields(f: Partial<PersonFields>, requireName: boolean): Partial<PersonFields> {
  const out: Partial<PersonFields> = {};
  const name = clean(f.name, MAX.name);
  if (requireName && !name) throw new TreeError("A name is needed.");
  if ("name" in f) {
    if (!name) throw new TreeError("A name is needed.");
    out.name = name;
  }
  for (const [k, max] of [["nickname", MAX.nickname], ["birth", MAX.date], ["death", MAX.date]] as const) {
    if (k in f) out[k] = clean(f[k], max);
  }
  if ("notes" in f) out.notes = clean(f.notes, MAX.notes);
  return out;
}

export type Ctx = { who: string; now: string; newId: () => string };

const snapshot = (t: Snapshot): Snapshot => structuredClone({ people: t.people, parents: t.parents, unions: t.unions });

function need(t: Snapshot, id: string): Person {
  const p = t.people[id];
  if (!p) throw new TreeError("That person is no longer in the tree.");
  return p;
}

/** Adds a new person, or returns the id of an existing one. */
function resolve(t: Snapshot, who: NewOrExisting, ctx: Ctx): string {
  if ("existing" in who) return need(t, who.existing).id;
  const id = ctx.newId();
  t.people[id] = { id, ...(cleanFields(who, true) as PersonFields) };
  return id;
}

function addLink(t: Snapshot, child: string, parent: string) {
  if (child === parent) throw new TreeError("Someone can't be their own parent.");
  if (t.parents.some((l) => l.child === child && l.parent === parent)) {
    throw new TreeError("They are already linked that way.");
  }
  if (parentsOf(t, child).length >= 2) {
    throw new TreeError(`${t.people[child].name} already has two parents.`);
  }
  if (ancestorsOf(t, parent).has(child)) {
    throw new TreeError(`${t.people[child].name} is already an ancestor of ${t.people[parent].name}.`);
  }
  t.parents.push({ child, parent });
}

const label = (t: Snapshot, id: string) => t.people[id]?.name ?? "someone";

/**
 * Applies one edit and returns the new tree (the input is not modified). Throws TreeError with a
 * message fit to show the person who tried it.
 */
export function applyOp(tree: Tree, op: Op, ctx: Ctx): Tree {
  const who = clean(ctx.who, MAX.who) ?? "Someone";

  if (op.type === "undo") {
    const last = tree.history[tree.history.length - 1];
    if (!last || last.id !== op.entryId) {
      throw new TreeError("That change can't be undone any more, because the tree has changed since.");
    }
    return {
      ...tree,
      ...snapshot(last.before),
      rev: tree.rev + 1,
      history: tree.history.slice(0, -1),
    };
  }

  const before = snapshot(tree);
  const t: Tree = { ...tree, ...snapshot(tree), history: tree.history };
  let summary: string;

  switch (op.type) {
    case "addParent": {
      const child = need(t, op.of).id;
      const parent = resolve(t, op.person, ctx);
      addLink(t, child, parent);
      summary = `added ${label(t, parent)} as a parent of ${label(t, child)}`;
      break;
    }
    case "addChild": {
      const parent = need(t, op.of).id;
      const other = op.with ? need(t, op.with).id : undefined;
      if (other === parent) throw new TreeError("Pick a different second parent.");
      const child = resolve(t, op.person, ctx);
      addLink(t, child, parent);
      if (other) addLink(t, child, other);
      summary = `added ${label(t, child)} as a child of ${label(t, parent)}`;
      break;
    }
    case "addSibling": {
      const sib = need(t, op.of).id;
      const shared = parentsOf(t, sib);
      if (!shared.length) {
        throw new TreeError(`Add a parent for ${label(t, sib)} first, then you can add brothers and sisters.`);
      }
      const person = resolve(t, op.person, ctx);
      for (const p of shared) addLink(t, person, p);
      summary = `added ${label(t, person)} as a brother or sister of ${label(t, sib)}`;
      break;
    }
    case "addPartner": {
      const a = need(t, op.of).id;
      const b = resolve(t, op.person, ctx);
      if (a === b) throw new TreeError("Someone can't be their own partner.");
      if (partnersOf(t, a).some((x) => x.partner === b)) throw new TreeError("They are already partners.");
      const union: Union = { id: ctx.newId(), a, b };
      const date = clean(op.date, MAX.date);
      const place = clean(op.place, MAX.place);
      if (date) union.date = date;
      if (place) union.place = place;
      t.unions.push(union);
      summary = `added ${label(t, b)} as a partner of ${label(t, a)}`;
      break;
    }
    case "updatePerson": {
      const p = need(t, op.id);
      Object.assign(p, cleanFields(op.fields, false));
      for (const k of ["nickname", "birth", "death", "notes"] as const) if (p[k] === undefined) delete p[k];
      summary = `edited ${p.name}`;
      break;
    }
    case "updateUnion": {
      const u = t.unions.find((x) => x.id === op.id);
      if (!u) throw new TreeError("That marriage is no longer in the tree.");
      const date = clean(op.date, MAX.date);
      const place = clean(op.place, MAX.place);
      if (date) u.date = date;
      else delete u.date;
      if (place) u.place = place;
      else delete u.place;
      summary = `edited the marriage of ${label(t, u.a)} and ${label(t, u.b)}`;
      break;
    }
    case "removeUnion": {
      const u = t.unions.find((x) => x.id === op.id);
      if (!u) throw new TreeError("That marriage is no longer in the tree.");
      t.unions = t.unions.filter((x) => x !== u);
      summary = `removed the partnership of ${label(t, u.a)} and ${label(t, u.b)}`;
      break;
    }
    case "removeParentLink": {
      const had = t.parents.length;
      t.parents = t.parents.filter((l) => !(l.child === op.child && l.parent === op.parent));
      if (t.parents.length === had) throw new TreeError("They aren't linked that way any more.");
      summary = `unlinked ${label(t, op.parent)} as a parent of ${label(t, op.child)}`;
      break;
    }
    case "removePerson": {
      const p = need(t, op.id);
      delete t.people[op.id];
      t.parents = t.parents.filter((l) => l.child !== op.id && l.parent !== op.id);
      t.unions = t.unions.filter((u) => u.a !== op.id && u.b !== op.id);
      if (t.root === op.id) t.root = Object.keys(t.people)[0];
      summary = `removed ${p.name}`;
      break;
    }
    case "link": {
      const p = need(t, op.id);
      if (op.linkedPersonId === null) {
        delete p.linkedPersonId;
        summary = `unlinked ${p.name} from a photo name`;
      } else if (Number.isInteger(op.linkedPersonId)) {
        p.linkedPersonId = op.linkedPersonId;
        summary = `linked ${p.name} to their photos`;
      } else {
        throw new TreeError("That photo name isn't valid.");
      }
      break;
    }
    default:
      throw new TreeError("Unknown change.");
  }

  const entry: HistoryEntry = { id: ctx.newId(), at: ctx.now, who, summary: `${who} ${summary}`, before };
  t.history = [...t.history, entry].slice(-HISTORY_LIMIT);
  t.rev = tree.rev + 1;
  return t;
}

// ---------- matching tree people to photo names ----------

export type NamedPerson = { personId: number; name: string; folderPath: string | null };

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/["'“”‘’()]/g, "").toLowerCase();
const tokens = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Photo names that could be this person: every word of the photo name appears in the tree name
 * (or the reverse) ranks highest; a shared first word plus a shared word ranks next.
 */
export function candidatesFor(person: Person, named: NamedPerson[], limit = 5): NamedPerson[] {
  const mine = new Set([...tokens(person.name), ...tokens(person.nickname ?? "")]);
  const first = tokens(person.name)[0];
  const scored = named.flatMap((n) => {
    const theirs = tokens(n.name);
    if (!theirs.length) return [];
    const shared = theirs.filter((t) => mine.has(t)).length;
    const contained = shared === theirs.length || [...mine].every((t) => theirs.includes(t));
    const score = contained && shared >= 2 ? 1000 + shared : theirs[0] === first && shared >= 2 ? 500 + shared : 0;
    return score ? [{ n, score }] : [];
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.n);
}

/** Unlinked people with at least one likely photo name, for the one-click "suggested links" list. */
export function suggestLinks(t: Snapshot, named: NamedPerson[]): { person: Person; candidates: NamedPerson[] }[] {
  const taken = new Set(Object.values(t.people).flatMap((p) => (p.linkedPersonId ? [p.linkedPersonId] : [])));
  return Object.values(t.people).flatMap((person) => {
    if (person.linkedPersonId) return [];
    const candidates = candidatesFor(person, named).filter((c) => !taken.has(c.personId));
    return candidates.length ? [{ person, candidates }] : [];
  });
}

/** Names to search on: name plus nickname, folded. */
export function searchTree(t: Snapshot, query: string, limit = 8): Person[] {
  const words = tokens(query);
  if (!words.length) return [];
  return Object.values(t.people)
    .filter((p) => {
      const hay = tokens(`${p.name} ${p.nickname ?? ""}`);
      return words.every((w) => hay.some((h) => h.startsWith(w) || h.includes(w)));
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}
