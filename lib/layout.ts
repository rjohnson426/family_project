// Positions for the focused tree view: ancestors above, the person and their partners and
// siblings in the middle row, children and grandchildren below. Pure maths, no DOM.
import { byBirth, childrenOf, parentsOf, partnersOf, siblingsOf, type Snapshot } from "./tree";

export const CARD_W = 172;
export const CARD_H = 68;
const GAP_X = 20;
const GAP_Y = 52;
export const UNIT = CARD_W + GAP_X;
const ROW = CARD_H + GAP_Y;

export const ANCESTOR_DEPTH = 3;

export type LNode = {
  key: string;
  id: string;
  x: number; // centre
  y: number; // top
  role: "focus" | "ancestor" | "partner" | "sibling" | "child" | "descendant";
};
/** A child card and the parent cards that sit above it. */
export type LEdge = { child: { x: number; y: number }; parents: { x: number; y: number }[] };
export type LUnion = { x1: number; x2: number; y: number; date?: string };
export type Layout = {
  nodes: LNode[];
  edges: LEdge[];
  unions: LUnion[];
  minX: number;
  maxX: number;
  maxY: number;
  focusX: number;
};

export function layoutTree(t: Snapshot, focus: string): Layout {
  const nodes: LNode[] = [];
  const edges: LEdge[] = [];
  const unions: LUnion[] = [];
  const pos = new Map<string, { x: number; y: number }>(); // first placement of each person, for edges
  const rowY = (gen: number) => gen * ROW;

  const place = (id: string, x: number, gen: number, role: LNode["role"], key = id) => {
    const y = rowY(gen);
    nodes.push({ key, id, x, y, role });
    if (!pos.has(id)) pos.set(id, { x, y });
    return { x, y };
  };

  place(focus, 0, 0, "focus");

  // Ancestors: a person at (level k, slot s) sits above their children at slot positions that
  // double each level, so each couple ends up centred over the child they share.
  const D = ANCESTOR_DEPTH;
  const slotX = (k: number, s: number) => ((s + 0.5) * 2 ** (D - k) - 2 ** D / 2) * UNIT;
  const walkUp = (id: string, k: number, s: number) => {
    if (k >= D) return;
    const kids = { x: slotX(k, s), y: rowY(-k) };
    const ps = parentsOf(t, id).slice(0, 2);
    const placed = ps.map((p, i) => {
      const at = place(p, slotX(k + 1, 2 * s + i), -(k + 1), "ancestor", `${p}@${k + 1}.${2 * s + i}`);
      walkUp(p, k + 1, 2 * s + i);
      return at;
    });
    if (placed.length) edges.push({ child: kids, parents: placed.map((p) => ({ x: p.x, y: p.y + CARD_H })) });
    if (ps.length === 2) {
      const u = partnersOf(t, ps[0]).find((x) => x.partner === ps[1]);
      if (u) unions.push({ x1: placed[0].x, x2: placed[1].x, y: placed[0].y + CARD_H / 2, date: u.union.date });
    }
  };
  walkUp(focus, 0, 0);

  // Middle row: older brothers and sisters to the left, partners to the right.
  const sibs = byBirth(t, siblingsOf(t, focus));
  sibs.forEach((id, i) => place(id, -(sibs.length - i) * UNIT, 0, "sibling"));

  const partners = partnersOf(t, focus);
  partners.forEach(({ partner, union }, i) => {
    const x = (i + 1) * UNIT;
    place(partner, x, 0, "partner");
    unions.push({ x1: i === 0 ? 0 : i * UNIT, x2: x, y: rowY(0) + CARD_H / 2, date: union.date });
  });

  // Descendants: children under the person and partners, grandchildren under each child.
  const groupCentre = (partners.length * UNIT) / 2;
  const kidsOf = (id: string) => byBirth(t, childrenOf(t, id));
  const children = byBirth(t, [...new Set([focus, ...partners.map((p) => p.partner)].flatMap((p) => childrenOf(t, p)))]);
  // children of the person and any partner, whether or not that partner is known
  const widthOf = (id: string) => Math.max(1, kidsOf(id).length);
  const total = children.reduce((n, c) => n + widthOf(c), 0);
  let cursor = -total / 2;
  for (const child of children) {
    const w = widthOf(child);
    const x = groupCentre + (cursor + w / 2) * UNIT;
    cursor += w;
    const at = place(child, x, 1, "child");
    const parentPts = [focus, ...partners.map((p) => p.partner)]
      .filter((p) => parentsOf(t, child).includes(p))
      .map((p) => {
        const q = pos.get(p)!;
        return { x: q.x, y: q.y + CARD_H };
      });
    if (parentPts.length) edges.push({ child: at, parents: parentPts });

    const grand = kidsOf(child);
    grand.forEach((g, i) => {
      const gx = x + (i - (grand.length - 1) / 2) * UNIT;
      const gat = place(g, gx, 2, "descendant");
      edges.push({ child: gat, parents: [{ x: at.x, y: at.y + CARD_H }] });
    });
  }

  const xs = nodes.map((n) => n.x);
  return {
    nodes,
    edges,
    unions,
    minX: Math.min(...xs) - CARD_W / 2,
    maxX: Math.max(...xs) + CARD_W / 2,
    maxY: Math.max(...nodes.map((n) => n.y)) + CARD_H,
    focusX: 0,
  };
}

/** SVG path for one parent→child connection: down from the parent, across, down into the child. */
export function edgePath(parent: { x: number; y: number }, child: { x: number; y: number }): string {
  const midY = child.y - GAP_Y / 2;
  return `M${parent.x},${parent.y} V${midY} H${child.x} V${child.y}`;
}
