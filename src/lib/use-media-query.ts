"use client";

import { useSyncExternalStore } from "react";

/** Tracks a CSS media query. `serverValue` is what the server render assumes (desktop-first, so the layout matches the CSS). */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Below Tailwind's `lg` (1024px): phones and tablets, where the sidebar becomes a slide-in drawer. */
export function useIsCompact(): boolean {
  return !useMediaQuery("(min-width: 1024px)", true);
}
