"use client";

import { useState } from "react";
import { imgSrc } from "@/lib/manifest";
import type { Op, Person } from "@/lib/tree";
import { Avatar } from "./TreeAvatar";

const PAGE = 48;
const btn =
  "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:border-[#115740] hover:bg-[#115740]/5 disabled:opacity-50";

/** Lets anyone pick a person's tree thumbnail from their album (or any photo): choose, click the face, zoom, save. */
export default function ThumbnailPicker({
  person, album, busy, onSend,
}: {
  person: Person; album?: string; busy: boolean; onSend: (op: Op) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [pick, setPick] = useState<{ photoId: string; x: number; y: number; zoom: number } | null>(null);
  const [everyone, setEveryone] = useState(!album);

  async function load(all: boolean) {
    setIds(null);
    setShown(PAGE);
    const res = await fetch(`/api/folder-photos?path=${encodeURIComponent(all || !album ? "*" : album)}`).catch(() => null);
    setIds(res?.ok ? ((await res.json()) as { ids: string[] }).ids : []);
  }

  function start() {
    setOpen(true);
    setPick(person.photoId ? { photoId: person.photoId, x: person.photoX ?? 50, y: person.photoY ?? 50, zoom: person.photoZ ?? 1 } : null);
    void load(everyone);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className={btn} onClick={start}>Change thumbnail</button>
        {person.photoId && (
          <button className={btn} disabled={busy} onClick={() => onSend({ type: "setPhoto", id: person.id, photoId: null })}>
            Use default
          </button>
        )}
      </div>
    );
  }

  const preview: Person | null = pick ? { ...person, photoId: pick.photoId, photoX: pick.x, photoY: pick.y, photoZ: pick.zoom } : null;
  return (
    <div className="mt-3 space-y-3 text-sm">
      {pick && preview ? (
        <>
          <p className="text-stone-600">Click the face, then zoom in.</p>
          <div className="relative overflow-hidden rounded-lg bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(pick.photoId, "large")}
              alt="Click the face"
              className="max-h-72 w-full cursor-crosshair object-contain"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                // The image is letterboxed inside its box, so measure against the real picture.
                const nw = e.currentTarget.naturalWidth, nh = e.currentTarget.naturalHeight;
                const s = Math.min(r.width / nw, r.height / nh);
                const w = nw * s, h = nh * s;
                const x = ((e.clientX - r.left - (r.width - w) / 2) / w) * 100;
                const y = ((e.clientY - r.top - (r.height - h) / 2) / h) * 100;
                setPick({ ...pick, x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
              }}
            />
          </div>
          <div className="flex items-center gap-4">
            <Avatar person={preview} size={80} />
            <label className="flex flex-1 items-center gap-2">
              Zoom
              <input
                type="range" min={1} max={4} step={0.1} value={pick.zoom}
                onChange={(e) => setPick({ ...pick, zoom: Number(e.target.value) })}
                className="flex-1 accent-[#115740]"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-lg bg-[#115740] px-4 py-1.5 font-medium text-white hover:bg-[#0d4432] disabled:opacity-50"
              onClick={async () => {
                if (await onSend({ type: "setPhoto", id: person.id, photoId: pick.photoId, x: pick.x, y: pick.y, zoom: pick.zoom })) setOpen(false);
              }}
            >
              Save thumbnail
            </button>
            <button className={btn} onClick={() => setPick(null)}>Back</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-stone-800">Pick a photo</p>
            <button className="text-stone-500 hover:underline" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          {album && (
            <label className="flex items-center gap-2 text-stone-600">
              <input
                type="checkbox" checked={everyone} className="accent-[#115740]"
                onChange={(e) => {
                  setEveryone(e.target.checked);
                  void load(e.target.checked);
                }}
              />
              Show every photo, not just their album
            </label>
          )}
          {ids === null && <p className="text-stone-500">Loading…</p>}
          {ids && ids.length === 0 && <p className="text-stone-500">No photos found.</p>}
          <ul className="grid max-h-80 grid-cols-4 gap-1 overflow-auto">
            {ids?.slice(0, shown).map((id) => (
              <li key={id}>
                <button
                  className="block aspect-square w-full overflow-hidden rounded bg-stone-200 hover:ring-2 hover:ring-[#115740]"
                  onClick={() => setPick({ photoId: id, x: 50, y: 50, zoom: 1 })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc(id, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          {ids && shown < ids.length && (
            <button className={btn} onClick={() => setShown((n) => n + PAGE)}>
              Show more ({ids.length - shown} left)
            </button>
          )}
        </>
      )}
    </div>
  );
}
