"use client";

import { downloadZip } from "client-zip";
import { useState } from "react";
import { imgSrc, type ZipEntry } from "@/lib/manifest";

type SavePicker = (opts: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream> }>;

/** Builds the zip in the browser, streaming each full-size photo from /api/img. */
export default function ZipButton({ entries, filename }: { entries: ZipEntry[]; filename: string }) {
  const [progress, setProgress] = useState<{ done: number } | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setError("");
    const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
    let writable: WritableStream | null = null;
    if (picker) {
      try {
        const handle = await picker({
          suggestedName: filename,
          types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }],
        });
        writable = await handle.createWritable();
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user cancelled the save dialog
      }
    }

    setProgress({ done: 0 });
    let done = 0;
    async function* files() {
      for (const { id, name } of entries) {
        const res = await fetch(imgSrc(id, "full"));
        if (!res.ok) throw new Error(`Couldn't fetch ${name} (${res.status})`);
        yield { name, input: res };
        setProgress({ done: ++done });
      }
    }

    try {
      const zip = downloadZip(files());
      if (writable) {
        await zip.body!.pipeTo(writable);
      } else {
        const url = URL.createObjectURL(await zip.blob());
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e) {
      setError((e as Error).message || "The download failed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={progress !== null || entries.length === 0}
        className="rounded-lg bg-[#115740] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0d4432] disabled:opacity-70"
      >
        {progress
          ? `Zipping ${progress.done.toLocaleString()} / ${entries.length.toLocaleString()}…`
          : `Download all (${entries.length.toLocaleString()}) .zip`}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
