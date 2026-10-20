import Link from "next/link";
import { folderHref, imgSrc, type Folder } from "@/lib/manifest";

export default function FolderCards({ folders }: { folders: Folder[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {folders.map((f) => (
        <li key={f.path}>
          <Link href={folderHref(f.path)} className="group block">
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-stone-200">
              {f.photoIds[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc(f.photoIds[0], "thumb")}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              )}
            </div>
            <p className="mt-2 truncate font-medium text-stone-900 group-hover:text-amber-800">{f.name}</p>
            <p className="text-sm text-stone-500">
              {f.children.length > 0 && `${f.children.length} ${f.children.length === 1 ? "person" : "people"} · `}
              {f.photoIds.length.toLocaleString()} {f.photoIds.length === 1 ? "photo" : "photos"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
