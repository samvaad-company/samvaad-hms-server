"use client";

/**
 * Which sidebar sections the user has folded away, remembered in this browser. Read through
 * useSyncExternalStore so the server render (everything open) and the first client render agree,
 * and the saved choice is applied right after.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "samvaad.sidebar.collapsed";
const listeners = new Set<() => void>();

function read(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => { listeners.delete(onChange); window.removeEventListener("storage", onChange); };
}

export function useCollapsedGroups(): { collapsed: Set<string>; toggle: (label: string) => void } {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const collapsed = useMemo(() => new Set(raw ? raw.split("|") : []), [raw]);
  const toggle = useCallback((label: string) => {
    const next = new Set(read() ? read().split("|") : []);
    if (!next.delete(label)) next.add(label);
    try { localStorage.setItem(KEY, [...next].join("|")); } catch { /* not remembered, still works for this page */ }
    listeners.forEach((l) => l());
  }, []);
  return { collapsed, toggle };
}
