"use client";

import Link from "next/link";
import { useState } from "react";
import {
  byBirth,
  candidatesFor,
  childrenOf,
  lifespan,
  parentsOf,
  partnersOf,
  siblingsOf,
  type NamedPerson,
  type NewOrExisting,
  type Op,
  type Person,
  type PublicTree,
} from "@/lib/tree";
import { folderHref } from "@/lib/manifest";
import { Avatar } from "./TreeAvatar";

type Kind = "parent" | "child" | "sibling" | "partner";
type Mode = { type: "view" } | { type: "add"; kind: Kind } | { type: "edit" } | { type: "delete" };

const input = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
const btn =
  "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:border-amber-600 hover:bg-amber-50 disabled:opacity-50";
const primary =
  "rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50";

type Props = {
  tree: PublicTree;
  person: Person;
  named: NamedPerson[];
  busy: boolean;
  error: string;
  who: string;
  onWho: (name: string) => void;
  onGo: (id: string) => void;
  onSend: (op: Op) => Promise<boolean>;
};

export default function PersonPanel({ tree, person, named, busy, error, who, onWho, onGo, onSend }: Props) {
  const [mode, setMode] = useState<Mode>({ type: "view" });
  const done = () => setMode({ type: "view" });

  const parents = parentsOf(tree, person.id);
  const partners = partnersOf(tree, person.id);
  const siblings = byBirth(tree, siblingsOf(tree, person.id));
  const children = byBirth(tree, childrenOf(tree, person.id));
  const named_ = named.find((n) => n.personId === person.linkedPersonId);
  const last = tree.history[tree.history.length - 1];

  const person_ = (id: string, extra?: string, onRemove?: () => void) => {
    const p = tree.people[id];
    return (
      <li key={id + (extra ?? "")} className="flex items-center gap-1">
        <button onClick={() => onGo(id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-amber-50">
          <Avatar person={p} size={28} />
          <span className="truncate text-sm">{p.name}</span>
          <span className="ml-auto shrink-0 text-xs text-stone-500">{extra || lifespan(p)}</span>
        </button>
        {onRemove && (
          <button onClick={onRemove} disabled={busy} aria-label={`Remove link to ${p.name}`} className="px-1.5 text-stone-400 hover:text-red-700">
            ×
          </button>
        )}
      </li>
    );
  };

  const group = (title: string, items: React.ReactNode[], empty?: string) =>
    items.length > 0 || empty ? (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
        {items.length ? <ul className="mt-1">{items}</ul> : <p className="mt-1 text-sm text-stone-500">{empty}</p>}
      </div>
    ) : null;

  return (
    <aside className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 lg:max-h-[38rem] lg:overflow-y-auto">
      <div className="flex items-start gap-3">
        <Avatar person={person} size={64} />
        <div className="min-w-0">
          <h2 className="font-serif text-2xl leading-tight text-stone-900">{person.name}</h2>
          {person.nickname && <p className="text-sm text-stone-600">“{person.nickname}”</p>}
          <p className="text-sm text-stone-600">{lifespan(person) || "No dates yet"}</p>
        </div>
      </div>
      {person.notes && <p className="whitespace-pre-line text-sm text-stone-700">{person.notes}</p>}

      <div className={`rounded-lg px-3 py-2 text-sm ${who.trim() ? "bg-stone-50" : "bg-amber-50 ring-1 ring-amber-300"}`}>
        <label className="block">
          <span className="mb-1 block font-medium text-stone-800">{who.trim() ? "Editing as" : "Your name (needed to make changes)"}</span>
          <input
            value={who}
            onChange={(e) => onWho(e.target.value)}
            placeholder="e.g. Rob"
            maxLength={60}
            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5"
          />
        </label>
        {!who.trim() && <p className="mt-1 text-xs text-stone-600">Type it once; it&apos;s remembered on this device and shown next to each change you make.</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {mode.type === "view" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => setMode({ type: "add", kind: "parent" })}>+ Parent</button>
            <button className={btn} onClick={() => setMode({ type: "add", kind: "partner" })}>+ Partner</button>
            <button className={btn} onClick={() => setMode({ type: "add", kind: "child" })}>+ Child</button>
            <button className={btn} onClick={() => setMode({ type: "add", kind: "sibling" })}>+ Brother or sister</button>
            <button className={btn} onClick={() => setMode({ type: "edit" })}>Edit details</button>
          </div>

          {group("Parents", parents.map((id) => person_(id, undefined, () => onSend({ type: "removeParentLink", child: person.id, parent: id }))), "None added yet")}
          {group(
            "Partners",
            partners.map(({ partner, union }) =>
              person_(partner, union.date ? `m. ${union.date}` : undefined, () => onSend({ type: "removeUnion", id: union.id })),
            ),
          )}
          {partners.length > 0 && <UnionEditor tree={tree} personId={person.id} busy={busy} onSend={onSend} />}
          {group("Brothers and sisters", siblings.map((id) => person_(id)))}
          {group("Children", children.map((id) => person_(id)))}

          <div className="border-t border-stone-200 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Photos</h3>
            <LinkSection person={person} named={named} linked={named_} busy={busy} onSend={onSend} />
          </div>

          <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-sm">
            <button className="text-red-700 hover:underline" onClick={() => setMode({ type: "delete" })}>
              Remove from tree
            </button>
          </div>
        </>
      )}

      {mode.type === "add" && (
        <AddForm kind={mode.kind} tree={tree} person={person} busy={busy} onCancel={done} onSend={async (op) => {
          if (await onSend(op)) done();
        }} />
      )}

      {mode.type === "edit" && (
        <EditForm person={person} busy={busy} onCancel={done} onSave={async (fields) => {
          if (await onSend({ type: "updatePerson", id: person.id, fields })) done();
        }} />
      )}

      {mode.type === "delete" && (
        <div className="space-y-3 rounded-lg bg-red-50 p-3 text-sm">
          <p>
            Remove <strong>{person.name}</strong> from the tree? Their links to parents, partners and children go too.
            You can undo it right afterwards.
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={async () => {
                const next = parents[0] ?? partners[0]?.partner ?? children[0] ?? siblings[0];
                if (await onSend({ type: "removePerson", id: person.id }) && next) onGo(next);
              }}
            >
              Remove
            </button>
            <button className={btn} onClick={done}>Cancel</button>
          </div>
        </div>
      )}

      {tree.history.length > 0 && (
        <details className="border-t border-stone-200 pt-3 text-sm">
          <summary className="cursor-pointer font-medium text-stone-700">Recent changes</summary>
          {last && (
            <button
              disabled={busy}
              onClick={() => onSend({ type: "undo", entryId: last.id })}
              className={`${btn} mt-2`}
            >
              Undo: {last.summary}
            </button>
          )}
          <ul className="mt-2 space-y-1 text-stone-600">
            {[...tree.history].reverse().map((h) => (
              <li key={h.id}>
                {h.summary} <span className="text-xs text-stone-400">{new Date(h.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

// ---------- pieces ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-stone-700">{label}</span>
      {children}
    </label>
  );
}

const TITLES: Record<Kind, string> = {
  parent: "Add a parent",
  child: "Add a child",
  sibling: "Add a brother or sister",
  partner: "Add a partner",
};

function AddForm({
  kind, tree, person, busy, onCancel, onSend,
}: {
  kind: Kind; tree: PublicTree; person: Person; busy: boolean; onCancel: () => void; onSend: (op: Op) => void;
}) {
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [death, setDeath] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [other, setOther] = useState("");
  const [existing, setExisting] = useState("");

  const partners = partnersOf(tree, person.id);
  const everyone = Object.values(tree.people).filter((p) => p.id !== person.id);
  const label = (p: Person) => `${p.name}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;
  const picked = everyone.find((p) => label(p) === existing.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const who: NewOrExisting = picked ? { existing: picked.id } : { name, birth, death };
    if (kind === "parent") onSend({ type: "addParent", of: person.id, person: who });
    else if (kind === "child") onSend({ type: "addChild", of: person.id, person: who, with: other || undefined });
    else if (kind === "sibling") onSend({ type: "addSibling", of: person.id, person: who });
    else onSend({ type: "addPartner", of: person.id, person: who, date, place });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-medium text-stone-900">
        {TITLES[kind]} for {person.name}
      </h3>
      {!picked && (
        <>
          <Field label="Name">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus required={!existing} maxLength={120} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Born (year or date)">
              <input className={input} value={birth} onChange={(e) => setBirth(e.target.value)} placeholder="1950" maxLength={40} />
            </Field>
            <Field label="Died (if so)">
              <input className={input} value={death} onChange={(e) => setDeath(e.target.value)} maxLength={40} />
            </Field>
          </div>
        </>
      )}
      {kind === "partner" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Married (date)">
            <input className={input} value={date} onChange={(e) => setDate(e.target.value)} placeholder="1972" maxLength={40} />
          </Field>
          <Field label="Where">
            <input className={input} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} />
          </Field>
        </div>
      )}
      {kind === "child" && partners.length > 0 && (
        <Field label="Other parent">
          <select className={input} value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">Not in the tree / unknown</option>
            {partners.map(({ partner }) => (
              <option key={partner} value={partner}>{tree.people[partner].name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Or pick someone already in the tree">
        <input className={input} list="tree-everyone" value={existing} onChange={(e) => setExisting(e.target.value)} placeholder="Start typing a name" />
        <datalist id="tree-everyone">
          {everyone.map((p) => <option key={p.id} value={label(p)} />)}
        </datalist>
      </Field>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || (!picked && !name.trim())} className={primary}>Add</button>
        <button type="button" className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function EditForm({
  person, busy, onCancel, onSave,
}: {
  person: Person; busy: boolean; onCancel: () => void; onSave: (f: { name: string; nickname: string; birth: string; death: string; notes: string }) => void;
}) {
  const [f, setF] = useState({
    name: person.name, nickname: person.nickname ?? "", birth: person.birth ?? "", death: person.death ?? "", notes: person.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-3">
      <h3 className="font-medium text-stone-900">Edit details</h3>
      <Field label="Name"><input className={input} value={f.name} onChange={set("name")} required maxLength={120} autoFocus /></Field>
      <Field label="Nickname or other name"><input className={input} value={f.nickname} onChange={set("nickname")} maxLength={80} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Born"><input className={input} value={f.birth} onChange={set("birth")} maxLength={40} /></Field>
        <Field label="Died"><input className={input} value={f.death} onChange={set("death")} maxLength={40} /></Field>
      </div>
      <Field label="Notes"><textarea className={input} rows={3} value={f.notes} onChange={set("notes")} maxLength={1000} /></Field>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !f.name.trim()} className={primary}>Save</button>
        <button type="button" className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** Change the marriage date or place for a partnership. */
function UnionEditor({ tree, personId, busy, onSend }: { tree: PublicTree; personId: string; busy: boolean; onSend: (op: Op) => Promise<boolean> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const unions = partnersOf(tree, personId);
  return (
    <div className="-mt-2 text-sm">
      {unions.map(({ union, partner }) =>
        open === union.id ? (
          <form
            key={union.id}
            className="mt-2 space-y-2 rounded-lg bg-stone-50 p-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await onSend({ type: "updateUnion", id: union.id, date, place })) setOpen(null);
            }}
          >
            <p className="text-stone-700">Marriage to {tree.people[partner].name}</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={input} value={date} onChange={(e) => setDate(e.target.value)} placeholder="Date" aria-label="Marriage date" maxLength={40} />
              <input className={input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Where" aria-label="Marriage place" maxLength={120} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primary}>Save</button>
              <button type="button" className={btn} onClick={() => setOpen(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button
            key={union.id}
            className="mr-3 mt-1 text-xs text-amber-800 hover:underline"
            onClick={() => { setOpen(union.id); setDate(union.date ?? ""); setPlace(union.place ?? ""); }}
          >
            {union.date || union.place ? "Edit" : "Add"} marriage date with {tree.people[partner].name.split(" ")[0]}
          </button>
        ),
      )}
    </div>
  );
}

function LinkSection({
  person, named, linked, busy, onSend,
}: {
  person: Person; named: NamedPerson[]; linked?: NamedPerson; busy: boolean; onSend: (op: Op) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  if (!named.length) {
    return <p className="mt-1 text-sm text-stone-500">No photo names found yet.</p>;
  }
  if (person.linkedPersonId) {
    return (
      <div className="mt-1 space-y-2 text-sm">
        <p>
          Linked to <strong>{linked?.name ?? "a photo name"}</strong>.
        </p>
        <div className="flex gap-2">
          {linked?.folderPath && (
            <Link href={folderHref(linked.folderPath)} className={btn}>See their photos</Link>
          )}
          <button disabled={busy} className={btn} onClick={() => onSend({ type: "link", id: person.id, linkedPersonId: null })}>
            Unlink
          </button>
        </div>
      </div>
    );
  }
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length
    ? named.filter((n) => words.every((w) => n.name.toLowerCase().includes(w))).slice(0, 8)
    : candidatesFor(person, named, 3);
  return (
    <div className="mt-1 space-y-2 text-sm">
      <p className="text-stone-600">Link to a name from the face-grouping project to show their picture.</p>
      <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search photo names" aria-label="Search photo names" />
      <ul className="space-y-1">
        {hits.map((n) => (
          <li key={n.personId}>
            <button disabled={busy} className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-left hover:border-amber-600 hover:bg-amber-50 disabled:opacity-50"
              onClick={() => onSend({ type: "link", id: person.id, linkedPersonId: n.personId })}>
              Link to {n.name}
            </button>
          </li>
        ))}
        {!hits.length && <li className="text-stone-500">{q ? "No match." : "Search above to find their name."}</li>}
      </ul>
    </div>
  );
}
