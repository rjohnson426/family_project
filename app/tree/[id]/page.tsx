import { redirect } from "next/navigation";
import { connection } from "next/server";
import Header from "@/components/Header";
import TreeApp from "@/components/TreeApp";
import { getNamedPeople } from "@/lib/people";
import { publicTree } from "@/lib/tree";
import { getTree } from "@/lib/treeStore";

export const metadata = { title: "Family tree · Family Photos" };

export default async function TreePage({ params }: PageProps<"/tree/[id]">) {
  await connection(); // the tree changes whenever anyone edits it
  const { id } = await params;
  const [tree, named] = await Promise.all([getTree(), getNamedPeople()]);
  if (!tree.people[id]) redirect("/tree");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-4">
        <TreeApp initialTree={publicTree(tree)} named={named} initialFocus={id} />
      </main>
    </>
  );
}
