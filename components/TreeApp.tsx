"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CARD_H, CARD_W, edgePath, layoutTree } from "@/lib/layout";
import {
  lifespan,
  searchTree,
  suggestLinks,
  type NamedPerson,
  type Op,
  type PublicTree,
} from "@/lib/tree";
import PersonPanel from "./PersonPanel";
import { Avatar } from "./TreeAvatar";

const PAD = 40;
const WHO_KEY = "family-tree-who";

// The editor's name lives in this browser only; it just labels their changes in the history.
const whoListeners = new Set<() => void>();
const readWho = () => {
  try {
    return localStorage.getItem(WHO_KEY) ?? "";
  } catch {
    return "";
  }
};
function useWho(): [string, (v: string) => void] {
  const who = useSyncExternalStore(
    (cb) => {
      whoListeners.add(cb);
      return () => void whoListeners.delete(cb);
    },
    readWho,
    () => "",
  );
  const set = (v: string) => {
    try {
      localStorage.setItem(WHO_KEY, v);
    } catch {}
    whoListeners.forEach((f) => f());
  };
  return [who, set];
}

export default function TreeApp({
  initialTree,
  named,
  initialFocus,
}: {
  initialTree: PublicTree;
  named: NamedPerson[];
  initialFocus: string;
}) {
  const [tree, setTree] = useState(initialTree);
  const [focus, setFocus] = useState(initialFocus);
  const [who, setWho] = useWho();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => {
      const id = decodeURIComponent(location.pathname.split("/").pop() ?? "");
      setFocus((cur) => (id && id !== cur ? id : cur));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const person = tree.people[focus] ?? tree.people[Object.keys(tree.people)[0]];
  const layout = useMemo(() => (person ? layoutTree(tree, person.id) : null), [tree, person]);

  const go = useCallback((id: string) => {
    setFocus(id);
    setError("");
    setQuery("");
    history.pushState(null, "", `/tree/${encodeURIComponent(id)}`);
  }, []);

  // Keep the focused person in the middle of the view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !layout) return;
    const top = layout.nodes.reduce((m, n) => Math.min(m, n.y), 0);
    const x = (0 - layout.minX + PAD) * zoom;
    const y = (0 - top + PAD + CARD_H / 2) * zoom;
    el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [layout, zoom, focus]);

  const send = useCallback(
    async (op: Op): Promise<boolean> => {
      if (!who.trim()) {
        setError("Type your name first (the box in the panel), so the family can see who made each change.");
        return false;
      }
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, who: who.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as { tree?: PublicTree; error?: string };
        if (!res.ok || !data.tree) {
          setError(data.error ?? "Couldn't save that. Please try again.");
          return false;
        }
        setTree(data.tree);
        return true;
      } catch {
        setError("Couldn't reach the site. Please try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [who],
  );

  if (!person || !layout) {
    return <p className="py-10 text-stone-600">The tree is empty.</p>;
  }

  const width = layout.maxX - layout.minX + PAD * 2;
  const top = layout.nodes.reduce((m, n) => Math.min(m, n.y), 0);
  const height = layout.maxY - top + PAD * 2;
  const ox = -layout.minX + PAD;
  const oy = -top + PAD;
  const results = searchTree(tree, query);
  const suggestions = suggestLinks(tree, named);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find someone in the tree"
              aria-label="Find someone in the tree"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
            />
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => go(p.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50"
                    >
                      <Avatar person={p} size={28} />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-xs text-stone-500">{lifespan(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            Editing as
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="w-36 rounded-lg border border-stone-300 bg-white px-2 py-1.5"
            />
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <button
              onClick={() => {
                const el = scroller.current;
                if (el && layout) setZoom(Math.min(1, Math.max(0.35, +((el.clientWidth - 8) / (layout.maxX - layout.minX + PAD * 2)).toFixed(2))));
              }}
              className="h-8 rounded-lg border border-stone-300 bg-white px-2 text-sm"
            >
              Fit
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.15).toFixed(2)))}
              aria-label="Zoom out"
              className="h-8 w-8 rounded-lg border border-stone-300 bg-white text-lg leading-none"
            >
              −
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.15).toFixed(2)))}
              aria-label="Zoom in"
              className="h-8 w-8 rounded-lg border border-stone-300 bg-white text-lg leading-none"
            >
              +
            </button>
          </div>
        </div>

        <div
          ref={scroller}
          className="h-[75vh] min-h-96 overflow-auto rounded-xl border border-stone-200 bg-white"
          aria-label={`Family tree centered on ${person.name}`}
        >
          <div className="relative" style={{ width: width * zoom, height: height * zoom }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
              <svg width={width} height={height} className="absolute inset-0" aria-hidden>
                {layout.edges.flatMap((e, i) =>
                  e.parents.map((p, j) => (
                    <path
                      key={`${i}.${j}`}
                      d={edgePath({ x: p.x + ox, y: p.y + oy }, { x: e.child.x + ox, y: e.child.y + oy })}
                      fill="none"
                      stroke="#a8a29e"
                      strokeWidth={1.5}
                    />
                  )),
                )}
                {layout.unions.map((u, i) => (
                  <g key={i}>
                    <line x1={u.x1 + ox + CARD_W / 2} x2={u.x2 + ox - CARD_W / 2} y1={u.y + oy} y2={u.y + oy} stroke="#b45309" strokeWidth={2} />
                    {u.date && (
                      <text x={(u.x1 + u.x2) / 2 + ox} y={u.y + oy - 5} textAnchor="middle" fontSize={10} fill="#78716c">
                        m. {u.date}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
              {layout.nodes.map((n) => {
                const p = tree.people[n.id];
                if (!p) return null;
                const isFocus = n.role === "focus";
                return (
                  <button
                    key={n.key}
                    onClick={() => go(n.id)}
                    aria-current={isFocus ? "true" : undefined}
                    className={`absolute flex items-center gap-2 rounded-xl border px-2 text-left shadow-sm transition-colors ${
                      isFocus
                        ? "border-amber-600 bg-amber-50 ring-2 ring-amber-500"
                        : "border-stone-300 bg-white hover:border-amber-500 hover:bg-amber-50"
                    }`}
                    style={{ left: n.x + ox - CARD_W / 2, top: n.y + oy, width: CARD_W, height: CARD_H }}
                  >
                    <Avatar person={p} size={40} />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[13px] font-medium leading-tight text-stone-900">{p.name}</span>
                      <span className="block truncate text-[11px] text-stone-500">{lifespan(p)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Click anyone to move the tree to them. {Object.keys(tree.people).length} people in the tree.
        </p>

        {suggestions.length > 0 && (
          <details className="mt-4 rounded-xl border border-stone-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-800">
              Suggested photo links ({suggestions.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {suggestions.map(({ person: p, candidates }) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-stone-400">→</span>
                  {candidates.slice(0, 3).map((c) => (
                    <button
                      key={c.personId}
                      disabled={busy}
                      onClick={() => send({ type: "link", id: p.id, linkedPersonId: c.personId })}
                      className="rounded-full border border-stone-300 px-2.5 py-1 hover:border-amber-600 hover:bg-amber-50 disabled:opacity-50"
                    >
                      Link to {c.name}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <PersonPanel
        key={person.id}
        tree={tree}
        person={person}
        named={named}
        busy={busy}
        error={error}
        who={who}
        onWho={setWho}
        onGo={go}
        onSend={send}
      />
    </div>
  );
}
