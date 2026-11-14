"use client";

import { useAppSelector } from "@/store";

/**
 * Whether the app is fetching anything under these paths right now: `fetching` for any request in flight (a refresh of data already
 * shown included), `firstLoad` for one with nothing to show yet. Drives the "loading" cues on a screen made of many small lists.
 */
export function useFetching(prefixes: readonly string[]): { fetching: boolean; firstLoad: boolean } {
  const state = useAppSelector((s) => {
    let fetching = false, first = false;
    for (const [key, e] of Object.entries(s.apiCache.entries)) {
      if (e.inflightEpoch === null) continue;
      const path = key.startsWith("paged|") ? key.slice(6) : key;
      if (!prefixes.some((p) => path.startsWith(p))) continue;
      fetching = true;
      if (e.loadedAt === null) first = true;
    }
    return `${fetching ? 1 : 0}${first ? 1 : 0}`;
  });
  return { fetching: state[0] === "1", firstLoad: state[1] === "1" };
}
