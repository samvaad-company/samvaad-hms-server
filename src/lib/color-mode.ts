"use client";

/**
 * Light / dark switch. The choice is remembered in this browser and applied as a `dark` class on <html>
 * (the colours themselves are CSS variables in globals.css). The boot script in the root layout applies it
 * before the first paint, so a reload doesn't flash the wrong theme.
 */
import { useCallback, useSyncExternalStore } from "react";

export type ColorMode = "light" | "dark";
const KEY = "samvaad.mode";
const listeners = new Set<() => void>();

function read(): ColorMode {
  try { return localStorage.getItem(KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => { listeners.delete(onChange); window.removeEventListener("storage", onChange); };
}

export function setColorMode(mode: ColorMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  try { localStorage.setItem(KEY, mode); } catch { /* applies for this visit even if it can't be remembered */ }
  listeners.forEach((l) => l());
}

export function useColorMode(): { mode: ColorMode; toggle: () => void } {
  const mode = useSyncExternalStore(subscribe, read, () => "light" as ColorMode);
  const toggle = useCallback(() => setColorMode(read() === "dark" ? "light" : "dark"), []);
  return { mode, toggle };
}
