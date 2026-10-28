"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { resizePhoto } from "@/lib/resize";
import { cleanName, familyFor, fold, type Suggestion } from "@/lib/uploads";
import { useWho } from "@/lib/who";

type Known = { name: string; personId: number | null };
type Face = { bbox: number[]; suggestions: Suggestion[] };
type Pick = { name: string; personId: number | null };
type Item = {
  key: number;
  file: File;
  preview: string;
  status: "uploading" | "tagging" | "saving" | "saved" | "failed";
  note?: string;
  id?: string;
  faces: Face[];
  largeW: number;
  largeH: number;
  detection?: "ok" | "unavailable";
  picks: (Pick | null)[]; // one per face
  extras: Pick[]; // people in the photo whose face wasn't picked up
};

let nextKey = 1;

export default function UploadApp({ known }: { known: Known[] }) {
  const [who, setWho] = useWho();
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [added, setAdded] = useState<Known[]>([]); // people made up during this visit, so later photos can reuse them
  const everyone = [...known, ...added.filter((a) => !known.some((k) => fold(k.name) === fold(a.name)))];

  const patch = (key: number, change: Partial<Item> | ((i: Item) => Partial<Item>)) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...(typeof change === "function" ? change(i) : change) } : i)));

  async function upload(item: Item, name: string) {
    try {
      const sized = await resizePhoto(item.file);
      const form = new FormData();
      form.set("who", name);
      form.set("filename", item.file.name);
      form.set("w", String(sized.w));
      form.set("h", String(sized.h));
      for (const k of ["thumb", "large", "full"] as const) form.set(k, sized[k], `${k}.jpg`);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Upload failed");
      const data = (await res.json()) as { id: string; faces: Face[]; detection: "ok" | "unavailable" };
      patch(item.key, {
        status: "tagging", id: data.id, faces: data.faces, detection: data.detection, largeW: sized.largeW, largeH: sized.largeH,
        // A single clear suggestion is pre-selected; the uploader can change it.
        picks: data.faces.map((f) => (f.suggestions[0] && f.suggestions[0].distance <= 0.45 ? { name: f.suggestions[0].name, personId: f.suggestions[0].personId } : null)),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      patch(item.key, {
        status: "failed",
        note: msg === "too large" || /encode|decode|source|bitmap/i.test(msg) || e instanceof DOMException
          ? "This browser can't read that photo (iPhone HEIC files need Safari, or export as JPEG)."
          : msg || "Upload failed. Please try again.",
      });
    }
  }

  function add(files: FileList | File[]) {
    const name = cleanName(who);
    if (!name) return;
    const fresh: Item[] = [...files]
      .filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))
      .map((file) => ({ key: nextKey++, file, preview: URL.createObjectURL(file), status: "uploading", faces: [], largeW: 1, largeH: 1, picks: [], extras: [] }));
    setItems((all) => [...all, ...fresh]);
    // One at a time: the first photo can wait a few seconds while the face models load.
    for (const item of fresh) queue.current = queue.current.then(() => upload(item, name));
  }

  async function save(item: Item) {
    const tags = [
      ...item.picks.flatMap((p, faceIndex) => (p ? [{ ...p, faceIndex }] : [])),
      ...item.extras,
    ];
    patch(item.key, { status: "saving", note: undefined });
    const res = await fetch(`/api/uploads/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }),
    }).catch(() => null);
    if (!res?.ok) return patch(item.key, { status: "tagging", note: "Couldn't save the tags. Please try again." });
    setAdded((a) => [...a, ...tags.map((t) => ({ name: t.name, personId: t.personId }))]);
    patch(item.key, { status: "saved", note: tags.length ? tags.map((t) => t.name).join(", ") : "No one tagged" });
  }

  const pending = items.filter((i) => i.status === "tagging");

  if (!cleanName(who)) {
    return (
      <form
        className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (cleanName(draft)) setWho(cleanName(draft));
        }}
      >
        <h2 className="font-serif text-xl text-stone-900">Who&apos;s uploading?</h2>
        <p className="mt-1 text-sm text-stone-600">Your name is shown on the photos you add so everyone knows who shared them.</p>
        <input
          autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your name" maxLength={60}
          className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
        <button className="mt-3 rounded-lg bg-[#115740] px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!cleanName(draft)}>
          Continue
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-700">
        <label className="flex items-center gap-2">
          Uploading as
          <input value={who} onChange={(e) => setWho(e.target.value)} maxLength={60} className="w-40 rounded-lg border border-stone-300 bg-white px-2 py-1.5" />
        </label>
        <Link href={`/uploads/${encodeURIComponent(cleanName(who))}`} className="text-[#115740] hover:underline">Your uploads</Link>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center ${over ? "border-[#115740] bg-emerald-50" : "border-stone-300 bg-white"}`}
      >
        <p className="text-stone-700">Drag photos here, or choose one or many.</p>
        <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-[#115740] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d4432]">
          Choose photos
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>

      {pending.length > 1 && (
        <button onClick={() => pending.forEach(save)} className="mt-4 rounded-lg border border-[#115740] px-4 py-2 text-sm font-medium text-[#115740] hover:bg-emerald-50">
          Save tags on all {pending.length} photos
        </button>
      )}

      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li key={item.key} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <Preview item={item} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{item.file.name}</p>
                {item.status === "uploading" && <p className="mt-2 text-sm text-stone-600">Uploading and looking for faces…</p>}
                {item.status === "failed" && <p className="mt-2 text-sm text-red-700">{item.note}</p>}
                {item.status === "saved" && (
                  <p className="mt-2 text-sm text-[#115740]">
                    Saved · {item.note} ·{" "}
                    <Link href={`/p/${item.id}?from=${encodeURIComponent(`~u/${cleanName(who)}`)}`} className="underline">open</Link>
                  </p>
                )}
                {(item.status === "tagging" || item.status === "saving") && (
                  <Tagger item={item} everyone={everyone} patch={(c) => patch(item.key, c)} onSave={() => save(item)} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Preview({ item }: { item: Item }) {
  return (
    <div className="relative w-full shrink-0 md:w-72">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.preview} alt="" className="w-full rounded-lg object-contain" />
      {item.faces.map((f, i) => {
        const [x, y, w, h] = f.bbox;
        const pick = item.picks[i];
        return (
          <div
            key={i}
            className={`absolute rounded border-2 ${pick ? "border-emerald-400" : "border-amber-400"}`}
            style={{ left: `${(x / item.largeW) * 100}%`, top: `${(y / item.largeH) * 100}%`, width: `${(w / item.largeW) * 100}%`, height: `${(h / item.largeH) * 100}%` }}
          >
            <span className="absolute -top-2.5 -left-2.5 grid h-5 w-5 place-items-center rounded-full bg-stone-900 text-[11px] font-semibold text-white">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

/** `many` lets one entry hold several names separated by commas, and keeps the field ready for the next. */
function NameField({ everyone, onPick, placeholder, many }: { everyone: Known[]; onPick: (p: Pick) => void; placeholder: string; many?: boolean }) {
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const list = `names-${placeholder.length}`;
  const commit = () => {
    for (const piece of many ? text.split(/[,;\n]/) : [text]) {
      const name = cleanName(piece);
      if (!name) continue;
      const match = everyone.find((k) => fold(k.name) === fold(name));
      onPick({ name: match?.name ?? name, personId: match?.personId ?? null });
    }
    setText("");
    field.current?.focus();
  };
  const typed = many ? "" : cleanName(text);
  const isNew = typed && !everyone.some((k) => fold(k.name) === fold(typed));
  return (
    <div>
      <div className="flex gap-2">
        <input
          ref={field} list={list} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={80}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
        />
        <datalist id={list}>{everyone.map((k) => <option key={k.name} value={k.name} />)}</datalist>
        <button type="button" onClick={commit} disabled={!cleanName(text)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-40">Add</button>
      </div>
      {isNew && <p className="mt-1 text-xs text-stone-500">New person. This adds a folder “{familyFor(typed)}{fold(familyFor(typed)) === fold(typed) ? "" : ` / ${typed}`}”.</p>}
    </div>
  );
}

function Tagger({ item, everyone, patch, onSave }: { item: Item; everyone: Known[]; patch: (c: Partial<Item> | ((i: Item) => Partial<Item>)) => void; onSave: () => void }) {
  const setPick = (i: number, p: Pick | null) => patch((cur) => ({ picks: cur.picks.map((x, j) => (j === i ? p : x)) }));
  return (
    <div className="mt-3 space-y-4">
      {item.detection === "unavailable" && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Face suggestions aren&apos;t available right now. You can still add names below.</p>
      )}
      {item.detection === "ok" && item.faces.length === 0 && <p className="text-sm text-stone-600">No faces found. Add anyone in the photo below.</p>}
      {item.faces.map((f, i) => (
        <div key={i}>
          <p className="text-sm font-medium text-stone-800">
            Face {i + 1}: {item.picks[i] ? <span className="text-[#115740]">{item.picks[i]!.name} <button className="ml-1 text-xs text-stone-500 underline" onClick={() => setPick(i, null)}>change</button></span> : <span className="text-stone-500">who is this?</span>}
          </p>
          {!item.picks[i] && (
            <div className="mt-1.5 space-y-2">
              {f.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {f.suggestions.map((s) => (
                    <button key={s.name} type="button" onClick={() => setPick(i, { name: s.name, personId: s.personId })} className="rounded-full border border-emerald-600 px-3 py-1 text-sm text-[#115740] hover:bg-emerald-50">
                      {s.name} <span className="text-xs text-stone-500">{Math.round((1 - s.distance) * 100)}%</span>
                    </button>
                  ))}
                </div>
              )}
              <NameField everyone={everyone} placeholder={f.suggestions.length ? "Someone else…" : "Name this person…"} onPick={(p) => setPick(i, p)} />
            </div>
          )}
        </div>
      ))}
      <div>
        <p className="text-sm font-medium text-stone-800">{item.faces.length ? "Anyone else in this photo?" : "Who is in this photo?"} <span className="font-normal text-stone-500">Add as many as you like.</span></p>
        {item.extras.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {item.extras.map((p) => (
              <span key={p.name} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                {p.name} <button aria-label={`Remove ${p.name}`} className="ml-1 text-stone-500" onClick={() => patch((cur) => ({ extras: cur.extras.filter((x) => x.name !== p.name) }))}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-1.5">
          <NameField everyone={everyone} placeholder="Add names, separated by commas…" many onPick={(p) => patch((cur) => ({ extras: cur.extras.some((x) => fold(x.name) === fold(p.name)) ? cur.extras : [...cur.extras, p] }))} />
        </div>
      </div>
      {item.note && <p className="text-sm text-red-700">{item.note}</p>}
      <button onClick={onSave} disabled={item.status === "saving"} className="rounded-lg bg-[#115740] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d4432] disabled:opacity-50">
        {item.status === "saving" ? "Saving…" : "Save tags"}
      </button>
    </div>
  );
}
