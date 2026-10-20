import FolderCards from "@/components/FolderCards";
import Header from "@/components/Header";
import { connection } from "next/server";
import { getManifest } from "@/lib/store";

export default async function Home() {
  await connection(); // read the manifest per request, not at build time
  const manifest = await getManifest();
  const total = Object.keys(manifest.photos).length;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-serif text-3xl text-stone-900">Families</h1>
        <p className="mt-1 mb-6 text-stone-600">
          {total.toLocaleString()} photos, grouped by last name. Open a family to see each person.
        </p>
        <FolderCards folders={manifest.folders} />
      </main>
    </>
  );
}
