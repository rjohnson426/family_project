"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { folderHref, searchFolders, type SearchItem } from "@/lib/manifest";

/** Finds a family or person by name and jumps to their folder. Press "/" to focus. */
export default function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = items ? searchFolders(items, query) : [];

  function load() {
    if (items) return;
    fetch("/api/search")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(item: SearchItem) {
    setOpen(false);
    setQuery("");
    input.current?.blur();
    router.push(folderHref(item.path));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  }

  const showList = open && query.trim().length > 0;
  return (
    <div className="relative w-full sm:w-72">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search people and families"
        placeholder="Search people or families…"
        value={query}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 left-0 z-20 mt-1 max-h-96 overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {items === null && <li className="px-3 py-2 text-sm text-stone-500">Loading…</li>}
          {items !== null && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-stone-500">No one matches “{query.trim()}”.</li>
          )}
          {results.map((item, i) => (
            <li
              key={item.path}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-amber-50" : ""}`}
            >
              <span className="font-medium text-stone-900">{item.name}</span>
              <span className="block text-xs text-stone-500">
                {item.family ? `${item.family} family · ` : ""}
                {item.count.toLocaleString()} {item.count === 1 ? "photo" : "photos"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
