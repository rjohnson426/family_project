import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyOp, childrenOf, emptyTree, parentsOf, partnersOf, siblingsOf, suggestLinks, TreeError,
  type Ctx, type Op, type Tree,
} from "@/lib/tree";
import { CARD_W, layoutTree } from "@/lib/layout";
import { parseCsv, treeFromCsv } from "@/lib/treeImport";
import { SEED_CSV, SEED_ROOT } from "@/lib/treeSeed";

let n = 0;
const ctx = (): Ctx => ({ who: "Rob", now: "2026-10-21T00:00:00Z", newId: () => `id${++n}` });
const run = (t: Tree, op: Op) => applyOp(t, op, ctx());
const idOf = (t: Tree, name: string) => Object.values(t.people).find((p) => p.name === name)!.id;

function small(): Tree {
  // Anna (child), parents Bob and Cara, siblings Dan
  let t = emptyTree();
  t.people.anna = { id: "anna", name: "Anna" };
  t = run(t, { type: "addParent", of: "anna", person: { name: "Bob" } });
  t = run(t, { type: "addParent", of: "anna", person: { name: "Cara" } });
  return t;
}

test("adding a parent, a partner and a child links them", () => {
  let t = small();
  const bob = idOf(t, "Bob");
  const cara = idOf(t, "Cara");
  assert.deepEqual(parentsOf(t, "anna").sort(), [bob, cara].sort());
  t = run(t, { type: "addPartner", of: bob, person: { existing: cara }, date: "1980", place: "Austin" });
  assert.equal(partnersOf(t, bob)[0].union.date, "1980");
  t = run(t, { type: "addChild", of: "anna", person: { name: "Eli", birth: "2010" }, with: undefined });
  assert.equal(childrenOf(t, "anna").length, 1);
});

test("a third parent is refused, and the tree is unchanged", () => {
  const t = small();
  assert.throws(() => run(t, { type: "addParent", of: "anna", person: { name: "Zed" } }), TreeError);
  assert.equal(Object.keys(t.people).length, 3);
});

test("a sibling shares the same parents; without parents it asks for one first", () => {
  let t = small();
  t = run(t, { type: "addSibling", of: "anna", person: { name: "Dan" } });
  const dan = idOf(t, "Dan");
  assert.deepEqual(siblingsOf(t, "anna"), [dan]);
  assert.equal(parentsOf(t, dan).length, 2);
  const lone = emptyTree();
  lone.people.a = { id: "a", name: "A" };
  assert.throws(() => run(lone, { type: "addSibling", of: "a", person: { name: "B" } }), /Add a parent/);
});

test("cycles are refused", () => {
  const t = small();
  const bob = idOf(t, "Bob");
  // Anna is Bob's child; making Anna Bob's parent would loop.
  assert.throws(() => run(t, { type: "addParent", of: bob, person: { existing: "anna" } }), TreeError);
});

test("names are required and trimmed", () => {
  const t = small();
  assert.throws(() => run(t, { type: "addChild", of: "anna", person: { name: "   " } }), /name/);
  const u = run(t, { type: "updatePerson", id: "anna", fields: { name: "  Anna   Lee ", birth: " 1990 " } });
  assert.equal(u.people.anna.name, "Anna Lee");
  assert.equal(u.people.anna.birth, "1990");
  const cleared = run(u, { type: "updatePerson", id: "anna", fields: { birth: "" } });
  assert.equal("birth" in cleared.people.anna, false);
});

test("removing a person removes their links; undo brings everything back", () => {
  let t = small();
  const bob = idOf(t, "Bob");
  t = run(t, { type: "removePerson", id: bob });
  assert.equal(parentsOf(t, "anna").length, 1);
  assert.equal(t.people[bob], undefined);
  const entry = t.history[t.history.length - 1];
  t = run(t, { type: "undo", entryId: entry.id });
  assert.equal(parentsOf(t, "anna").length, 2);
  assert.ok(t.people[bob]);
});

test("undo only works on the latest change", () => {
  let t = small();
  const first = t.history[0];
  t = run(t, { type: "updatePerson", id: "anna", fields: { name: "Anna B" } });
  assert.throws(() => run(t, { type: "undo", entryId: first.id }), /can't be undone/);
});

test("the input tree is never modified", () => {
  const t = small();
  const copy = JSON.stringify(t);
  run(t, { type: "addChild", of: "anna", person: { name: "Eli" } });
  assert.equal(JSON.stringify(t), copy);
});

test("history keeps an entry for who changed what", () => {
  const t = run(small(), { type: "link", id: "anna", linkedPersonId: 124 });
  assert.equal(t.people.anna.linkedPersonId, 124);
  assert.match(t.history.at(-1)!.summary, /^Rob linked Anna/);
});

test("photo-name suggestions match on shared words and skip taken ones", () => {
  const t = small();
  t.people.anna.name = "Syed Mahmood Hasan";
  const named = [
    { personId: 1, name: "Mahmood Hasan", folderPath: "Hasan/Mahmood Hasan" },
    { personId: 2, name: "Shazia Hasan", folderPath: null },
  ];
  const s = suggestLinks(t, named);
  assert.equal(s.length, 1);
  assert.equal(s[0].candidates[0].personId, 1);
  t.people.bob = { ...t.people[idOf(t, "Bob")], linkedPersonId: 1 };
  assert.equal(suggestLinks(t, named).length, 0);
});

test("CSV parsing handles quotes and blank lines", () => {
  assert.deepEqual(parseCsv('a,"b, c",d\n\n"x ""y""",2,3\n'), [["a", "b, c", "d"], ['x "y"', "2", "3"]]);
});

test("CSV import links parents and partners by id or name and reports gaps", () => {
  const csv = "id,name,birth,death,father_id,mother_id,partner_id,marriage_date\n" +
    "a,Al,1900,,,,b,1925\nb,Bea,1905,,,,,\nc,Cy,1930,,a,Bea,,\nd,Di,,,ghost,,,\n";
  const { tree, problems } = treeFromCsv(csv);
  assert.deepEqual(parentsOf(tree, "c").sort(), ["a", "b"]);
  assert.equal(partnersOf(tree, "a")[0].union.date, "1925");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ghost/);
});

test("the bundled starter tree loads cleanly and joins both families", () => {
  const { tree, problems } = treeFromCsv(SEED_CSV, SEED_ROOT);
  assert.deepEqual(problems, []);
  assert.equal(Object.keys(tree.people).length, 29);
  assert.equal(tree.root, "shazia");
  assert.deepEqual(parentsOf(tree, "shazia").sort(), ["mahmood", "shehrzad"]);
  assert.equal(childrenOf(tree, "ahmad").length, 10);
  assert.equal(childrenOf(tree, "ghias").length, 6);
});

test("layout puts ancestors above, partners beside and children below", () => {
  const { tree } = treeFromCsv(SEED_CSV, SEED_ROOT);
  const L = layoutTree(tree, "mahmood");
  const at = (id: string) => L.nodes.find((x) => x.id === id)!;
  assert.ok(at("ahmad").y < at("mahmood").y && at("barkat").y < at("ahmad").y);
  assert.ok(at("shehrzad").x > at("mahmood").x && at("shehrzad").y === at("mahmood").y);
  assert.ok(at("shazia").y > at("mahmood").y);
  assert.equal(L.nodes.filter((x) => x.role === "sibling").length, 9);
  // No two cards overlap in the same row.
  for (const a of L.nodes) for (const b of L.nodes) {
    if (a !== b && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= CARD_W, `${a.id} overlaps ${b.id}`);
  }
});

test("treeFocusFor picks the linked person, then the name, then the family surname", async () => {
  const { treeFocusFor } = await import("@/lib/treeFocus");
  const t = emptyTree();
  t.people.a = { id: "a", name: "Matloob Hasan", linkedPersonId: 7 };
  t.people.b = { id: "b", name: "Abid Hasan" };
  const named = [{ personId: 7, name: "Matloob Hasan", folderPath: "Hasan/Matloob Hasan" }];
  assert.equal(treeFocusFor(t, named, { path: "Hasan/Matloob Hasan", name: "Matloob Hasan" }), "a");
  assert.equal(treeFocusFor(t, named, { path: "Hasan/Abid Hasan", name: "Abid Hasan" }), "b");
  assert.equal(treeFocusFor(t, named, { path: "Hasan", name: "Hasan" }), "a");
  assert.equal(treeFocusFor(t, named, { path: "Hasan/Zed", name: "Zed" }), undefined);
});
