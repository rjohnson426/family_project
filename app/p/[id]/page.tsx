import { notFound } from "next/navigation";
import PhotoViewer from "@/components/PhotoViewer";
import { findFolder, folderHref, photoHref } from "@/lib/manifest";
import { getManifest } from "@/lib/store";

export default async function PhotoPage({ params, searchParams }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const { from } = await searchParams;
  const manifest = await getManifest();
  const photo = manifest.photos[id];
  if (!photo) notFound();

  const folder = typeof from === "string" ? findFolder(manifest, from.split("/")) : null;
  const ids = folder?.photoIds ?? [id];
  const index = Math.max(ids.indexOf(id), 0);
  const href = (i: number) => (folder && ids[i] ? photoHref(ids[i], folder.path) : null);

  return (
    <PhotoViewer
      id={id}
      photo={photo}
      position={folder ? `${index + 1} of ${ids.length}` : ""}
      folderName={folder?.name ?? "Home"}
      backHref={folder ? folderHref(folder.path) : "/"}
      prevHref={href(index - 1)}
      nextHref={href(index + 1)}
    />
  );
}
