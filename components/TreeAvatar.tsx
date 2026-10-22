"use client";

import { useState } from "react";
import type { Person } from "@/lib/tree";

/**
 * How a chosen thumbnail is placed: the image is cover-fitted with the chosen point lined up,
 * then zoomed about the middle after sliding that point to the centre (never past the edges).
 */
export function photoStyle(p: Pick<Person, "photoX" | "photoY" | "photoZ">): React.CSSProperties {
  const x = p.photoX ?? 50;
  const y = p.photoY ?? 50;
  const z = p.photoZ ?? 1;
  const limit = (50 * (z - 1)) / z;
  const t = (v: number) => Math.max(-limit, Math.min(limit, 50 - v));
  return { objectPosition: `${x}% ${y}%`, transform: `scale(${z}) translate(${t(x)}%, ${t(y)}%)` };
}

export function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = person.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const box = { width: size, height: size };
  const src = person.photoId
    ? `/api/img/${person.photoId}/thumb`
    : person.linkedPersonId
      ? `/api/tree/face/${person.linkedPersonId}`
      : null;
  if (src && failed !== src) {
    return (
      <span className="block shrink-0 overflow-hidden rounded-full bg-stone-200" style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(src)}
          className="h-full w-full object-cover"
          style={person.photoId ? photoStyle(person) : undefined}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600"
      style={box}
    >
      {initials}
    </span>
  );
}
