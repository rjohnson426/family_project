import { redirect } from "next/navigation";
import { connection } from "next/server";
import Header from "@/components/Header";
import TreeApp from "@/components/TreeApp";
import { getNamedPeople } from "@/lib/people";
import { publicTree } from "@/lib/tree";
import { getTree, storeName } from "@/lib/treeStore";

export const metadata = { title: "Family tree · Family Photos" };

export default async function TreePage({ params }: PageProps<"/tree/[id]">) {
  await connection(); // the tree changes whenever anyone edits it
  const { id } = await params;
  const [tree, named] = await Promise.all([getTree(), getNamedPeople()]);
  if (!tree.people[id]) redirect("/tree");
  return (
    <>
      <Header wide />
      <main className="px-4 py-4">
        <TreeApp initialTree={publicTree(tree)} named={named} initialFocus={id} />
        <p className="mt-6 text-xs text-stone-400">
          Saved in {{ postgres: "the database (Postgres)", blob: "file storage (Blob)", local: "a local file" }[storeName()]}
          {process.env.VERCEL_GIT_COMMIT_SHA ? ` · version ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}
        </p>
      </main>
    </>
  );
}
