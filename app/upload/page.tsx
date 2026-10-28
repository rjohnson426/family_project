import { connection } from "next/server";
import Header from "@/components/Header";
import UploadApp from "@/components/UploadApp";
import { getNamedPeople } from "@/lib/people";
import { fold } from "@/lib/uploads";
import { listUploads } from "@/lib/uploadsStore";

export const metadata = { title: "Upload photos · Family Photos" };

export default async function UploadPage() {
  await connection();
  const [named, uploads] = await Promise.all([getNamedPeople(), listUploads().catch(() => [])]);
  // Everyone already named, plus people added from earlier uploads, for the name suggestions.
  const known = new Map<string, { name: string; personId: number | null }>(
    named.map((p) => [fold(p.name), { name: p.name, personId: p.personId }]),
  );
  for (const t of uploads.flatMap((u) => u.tags)) if (!known.has(fold(t.name))) known.set(fold(t.name), { name: t.name, personId: t.personId });
  return (
    <>
      <Header path="Upload" />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="font-serif text-3xl text-stone-900">Upload photos</h1>
        <p className="mt-1 mb-6 text-stone-600">
          Add one photo or many. We&apos;ll suggest who&apos;s in them from the people already named, and a new name
          starts a new folder. Everyone with the password can see what you add.
        </p>
        <UploadApp known={[...known.values()].sort((a, b) => a.name.localeCompare(b.name))} />
      </main>
    </>
  );
}
