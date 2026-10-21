import FolderCards from "@/components/FolderCards";
import { FolderSortToggle } from "@/components/FolderSort";
import Header from "@/components/Header";
import { connection } from "next/server";
import { allPhotos, homeSections } from "@/lib/manifest";
import { getManifest } from "@/lib/store";

export default async function Home() {
  await connection(); // read the manifest per request, not at build time
  const manifest = await getManifest();
  const total = Object.keys(manifest.photos).length;
  const { families, bottom } = homeSections(manifest);
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-stone-900">Families</h1>
            <p className="mt-1 text-stone-600">
              {total.toLocaleString()} photos, grouped by last name. Open a family to see each person.
            </p>
          </div>
          <FolderSortToggle />
        </div>
        <FolderCards folders={families} />
        {bottom.length > 0 && (
          <section className="mt-12 border-t border-stone-200 pt-8">
            <h2 className="mb-4 font-serif text-2xl text-stone-900">Famous figures and places</h2>
            <FolderCards folders={bottom} />
          </section>
        )}
        <section className="mt-12 border-t border-stone-200 pt-8">
          <h2 className="mb-4 font-serif text-2xl text-stone-900">All photos</h2>
          <FolderCards folders={[allPhotos(manifest)]} />
        </section>
      </main>
    </>
  );
}
