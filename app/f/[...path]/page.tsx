import { notFound } from "next/navigation";
import FolderCards from "@/components/FolderCards";
import { FolderSortToggle } from "@/components/FolderSort";
import Header from "@/components/Header";
import PhotoGrid, { TileSizeToggle } from "@/components/PhotoGrid";
import SubNav from "@/components/SubNav";
import ZipButton from "@/components/ZipButton";
import { childLabel, findFolder, zipEntries, zipName } from "@/lib/manifest";
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
  const { path } = await params;
  const manifest = await getManifest();
  const folder = findFolder(manifest, path.map(decode));
  if (!folder) notFound();

  // Open the family tree on this person or family; the tree still works if it can't be read.
  const treeId = await Promise.all([getTree(), getNamedPeople()])
    .then(([tree, named]) => treeFocusFor(tree, named, folder))
    .catch(() => undefined);

  return (
    <>
      <Header path={folder.path} treeId={treeId}>
        <SubNav>
          {folder.children.length > 0 && <FolderSortToggle />}
          <TileSizeToggle />
          <ZipButton entries={zipEntries(manifest, folder)} filename={zipName(folder)} />
        </SubNav>
      </Header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-serif text-3xl text-stone-900">{folder.name}</h1>
        {folder.children.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-medium text-stone-800">
              {childLabel(folder) === "people" ? "People" : "Albums"}
            </h2>
            <FolderCards folders={folder.children} />
          </section>
        )}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium text-stone-800">
            {folder.children.length > 0 ? "All photos" : "Photos"}{" "}
            <span className="font-normal text-stone-500">({folder.photoIds.length.toLocaleString()})</span>
          </h2>
          <PhotoGrid ids={folder.photoIds} from={folder.path} />
        </section>
      </main>
    </>
  );
}
