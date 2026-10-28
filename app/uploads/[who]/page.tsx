import Link from "next/link";
import { connection } from "next/server";
import Header from "@/components/Header";
import PhotoGrid, { TileSizeToggle } from "@/components/PhotoGrid";
import { UPLOADS_PREFIX } from "@/lib/manifest";
import { getManifest } from "@/lib/store";
import { cleanName } from "@/lib/uploads";

export default async function UploaderPage({ params }: PageProps<"/uploads/[who]">) {
  await connection();
  const who = cleanName(decodeURIComponent((await params).who));
  const ids = (await getManifest()).uploaders?.[who] ?? [];
  return (
    <>
      <Header path={`Uploads/${who}`} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl text-stone-900">Uploaded by {who}</h1>
          <div className="flex items-center gap-5">
            <TileSizeToggle />
            <Link href="/upload" className="rounded-lg bg-[#115740] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0d4432]">Upload photos</Link>
          </div>
        </div>
        {ids.length ? (
          <div className="mt-6"><PhotoGrid ids={[...ids].reverse()} from={`${UPLOADS_PREFIX}/${who}`} /></div>
        ) : (
          <p className="mt-6 text-stone-600">Nothing uploaded yet. Photos you add will show up here for everyone.</p>
        )}
      </main>
    </>
  );
}
