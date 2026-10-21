import { notFound } from "next/navigation";
import FolderCards from "@/components/FolderCards";
import Header from "@/components/Header";
import PhotoGrid, { TileSizeToggle } from "@/components/PhotoGrid";
import ZipButton from "@/components/ZipButton";
import { byCount, childLabel, findFolder, zipEntries, zipName } from "@/lib/manifest";
import { getManifest } from "@/lib/store";

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

  return (
    <>
      <Header path={folder.path}>
        <TileSizeToggle />
        <ZipButton entries={zipEntries(manifest, folder)} filename={zipName(folder)} />
      </Header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-serif text-3xl text-stone-900">{folder.name}</h1>
        {folder.children.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-medium text-stone-800">
              {childLabel(folder) === "people" ? "People" : "Albums"}
            </h2>
            <FolderCards folders={byCount(folder.children)} />
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
