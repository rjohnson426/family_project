import Header from "@/components/Header";
import PhotoGrid, { TileSizeToggle } from "@/components/PhotoGrid";
import SubNav from "@/components/SubNav";
import ZipButton from "@/components/ZipButton";
import { allPhotos, zipEntries } from "@/lib/manifest";
import { connection } from "next/server";
import { getManifest } from "@/lib/store";

export const metadata = { title: "All photos · Family Photos" };

export default async function AllPhotosPage() {
  await connection(); // read the manifest per request, not at build time
  const manifest = await getManifest();
  const all = allPhotos(manifest);
  return (
    <>
      <Header path={all.name}>
        <SubNav>
          <TileSizeToggle />
          <ZipButton entries={zipEntries(manifest, all)} filename="All family photos.zip" />
        </SubNav>
      </Header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-serif text-3xl text-stone-900">All photos</h1>
        <p className="mt-1 mb-6 text-stone-600">
          Every photo once, {all.photoIds.length.toLocaleString()} in all, without the family folders.
        </p>
        <PhotoGrid ids={all.photoIds} from={all.path} />
      </main>
    </>
  );
}
