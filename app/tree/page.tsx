import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTree } from "@/lib/treeStore";

export default async function TreeIndex() {
  await connection();
  const tree = await getTree();
  const first = tree.root && tree.people[tree.root] ? tree.root : Object.keys(tree.people)[0];
  redirect(first ? `/tree/${first}` : "/");
}
