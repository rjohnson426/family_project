"use client";

import { useSyncExternalStore } from "react";

// "Editing as": the family member's name, kept in this browser only. The tree labels its changes with
// it and uploads are stamped with it. Both read the same key so it is only ever asked for once.
const WHO_KEY = "family-tree-who";

// The editor's name lives in this browser only; it just labels their changes in the history.
const whoListeners = new Set<() => void>();
const readWho = () => {
  try {
    return localStorage.getItem(WHO_KEY) ?? "";
  } catch {
    return "";
  }
};
export function useWho(): [string, (v: string) => void] {
  const who = useSyncExternalStore(
    (cb) => {
      whoListeners.add(cb);
      return () => void whoListeners.delete(cb);
    },
    readWho,
    () => "",
  );
  const set = (v: string) => {
    try {
      localStorage.setItem(WHO_KEY, v);
    } catch {}
    whoListeners.forEach((f) => f());
  };
  return [who, set];
}
