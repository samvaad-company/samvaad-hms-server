/**
 * The API cache: every GET the app makes lands here, keyed by path + query, so a
 * page that was opened before shows its last data instantly while a background
 * request brings it up to date.
 *
 * Re-render discipline lives in this file:
 *  - a response that is identical to what is stored keeps the SAME object
 *    references, so components subscribed to that data are not re-rendered;
 *  - "loading" flags are internal; components read only the fields they render;
 *  - changes are ordered by an "epoch", so a slow response from before a save can
 *    never overwrite the fresher data that arrived after it.
 *
 * Pure (no network, no clock) so it can be tested on its own.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface StoredError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CacheEntry {
  data: unknown;
  meta: PageMeta | null;
  error: StoredError | null;
  /** When data last arrived; null until the first response. */
  loadedAt: number | null;
  /** The epoch the stored data was fetched in. Behind `state.epoch` means "needs a refresh". */
  fetchedEpoch: number;
  /** The epoch of the request currently in flight, if any. */
  inflightEpoch: number | null;
  /** This entry is currently counted in `pendingFirstLoads`. */
  counted: boolean;
}

export interface CacheState {
  entries: Record<string, CacheEntry>;
  /** Bumped whenever data may have changed (a save, a refocus). Every mounted query refetches on a bump. */
  epoch: number;
  /** How many queries are waiting on their very first response (drives the page loader). */
  pendingFirstLoads: number;
}

/** Keep the cache bounded: the least recently loaded entries are dropped past this. */
export const MAX_ENTRIES = 300;

export const initialCacheState: CacheState = { entries: {}, epoch: 0, pendingFirstLoads: 0 };

const blank = (): CacheEntry => ({ data: undefined, meta: null, error: null, loadedAt: null, fetchedEpoch: -1, inflightEpoch: null, counted: false });

/** Structural equality for JSON-shaped values (what the API returns). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameJson(a[i], b[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  if (ak.length !== Object.keys(bo).length) return false;
  for (const k of ak) {
    if (!(k in bo) || !sameJson(ao[k], bo[k])) return false;
  }
  return true;
}

/**
 * Re-use the previous objects wherever the new response matches them, so that an
 * unchanged row in a changed list keeps its identity (memoised rows then skip rendering).
 */
export function shareStructure<T>(prev: unknown, next: T): T {
  if (prev === next) return next;
  if (Array.isArray(next) && Array.isArray(prev)) {
    let allSame = prev.length === next.length;
    const merged = next.map((item, i) => {
      const reused = shareStructure(prev[i], item);
      if (reused !== prev[i]) allSame = false;
      return reused;
    });
    return (allSame ? prev : merged) as unknown as T;
  }
  if (next && prev && typeof next === "object" && typeof prev === "object" && !Array.isArray(next) && !Array.isArray(prev)) {
    const n = next as Record<string, unknown>;
    const p = prev as Record<string, unknown>;
    let allSame = Object.keys(n).length === Object.keys(p).length;
    const merged: Record<string, unknown> = {};
    for (const k of Object.keys(n)) {
      merged[k] = shareStructure(p[k], n[k]);
      if (merged[k] !== p[k]) allSame = false;
    }
    return (allSame ? prev : merged) as T;
  }
  return next;
}

const slice = createSlice({
  name: "apiCache",
  initialState: initialCacheState,
  reducers: {
    fetchStarted(state, a: PayloadAction<{ key: string; epoch: number }>) {
      const e = (state.entries[a.payload.key] ??= blank());
      if (e.loadedAt === null && !e.counted) { e.counted = true; state.pendingFirstLoads++; }
      e.inflightEpoch = a.payload.epoch;
    },

    fetchSucceeded(state, a: PayloadAction<{ key: string; epoch: number; at: number; data: unknown; meta: PageMeta | null }>) {
      const { key, epoch, at, data, meta } = a.payload;
      const e = (state.entries[key] ??= blank());
      if (e.counted) { e.counted = false; state.pendingFirstLoads = Math.max(0, state.pendingFirstLoads - 1); }
      if (e.inflightEpoch === epoch) e.inflightEpoch = null;
      // A response older than what is already stored (it was overtaken) is dropped.
      if (epoch < e.fetchedEpoch) return;
      const merged = shareStructure(e.data, data);
      if (merged !== e.data) e.data = merged;
      if (!sameJson(e.meta, meta)) e.meta = meta;
      if (e.error) e.error = null;
      e.loadedAt = at;
      e.fetchedEpoch = epoch;

      // Keep the cache bounded.
      const keys = Object.keys(state.entries);
      if (keys.length > MAX_ENTRIES) {
        const victims = keys
          .filter((k) => k !== key && state.entries[k].inflightEpoch === null)
          .sort((x, y) => (state.entries[x].loadedAt ?? 0) - (state.entries[y].loadedAt ?? 0))
          .slice(0, keys.length - MAX_ENTRIES);
        for (const k of victims) delete state.entries[k];
      }
    },

    fetchFailed(state, a: PayloadAction<{ key: string; epoch: number; error: StoredError }>) {
      const { key, epoch, error } = a.payload;
      const e = (state.entries[key] ??= blank());
      if (e.counted) { e.counted = false; state.pendingFirstLoads = Math.max(0, state.pendingFirstLoads - 1); }
      if (e.inflightEpoch === epoch) e.inflightEpoch = null;
      if (epoch < e.fetchedEpoch) return;
      // Counted as attempted for this epoch, so a failing query isn't retried in a loop; the old data stays on screen.
      e.fetchedEpoch = Math.max(e.fetchedEpoch, epoch);
      e.error = error;
    },

    /** Something was saved (or the tab came back): every query is out of date. Cached data stays visible meanwhile. */
    invalidateAll(state) {
      state.epoch++;
    },

    /** Forget everything — on sign-in/out so one user's data never shows for another. */
    clearCache() {
      return initialCacheState;
    },
  },
});

export const { fetchStarted, fetchSucceeded, fetchFailed, invalidateAll, clearCache } = slice.actions;
export const cacheReducer = slice.reducer;
export default cacheReducer;
