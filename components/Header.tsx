import Link from "next/link";
import { folderHref } from "@/lib/manifest";
import SearchBox from "./SearchBox";

/** Breadcrumb header. `path` is the current folder path ("Hasan/Shazia Hasan"), empty at home. */
export default function Header({ path, children }: { path?: string; children?: React.ReactNode }) {
  const parts = path ? path.split("/") : [];
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
          <Link href="/" className="font-serif text-lg text-stone-900 hover:text-amber-800">
            Family Photos
          </Link>
          {parts.map((part, i) => {
            const last = i === parts.length - 1;
            const href = folderHref(parts.slice(0, i + 1).join("/"));
            return (
              <span key={href} className="flex min-w-0 items-center gap-1">
                <span aria-hidden className="text-stone-400">/</span>
                {last ? (
                  <span aria-current="page" className="truncate font-medium text-stone-900">{part}</span>
                ) : (
                  <Link href={href} className="truncate text-stone-600 hover:text-amber-800">{part}</Link>
                )}
              </span>
            );
          })}
        </nav>
        <Link href="/all" className="text-sm font-medium text-stone-700 hover:text-amber-800">
          All photos
        </Link>
        <Link href="/tree" className="text-sm font-medium text-stone-700 hover:text-amber-800">
          Family tree
        </Link>
        <SearchBox />
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
