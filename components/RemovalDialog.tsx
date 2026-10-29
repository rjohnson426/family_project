"use client";

import { useEffect, useRef, useState } from "react";

/** Confirms, then hides the photo from the site and tells Rob. Opens as soon as it mounts. */
export default function RemovalDialog({ id, filename, onClose, onRemoved }: { id: string; filename: string; onClose: () => void; onRemoved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/removals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id, page: location.pathname }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't remove that. Please try again.");
        setState("idle");
        return;
      }
      onRemoved();
    } catch {
      setError("Couldn't reach the site. Please try again.");
      setState("idle");
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={submit} className="space-y-3 p-5">
        <h2 className="font-serif text-xl text-stone-900">Request removal</h2>
        <p className="text-sm text-stone-600">
          {filename} will come off the site right away and Rob will be notified. The original is kept, and he can put it back.
        </p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm text-stone-700 hover:bg-stone-100">
            Cancel
          </button>
          <button type="submit" disabled={state === "sending"} className="rounded-lg bg-red-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-70">
            {state === "sending" ? "Removing…" : "Remove photo"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
