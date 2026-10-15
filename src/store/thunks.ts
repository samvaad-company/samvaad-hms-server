/**
 * The only code that talks to the network on behalf of the store.
 */
import { api, ApiClientError } from "@/lib/api/client";
import type { QueryParams } from "@/lib/api/client";
import type { AppDispatch, RootState } from "./index";
import { fetchStarted, fetchSucceeded, fetchFailed, moreStarted, moreSucceeded, moreFailed, type PageMeta, type StoredError } from "./cacheSlice";

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

// ── Paged ("infinite scroll") lists ──────────────────────────────────────────

export interface PagedQuery {
  key: string;
  path: string;
  /** Search / filters / sort — everything except the page number. */
  params?: QueryParams;
  pageSize: number;
}

/** First load, or a refresh: fetch every page already on screen (in parallel) and swap them in at once, so the list never flickers. */
export const fetchPagedQuery =
  (q: PagedQuery, opts: { force?: boolean } = {}) =>
  async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
    const { entries, epoch } = getState().apiCache;
    const e = entries[q.key];
    if (e?.inflightEpoch === epoch) return;
    if (!opts.force && e && e.loadedAt !== null && e.fetchedEpoch >= epoch && Date.now() - e.loadedAt < DEDUPE_MS) return;

    const pagesShown = Math.max(1, e?.meta?.page ?? 1);
    dispatch(fetchStarted({ key: q.key, epoch }));
    try {
      const pages = await Promise.all(
        Array.from({ length: pagesShown }, (_, i) => api.list<{ id: unknown }>(q.path, { ...q.params, page: i + 1, pageSize: q.pageSize })),
      );
      const rows: { id: unknown }[] = [];
      const seen = new Set<unknown>();
      let reached = 0;
      pages.forEach((p, i) => {
        if (p.data.length) reached = i + 1;
        for (const r of p.data) if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
      });
      const last = pages[pages.length - 1].meta;
      const meta: PageMeta = { page: Math.max(1, reached), pageSize: q.pageSize, total: last.total, totalPages: last.totalPages };
      dispatch(fetchSucceeded({ key: q.key, epoch, at: Date.now(), data: rows, meta }));
    } catch (err) {
      dispatch(fetchFailed({ key: q.key, epoch, error: toStored(err) }));
    }
  };

/** Scrolled to the bottom: fetch the next page of the same search/filters and append it. */
export const fetchMorePaged =
  (q: PagedQuery) =>
  async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
    const { entries, epoch } = getState().apiCache;
    const e = entries[q.key];
    if (!e || e.loadedAt === null || e.loadingMore || e.inflightEpoch !== null || !e.meta) return;
    if (e.meta.page >= e.meta.totalPages) return;

    dispatch(moreStarted({ key: q.key }));
    try {
      const res = await api.list<{ id: unknown }>(q.path, { ...q.params, page: e.meta.page + 1, pageSize: q.pageSize });
      dispatch(moreSucceeded({
        key: q.key, epoch, rows: res.data,
        meta: { page: e.meta.page + 1, pageSize: q.pageSize, total: res.meta.total, totalPages: res.meta.totalPages },
      }));
    } catch (err) {
      dispatch(moreFailed({ key: q.key, error: toStored(err) }));
    }
  };
