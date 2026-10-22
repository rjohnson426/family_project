"use client";

import { useSyncExternalStore } from "react";

export type FolderSort = "count" | "name";
const KEY = "fp:folder-sort";
const listeners = new Set<() => void>();

function readSort(): FolderSort {
  try {
    return localStorage.getItem(KEY) === "name" ? "name" : "count";
  } catch {
    return "count";
  }
}

function setSort(sort: FolderSort) {
  try {
    localStorage.setItem(KEY, sort);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** How folder cards are ordered: most photos first (default) or A–Z. Remembered across pages. */
export function useFolderSort(): FolderSort {
  return useSyncExternalStore(subscribe, readSort, () => "count");
}

const LABELS: Record<FolderSort, string> = { count: "Count", name: "A–Z" };

export function FolderSortToggle() {
  const sort = useFolderSort();
  return (
    <div role="group" aria-label="Sort folders" className="flex items-center gap-2 text-sm">
      <span className="text-stone-500">Sort</span>
      <div className="flex rounded-lg border border-stone-300 bg-white p-0.5">
        {(["count", "name"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={sort === s}
            onClick={() => setSort(s)}
            className={`rounded-md px-3 py-1 ${sort === s ? "bg-[#2e7d62] text-white" : "text-stone-700 hover:bg-stone-100"}`}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
