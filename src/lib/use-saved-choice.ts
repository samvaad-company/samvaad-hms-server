"use client";

import { useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

/**
 * A choice (a selected view, a filter) kept in localStorage so it survives a reload. The server render and
 * hydration use `fallback`; the saved value is applied right after. Only values in `allowed` are accepted.
 */
export function useSavedChoice<T extends string>(storageKey: string, allowed: readonly T[], fallback: T): [T, (next: T) => void] {
  const value = useSyncExternalStore<T>(
    (notify) => {
      const set = listeners.get(storageKey) ?? new Set();
      set.add(notify);
      listeners.set(storageKey, set);
      window.addEventListener("storage", notify);
      return () => { set.delete(notify); window.removeEventListener("storage", notify); };
    },
    () => {
      try {
        const saved = window.localStorage.getItem(storageKey) as T | null;
        return saved && allowed.includes(saved) ? saved : fallback;
      } catch { return fallback; }
    },
    () => fallback,
  );
  const choose = (next: T) => {
    try { window.localStorage.setItem(storageKey, next); } catch { /* storage blocked — the choice just won't persist */ }
    listeners.get(storageKey)?.forEach((l) => l());
  };
  return [value, choose];
}
