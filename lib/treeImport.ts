// Turns a CSV of people into a tree. Columns (extra ones are ignored, all but name optional):
//   id, name, nickname, birth, death, father_id, mother_id, partner_id, marriage_date
// Parents and partners may be given as an id from the `id` column or as a name; anything that
// can't be matched is reported instead of failing the whole import.
import { emptyTree, type Tree } from "./tree";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export type ImportResult = { tree: Tree; problems: string[] };

export function treeFromCsv(text: string, root?: string): ImportResult {
  const [head, ...body] = parseCsv(text.replace(/^﻿/, ""));
  const problems: string[] = [];
  const tree = emptyTree();
  if (!head) return { tree, problems: ["The file is empty."] };
  const col = Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase().replace(/\s+/g, "_"), i]));
  if (col.name === undefined) return { tree, problems: ['The file needs a "name" column.'] };
  const get = (r: string[], k: string) => (col[k] === undefined ? "" : (r[col[k]] ?? "").trim());

  const ids = new Map<string, string>(); // csv id or lowercase name -> person id
  const rowsWithId: { r: string[]; id: string }[] = [];
  body.forEach((r, i) => {
    const name = get(r, "name");
    if (!name) return void problems.push(`Row ${i + 2}: no name, skipped.`);
    const id = get(r, "id") || `p${i + 1}`;
    if (tree.people[id]) return void problems.push(`Row ${i + 2}: id "${id}" is used twice, skipped.`);
    tree.people[id] = { id, name };
    for (const k of ["nickname", "birth", "death", "notes"] as const) {
      const v = get(r, k);
      if (v) tree.people[id][k] = v;
    }
    ids.set(id.toLowerCase(), id);
    if (!ids.has(name.toLowerCase())) ids.set(name.toLowerCase(), id);
    rowsWithId.push({ r, id });
  });

  const find = (ref: string, row: string[], what: string): string | undefined => {
    if (!ref) return undefined;
    const hit = ids.get(ref.toLowerCase());
    if (!hit) problems.push(`${tree.people[rowsWithId.find((x) => x.r === row)!.id].name}: can't find ${what} "${ref}".`);
    return hit;
  };

  let unionN = 0;
  for (const { r, id } of rowsWithId) {
    for (const k of ["father_id", "mother_id"]) {
      const p = find(get(r, k), r, k.replace("_id", ""));
      if (p && p !== id && !tree.parents.some((l) => l.child === id && l.parent === p)) tree.parents.push({ child: id, parent: p });
    }
    const partner = find(get(r, "partner_id"), r, "partner");
    if (partner && partner !== id && !tree.unions.some((u) => (u.a === id && u.b === partner) || (u.a === partner && u.b === id))) {
      const date = get(r, "marriage_date");
      tree.unions.push({ id: `u${++unionN}`, a: id, b: partner, ...(date && { date }) });
    }
  }

  tree.root = root && tree.people[root] ? root : rowsWithId[0]?.id;
  return { tree, problems };
}
