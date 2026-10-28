import Link from "next/link";
import { folderHref } from "@/lib/manifest";
import FeedbackButton from "./FeedbackButton";
import SearchBox from "./SearchBox";

/**
 * Global nav: breadcrumb on the left, search in the centre, then All photos, Family Tree (primary
 * button) and Submit Feedback (secondary). `path` is the current folder path ("Hasan/Shazia Hasan"),
 * empty at home. `treeId` makes Family Tree open on that person; `wide` drops the max width.
 */
export default function Header({
  path,
  treeId,
  wide,
}: {
  path?: string;
  treeId?: string;
  wide?: boolean;
}) {
  const parts = path ? path.split("/") : [];
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-background/95 backdrop-blur">
      <div
        className={`mx-auto grid items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[1fr_minmax(16rem,28rem)_1fr] ${wide ? "" : "max-w-7xl"}`}
      >
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <Link href="/" className="font-serif text-lg text-stone-900 hover:text-[#115740]">
            Family Photos
          </Link>
          {parts.map((part, i) => {
            const last = i === parts.length - 1;
            const href = parts[0] === "Uploads" && i === 0 ? "/uploads" : folderHref(parts.slice(0, i + 1).join("/"));
            return (
              <span key={href} className="flex min-w-0 items-center gap-1">
                <span aria-hidden className="text-stone-400">/</span>
                {last ? (
                  <span aria-current="page" className="truncate font-medium text-stone-900">{part}</span>
                ) : (
                  <Link href={href} className="truncate text-stone-600 hover:text-[#115740]">{part}</Link>
                )}
              </span>
            );
          })}
        </nav>
        <SearchBox />
        <div className="flex items-center gap-3 md:justify-end">
          <FeedbackButton />
          <Link
            href="/upload"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e7d62] bg-white px-3 py-1.5 text-sm font-medium text-[#2e7d62] hover:bg-[#2e7d62]/10"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13V3m0 0L6 7m4-4 4 4M3 13v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
            </svg>
            Upload
          </Link>
          <Link
            href={treeId ? `/tree/${encodeURIComponent(treeId)}` : "/tree"}
            className="rounded-lg bg-[#115740] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0d4432]"
          >
            Family Tree
          </Link>
        </div>
      </div>
    </header>
  );
}
