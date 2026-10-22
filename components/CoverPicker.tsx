"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { imgSrc } from "@/lib/manifest";

const PAGE = 60;

/** Title-row button: opens a window of this folder's photos; click one to make it the album cover. */
export default function CoverPicker({ path, ids }: { path: string; ids: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [shown, setShown] = useState(PAGE);
  const [msg, setMsg] = useState("");

  async function pick(photoId: string) {
    setMsg("Saving…");
    try {
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, photoId }),
      });
      if (!res.ok) {
        setMsg("Couldn't save that. Please try again.");
        return;
      }
      setMsg("");
      dialog.current?.close();
      router.refresh();
    } catch {
      setMsg("Couldn't reach the site. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMsg("");
          dialog.current?.showModal();
        }}
        className="rounded-lg border border-[#2e7d62] bg-white px-3 py-1.5 text-sm font-medium text-[#2e7d62] hover:bg-[#2e7d62]/10"
      >
        Change album cover
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[85vh] w-[min(56rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3">
            <div>
              <h2 className="font-serif text-xl text-stone-900">Change album cover</h2>
              <p className="text-sm text-stone-600">Click the photo you want as the cover.</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {msg && <span role="status" className="text-stone-600">{msg}</span>}
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100">
                Cancel
              </button>
            </div>
          </div>
          <div className="overflow-auto p-4">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {ids.slice(0, shown).map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-label="Use this photo as the album cover"
                    onClick={() => pick(id)}
                    className="block aspect-square w-full overflow-hidden rounded-md bg-stone-200 hover:ring-4 hover:ring-[#115740]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgSrc(id, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            {shown < ids.length && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
                >
                  Show more ({(ids.length - shown).toLocaleString()} left)
                </button>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
