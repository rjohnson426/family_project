"use client";

import { useRef, useState } from "react";

/** Secondary header button: opens a small form that emails Rob a requested change. */
export default function FeedbackButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  function open() {
    setState("idle");
    setError("");
    dialog.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, page: location.pathname }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that. Please try again.");
        setState("idle");
        return;
      }
      setTitle("");
      setDescription("");
      setState("sent");
    } catch {
      setError("Couldn't reach the site. Please try again.");
      setState("idle");
    }
  }

  const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2e7d62] focus:ring-2 focus:ring-[#2e7d62]/20";
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-lg border border-[#2e7d62] bg-white px-3 py-1.5 text-sm font-medium text-[#2e7d62] hover:bg-[#2e7d62]/10"
      >
        Submit Feedback
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={submit} className="space-y-3 p-5">
          <h2 className="font-serif text-xl text-stone-900">Submit Feedback</h2>
          <p className="text-sm text-stone-600">
            Share requested changes. Change spelling, folder grouping, photo categorization, etc.
          </p>
          {state === "sent" ? (
            <>
              <p role="status" className="rounded-lg bg-[#115740]/10 px-3 py-2 text-sm text-[#115740]">
                Thanks, your request was submitted.
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg bg-[#115740] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0d4432]">
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-stone-800">
                Title
                <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1 font-normal`} />
              </label>
              <label className="block text-sm font-medium text-stone-800">
                Description
                <textarea required maxLength={2000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} mt-1 font-normal`} />
              </label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm text-stone-700 hover:bg-stone-100">
                  Cancel
                </button>
                <button type="submit" disabled={state === "sending"} className="rounded-lg bg-[#115740] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0d4432] disabled:opacity-70">
                  {state === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
