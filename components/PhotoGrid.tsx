"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { imgSrc, photoHref } from "@/lib/manifest";

type TileSize = "medium" | "large";
const KEY = "fp:tile-size";
const listeners = new Set<() => void>();

function readSize(): TileSize {
  try {
    return localStorage.getItem(KEY) === "large" ? "large" : "medium";
  } catch {
    return "medium";
  }
}

function setSize(size: TileSize) {
  try {
    localStorage.setItem(KEY, size);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTileSize(): TileSize {
  return useSyncExternalStore(subscribe, readSize, () => "medium");
}

export function TileSizeToggle() {
  const size = useTileSize();
  return (
    <div className="flex items-center gap-2 text-sm">
     <span className="text-stone-500">Size</span>
     <div role="group" aria-label="Tile size" className="flex rounded-lg border border-stone-300 bg-white p-0.5">
      {(["medium", "large"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={size === s}
          onClick={() => setSize(s)}
          className={`rounded-md px-3 py-1 capitalize ${size === s ? "bg-[#2e7d62] text-white" : "text-stone-700 hover:bg-stone-100"}`}
        >
          {s}
        </button>
      ))}
     </div>
    </div>
  );
}

export default function PhotoGrid({ ids, from }: { ids: string[]; from: string }) {
  const size = useTileSize();
  const cols =
    size === "large"
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8";
  return (
    <ul className={`grid gap-1.5 sm:gap-2 ${cols}`}>
      {ids.map((id) => (
        <li key={id}>
          <Link href={photoHref(id, from)} className="block aspect-square overflow-hidden rounded-md bg-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(id, size === "large" ? "large" : "thumb")}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition hover:opacity-90"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
