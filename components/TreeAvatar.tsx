"use client";

import { useState } from "react";
import type { Person } from "@/lib/tree";

export function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = person.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return person.linkedPersonId && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/tree/face/${person.linkedPersonId}`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-stone-200 object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
