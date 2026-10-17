"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while the page is being server-rendered and during hydration, true after. Use it to hold back
 * anything that depends on who is signed in, so the first client render matches the server's HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
