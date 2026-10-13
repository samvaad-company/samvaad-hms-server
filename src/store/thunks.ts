/**
 * The only code that talks to the network on behalf of the store.
 */
import { api, ApiClientError } from "@/lib/api/client";
import type { QueryParams } from "@/lib/api/client";
import type { AppDispatch, RootState } from "./index";
import { fetchStarted, fetchSucceeded, fetchFailed, type StoredError } from "./cacheSlice";

/** A query that was refreshed this recently is not asked for again (two components mounting together, StrictMode, …). */
export const DEDUPE_MS = 1000;

export interface Query {
  key: string;
  kind: "list" | "item";
  path: string;
  params?: QueryParams;
}

/** Stable cache key: the same path and params always give the same string, whatever the order. */
export function queryKey(path: string, params?: QueryParams): string {
  if (!params) return path;
  const keys = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "").sort();
  if (!keys.length) return path;
  return `${path}?${keys.map((k) => `${k}=${String(params[k])}`).join("&")}`;
}

const toStored = (err: unknown): StoredError =>
  err instanceof ApiClientError
    ? { status: err.status, code: err.code, message: err.message, details: err.details }
    : { status: 0, code: "NETWORK", message: err instanceof Error ? err.message : "Request failed" };

/**
 * Fetch a query into the cache.
 *  - skipped while a request for the current epoch is already running (no duplicate calls);
 *  - skipped when the data was refreshed a moment ago, unless `force`;
 *  - the old data stays in place until the new data arrives.
 */
export const fetchQuery =
  (q: Query, opts: { force?: boolean } = {}) =>
  async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
    const { entries, epoch } = getState().apiCache;
    const e = entries[q.key];
    if (e?.inflightEpoch === epoch) return;
    if (!opts.force && e && e.loadedAt !== null && e.fetchedEpoch >= epoch && Date.now() - e.loadedAt < DEDUPE_MS) return;

    dispatch(fetchStarted({ key: q.key, epoch }));
    try {
      if (q.kind === "list") {
        const res = await api.list<unknown>(q.path, q.params);
        dispatch(fetchSucceeded({ key: q.key, epoch, at: Date.now(), data: res.data, meta: res.meta }));
      } else {
        const data = await api.get<unknown>(q.path, q.params);
        dispatch(fetchSucceeded({ key: q.key, epoch, at: Date.now(), data, meta: null }));
      }
    } catch (err) {
      dispatch(fetchFailed({ key: q.key, epoch, error: toStored(err) }));
    }
  };
