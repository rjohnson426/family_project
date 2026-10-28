import Link from "next/link";
import { connection } from "next/server";
import Header from "@/components/Header";
import { imgSrc } from "@/lib/manifest";
import { getManifest } from "@/lib/store";

export const metadata = { title: "Family uploads · Family Photos" };

export default async function UploadsPage() {
  await connection();
  const uploaders = Object.entries((await getManifest()).uploaders ?? {}).sort((a, b) => b[1].length - a[1].length);
  return (
    <>
      <Header path="Uploads" />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl text-stone-900">Family uploads</h1>
          <Link href="/upload" className="rounded-lg bg-[#115740] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0d4432]">Upload photos</Link>
        </div>
        {uploaders.length === 0 && <p className="mt-6 text-stone-600">No one has uploaded photos yet.</p>}
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {uploaders.map(([who, ids]) => (
            <li key={who}>
              <Link href={`/uploads/${encodeURIComponent(who)}`} className="block overflow-hidden rounded-xl border border-stone-200 bg-white hover:border-[#115740]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(ids[ids.length - 1], "thumb")} alt="" className="aspect-square w-full object-cover" />
                <div className="p-3"><p className="font-medium text-stone-900">{who}</p><p className="text-sm text-stone-500">{ids.length} photo{ids.length === 1 ? "" : "s"}</p></div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
