import { notFound } from "next/navigation";
import FolderCards from "@/components/FolderCards";
import { FolderSortToggle } from "@/components/FolderSort";
import Header from "@/components/Header";
import FolderPhotos from "@/components/FolderPhotos";
import { TileSizeToggle } from "@/components/PhotoGrid";
import ZipButton from "@/components/ZipButton";
import { childLabel, findFolder, zipEntries, zipName } from "@/lib/manifest";
import { connection } from "next/server";
import { getCovers } from "@/lib/covers";
import { getNamedPeople } from "@/lib/people";
import { getManifest } from "@/lib/store";
import { getTree } from "@/lib/treeStore";
import { treeFocusFor } from "@/lib/treeFocus";

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export default async function FolderPage({ params }: PageProps<"/f/[...path]">) {
  await connection(); // covers and the tree change whenever the family edits them
  const { path } = await params;
  const [manifest, covers] = await Promise.all([getManifest(), getCovers()]);
  const folder = findFolder(manifest, path.map(decode));
  if (!folder) notFound();

  // Open the family tree on this person or family; the tree still works if it can't be read.
  const treeId = await Promise.all([getTree(), getNamedPeople()])
    .then(([tree, named]) => treeFocusFor(tree, named, folder))
    .catch(() => undefined);

  return (
    <>
      <Header path={folder.path} treeId={treeId} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="font-serif text-3xl text-stone-900">{folder.name}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <TileSizeToggle />
            <ZipButton entries={zipEntries(manifest, folder)} filename={zipName(folder)} />
          </div>
        </div>
        {folder.children.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-stone-800">
                {childLabel(folder) === "people" ? "People" : "Albums"}
              </h2>
              <FolderSortToggle />
            </div>
            <FolderCards folders={folder.children} covers={covers} />
          </section>
        )}
        <FolderPhotos
          ids={folder.photoIds}
          path={folder.path}
          heading={folder.children.length > 0 ? "All photos" : "Photos"}
          count={folder.photoIds.length}
        />
      </main>
    </>
  );
}
