"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { imgSrc, type Photo } from "@/lib/manifest";

// The editor is large and needs the browser canvas, so it loads only when opened.
const RemovalDialog = dynamic(() => import("./RemovalDialog"), { ssr: false });
const AiPanel = dynamic(() => import("./AiPanel"), { ssr: false });
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 text-white">Loading editor…</div>,
});

type Props = {
  id: string;
  photo: Photo;
  position: string;
  folderName: string;
  folderPath: string | null;
  backHref: string;
  prevHref: string | null;
  nextHref: string | null;
};

const button =
  "rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10";

export default function PhotoViewer({ id, photo, position, folderName, folderPath, backHref, prevHref, nextHref }: Props) {
  const router = useRouter();
  // The editor opens on the original photo or on an AI result (a blob: URL).
  const [editing, setEditing] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [cover, setCover] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function makeCover() {
    setCover("saving");
    try {
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath, photoId: id }),
      });
      setCover(res.ok ? "done" : "error");
    } catch {
      setCover("error");
    }
  }

  useEffect(() => {
    if (editing || aiOpen || removeOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && prevHref) router.push(prevHref);
      else if (e.key === "ArrowRight" && nextHref) router.push(nextHref);
      else if (e.key === "Escape") router.push(backHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, aiOpen, removeOpen, prevHref, nextHref, backHref, router]);

  // Warm the cache so arrowing through a folder feels instant.
  useEffect(() => {
    for (const href of [prevHref, nextHref]) if (href) router.prefetch(href);
  }, [prevHref, nextHref, router]);

  return (
    <div className="flex h-dvh flex-col bg-stone-950">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Link href={backHref} className={button}>
          ← {folderName}
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm text-stone-300">
          {photo.filename}
          {position && <span className="text-stone-500"> · {position}</span>}
        </p>
        {folderPath && (
          <button type="button" className={button} onClick={makeCover} disabled={cover === "saving"}>
            {cover === "done" ? "✓ Album cover set" : cover === "error" ? "Couldn't set, retry" : "Make album cover"}
          </button>
        )}
        <button type="button" className={button} onClick={() => setRemoveOpen(true)}>
          Request removal
        </button>
        <button type="button" className={button} onClick={() => setAiOpen(true)}>
          ✨ AI fix
        </button>
        <button type="button" className={button} onClick={() => setEditing(imgSrc(id, "full"))}>
          Edit
        </button>
        <a href={imgSrc(id, "full", true)} className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">
          Download
        </a>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={id}
          src={imgSrc(id, "full")}
          alt={photo.filename}
          width={photo.w}
          height={photo.h}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          style={{ backgroundImage: `url(${imgSrc(id, "large")})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}
        />
        {prevHref && (
          <Link href={prevHref} aria-label="Previous photo" className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-2xl text-white hover:bg-black/70">
            ‹
          </Link>
        )}
        {nextHref && (
          <Link href={nextHref} aria-label="Next photo" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-2xl text-white hover:bg-black/70">
            ›
          </Link>
        )}
      </div>

      {removeOpen && <RemovalDialog id={id} filename={photo.filename} onClose={() => setRemoveOpen(false)} onRemoved={() => router.push(nextHref ?? prevHref ?? backHref)} />}
      {aiOpen && (
        <AiPanel
          id={id}
          filename={photo.filename}
          onClose={() => setAiOpen(false)}
          onEdit={(src) => {
            setAiOpen(false);
            setEditing(src);
          }}
        />
      )}
      {editing && <Editor source={editing} filename={photo.filename} onClose={() => setEditing(null)} />}
    </div>
  );
}
