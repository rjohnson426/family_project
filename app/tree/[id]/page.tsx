import { redirect } from "next/navigation";
import { connection } from "next/server";
import Header from "@/components/Header";
import TreeApp from "@/components/TreeApp";
import { searchIndex } from "@/lib/manifest";
import { getNamedPeople } from "@/lib/people";
import { getManifest } from "@/lib/store";
import { albumsFor } from "@/lib/treeFocus";
import { publicTree } from "@/lib/tree";
import { getTree, storeName } from "@/lib/treeStore";

export const metadata = { title: "Family tree · Family Photos" };

export default async function TreePage({ params }: PageProps<"/tree/[id]">) {
  await connection(); // the tree changes whenever anyone edits it
  const { id } = await params;
  const [tree, named, manifest] = await Promise.all([getTree(), getNamedPeople(), getManifest().catch(() => null)]);
  if (!tree.people[id]) redirect("/tree");
  const albums = manifest ? albumsFor(tree, named, searchIndex(manifest)) : {};
  return (
    <>
      <Header wide />
      <main className="px-4 py-4">
        <TreeApp initialTree={publicTree(tree)} named={named} albums={albums} initialFocus={id} />
        <p className="mt-6 text-xs text-stone-400">
          Saved in {{ postgres: "the database (Postgres)", blob: "file storage (Blob)", local: "a local file" }[storeName()]}
          {process.env.VERCEL_GIT_COMMIT_SHA ? ` · version ${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}
        </p>
      </main>
    </>
  );
}
