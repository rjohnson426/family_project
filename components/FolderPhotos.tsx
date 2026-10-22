"use client";

import { useState } from "react";
import PhotoGrid from "./PhotoGrid";

/** The folder's photo grid with a "Change album cover" mode: click any photo to make it the cover. */
export default function FolderPhotos({
  ids, path, heading, count,
}: {
  ids: string[]; path: string; heading: string; count: number;
}) {
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState("");

  async function pick(photoId: string) {
    setMsg("Saving…");
    try {
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, photoId }),
      });
      setMsg(res.ok ? "Album cover updated." : "Couldn't save that. Please try again.");
      if (res.ok) setPicking(false);
    } catch {
      setMsg("Couldn't reach the site. Please try again.");
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-stone-800">
          {heading} <span className="font-normal text-stone-500">({count.toLocaleString()})</span>
        </h2>
        <div className="flex items-center gap-3 text-sm">
          {msg && <span role="status" className="text-stone-600">{msg}</span>}
          <button
            type="button"
            onClick={() => {
              setPicking((v) => !v);
              setMsg("");
            }}
            className="rounded-lg border border-[#2e7d62] bg-white px-3 py-1.5 font-medium text-[#2e7d62] hover:bg-[#2e7d62]/10"
          >
            {picking ? "Cancel" : "Change album cover"}
          </button>
        </div>
      </div>
      {picking && <p className="mb-3 text-sm text-stone-600">Click the photo you want as the cover for this album.</p>}
      <PhotoGrid ids={ids} from={path} onPick={picking ? pick : undefined} />
    </section>
  );
}
