"use client";

import { useEffect, useState } from "react";
import { AI_DAILY_LIMIT, AI_TOOLS, type AiToolId } from "@/lib/ai";
import { imgSrc } from "@/lib/manifest";

type Result = { url: string; blob: Blob; steps: string[] };

/** Downscales an image blob to a JPEG data: URL so it can be sent back for another AI step. */
async function toDataUrl(blob: Blob, maxPx = 2000): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

type Props = { id: string; filename: string; onClose: () => void; onEdit: (src: string) => void };

/**
 * One-click AI restoration (Replicate). Each result can be downloaded, opened in the editor,
 * or fed into another tool (e.g. Restore, then Colorize).
 */
export default function AiPanel({ id, filename, onClose, onEdit }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState<AiToolId | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const base = filename.replace(/\.[^.]+$/, "");

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setRemaining(d.remaining))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !running) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, onClose]);

  async function run(tool: AiToolId) {
    setError("");
    setRunning(tool);
    try {
      const body = result ? { tool, source: await toDataUrl(result.blob) } : { tool, id };
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `The AI edit failed (${res.status}).`);
      }
      const blob = await res.blob();
      const label = AI_TOOLS.find((t) => t.id === tool)!.label;
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), blob, steps: [...(prev?.steps ?? []), label] };
      });
      setRemaining((r) => (r === null ? r : Math.max(r - 1, 0)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  function download() {
    if (!result) return;
    const suffix = result.steps.map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-")).join("-");
    const a = Object.assign(document.createElement("a"), { href: result.url, download: `${base}-${suffix}.jpg` });
    a.click();
  }

  function startOver() {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setError("");
  }

  const outOfEdits = remaining === 0;
  return (
    <div role="dialog" aria-modal aria-label="AI fix" className="fixed inset-0 z-40 flex flex-col overflow-auto bg-stone-950 text-white">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="flex-1 font-serif text-xl">AI fix</h2>
        {remaining !== null && (
          <span className="text-sm text-stone-400">
            {remaining} of {AI_DAILY_LIMIT} family edits left today
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={running !== null}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          Close
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 lg:grid-cols-[1fr_1fr_18rem]">
        <figure className="flex min-h-48 flex-col">
          <figcaption className="mb-1 text-xs tracking-wide text-stone-400 uppercase">Original</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc(id, "large")} alt="Original" className="max-h-[70vh] w-full flex-1 object-contain" />
        </figure>
        <figure className="flex min-h-48 flex-col">
          <figcaption className="mb-1 text-xs tracking-wide text-stone-400 uppercase">
            {result ? `Result · ${result.steps.join(" → ")}` : "Result"}
          </figcaption>
          <div className="relative grid flex-1 place-items-center rounded-lg border border-dashed border-white/15">
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="AI result" className="max-h-[70vh] w-full object-contain" />
            ) : (
              <p className="p-6 text-center text-sm text-stone-400">Pick a tool to see the result here.</p>
            )}
            {running && (
              <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-center text-sm">
                <p>
                  Working on it…
                  <br />
                  <span className="text-stone-400">This usually takes 10–60 seconds.</span>
                </p>
              </div>
            )}
          </div>
        </figure>

        <aside className="flex flex-col gap-2">
          <p className="text-sm text-stone-400">
            {result ? "Apply another tool to the result:" : "Choose a fix:"}
          </p>
          {AI_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => run(tool.id)}
              disabled={running !== null || outOfEdits}
              className="rounded-lg border border-white/15 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
            >
              <span className="block font-medium">{running === tool.id ? `${tool.label}…` : tool.label}</span>
              <span className="block text-xs text-stone-400">{tool.description}</span>
            </button>
          ))}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          {result && (
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              <button type="button" onClick={download} className="rounded-lg bg-amber-700 px-3 py-2 font-medium hover:bg-amber-600">
                Download result
              </button>
              <button type="button" onClick={() => onEdit(result.url)} className="rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10">
                Open result in editor
              </button>
              <button type="button" onClick={startOver} disabled={running !== null} className="text-sm text-stone-400 underline hover:text-white">
                Start over from the original
              </button>
            </div>
          )}
          <p className="mt-auto pt-4 text-xs text-stone-500">
            AI edits send this one photo to Replicate to process. The original here is never changed.
          </p>
        </aside>
      </div>
    </div>
  );
}
