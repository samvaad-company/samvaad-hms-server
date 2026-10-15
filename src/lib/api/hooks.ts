"use client";

/**
 * Data hooks backed by the Redux API cache (src/store).
 *
 *  - First visit: nothing is cached yet, so `loading` is true until the response
 *    arrives (pages show their loader; the shell shows a page loader).
 *  - Every later visit: the last data comes straight from the store (`loading`
 *    stays false) while a background request refreshes it; the store is only
 *    touched if the response actually differs, so unchanged screens don't re-render.
 *  - After any save, every mounted query refreshes itself.
 *
 * `path: null` skips the request, for data that depends on something not loaded yet.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiClientError, type QueryParams } from "@/lib/api/client";
import type { PaginationMeta } from "@/types/api";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchMorePaged, fetchPagedQuery, fetchQuery, queryKey, type PagedQuery, type Query } from "@/store/thunks";
import type { StoredError } from "@/store/cacheSlice";

export interface ListState<T> {
  items: T[];
  meta: PaginationMeta | null;
  /** True only while there is nothing to show yet (the first load). Cached data never reports loading. */
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}

export interface InfiniteListState<T> {
  items: T[];
  /** Everything that matches the search/filters, not just what is loaded so far. */
  total: number;
  /** True only until the first page of this search arrives. */
  loading: boolean;
  /** The next page is on its way. */
  loadingMore: boolean;
  hasMore: boolean;
  error: ApiClientError | null;
  /** Fetch the next page (does nothing while one is loading or when everything is loaded). */
  loadMore: () => void;
  reload: () => void;
}

export interface ItemState<T> {
  item: T | null;
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}

// One shared empty array, so "no data yet" is the same reference every render.
const NO_ITEMS: never[] = [];

const toError = (e: StoredError | null | undefined): ApiClientError | null =>
  e ? new ApiClientError(e.status, e.code, e.message, e.details) : null;

/**
 * The shared engine: subscribes to just the pieces of one cache entry, and keeps it fresh.
 * Each selector returns a stable value, so the component re-renders only when what it shows changes.
 */
function useQuery(q: Query | null) {
  const dispatch = useAppDispatch();
  const key = q?.key ?? "";
  const data = useAppSelector((s) => s.apiCache.entries[key]?.data);
  const meta = useAppSelector((s) => s.apiCache.entries[key]?.meta ?? null);
  const storedError = useAppSelector((s) => s.apiCache.entries[key]?.error);
  const loaded = useAppSelector((s) => s.apiCache.entries[key]?.loadedAt != null);
  const epoch = useAppSelector((s) => s.apiCache.epoch);

  // Refresh on mount, when the key changes, and whenever something was saved (epoch bump).
  // `q` is re-created each render, so the effect is keyed on the stable string instead.
  const { kind, path } = q ?? { kind: "item" as const, path: "" };
  const paramsJson = q?.params ? JSON.stringify(q.params) : "";
  useEffect(() => {
    if (!key) return;
    const params = paramsJson ? (JSON.parse(paramsJson) as QueryParams) : undefined;
    void dispatch(fetchQuery({ key, kind, path, params }));
  }, [dispatch, key, kind, path, paramsJson, epoch]);

  const reload = useCallback(() => {
    if (!key) return;
    const params = paramsJson ? (JSON.parse(paramsJson) as QueryParams) : undefined;
    void dispatch(fetchQuery({ key, kind, path, params }, { force: true }));
  }, [dispatch, key, kind, path, paramsJson]);

  const error = useMemo(() => toError(storedError), [storedError]);
  return { data, meta, loaded, error, reload, active: !!key };
}

export function useList<T>(path: string | null, params?: QueryParams): ListState<T> {
  const q = path ? { key: queryKey(path, params), kind: "list" as const, path, params } : null;
  const { data, meta, loaded, error, reload, active } = useQuery(q);
  const items = (data as T[] | undefined) ?? (NO_ITEMS as T[]);
  const loading = active && !loaded && !error;
  return useMemo(() => ({ items, meta, loading, error, reload }), [items, meta, loading, error, reload]);
}

/**
 * A list that grows as the user scrolls. Search, filters and sort go to the server (so they cover every record,
 * not just the loaded ones); each distinct combination is cached on its own, so going back to a search you
 * already ran shows its rows at once, however far you had scrolled.
 */
export function useInfiniteList<T>(path: string, params?: QueryParams, pageSize = 40): InfiniteListState<T> {
  const dispatch = useAppDispatch();
  const key = `paged|${queryKey(path, { ...params, pageSize })}`;
  const paramsJson = params ? JSON.stringify(params) : "";
  const data = useAppSelector((s) => s.apiCache.entries[key]?.data);
  const meta = useAppSelector((s) => s.apiCache.entries[key]?.meta ?? null);
  const storedError = useAppSelector((s) => s.apiCache.entries[key]?.error);
  const loaded = useAppSelector((s) => s.apiCache.entries[key]?.loadedAt != null);
  const loadingMore = useAppSelector((s) => !!s.apiCache.entries[key]?.loadingMore);
  const epoch = useAppSelector((s) => s.apiCache.epoch);

  const query = useCallback((): PagedQuery => ({ key, path, pageSize, params: paramsJson ? (JSON.parse(paramsJson) as QueryParams) : undefined }), [key, path, pageSize, paramsJson]);

  useEffect(() => { void dispatch(fetchPagedQuery(query())); }, [dispatch, query, epoch]);

  const loadMore = useCallback(() => { void dispatch(fetchMorePaged(query())); }, [dispatch, query]);
  const reload = useCallback(() => { void dispatch(fetchPagedQuery(query(), { force: true })); }, [dispatch, query]);

  const error = useMemo(() => toError(storedError), [storedError]);
  const items = (data as T[] | undefined) ?? (NO_ITEMS as T[]);
  const hasMore = !!meta && meta.page < meta.totalPages;
  const loading = !loaded && !error;
  return useMemo(
    () => ({ items, total: meta?.total ?? 0, loading, loadingMore, hasMore, error, loadMore, reload }),
    [items, meta, loading, loadingMore, hasMore, error, loadMore, reload],
  );
}

export function useItem<T>(path: string | null): ItemState<T> {
  const q = path ? { key: queryKey(path), kind: "item" as const, path } : null;
  const { data, loaded, error, reload, active } = useQuery(q);
  const item = (data as T | undefined) ?? null;
  const loading = active && !loaded && !error;
  return useMemo(() => ({ item, loading, error, reload }), [item, loading, error, reload]);
}

export interface MutationState {
  loading: boolean;
  error: ApiClientError | null;
}

/** Run an async API call with loading/error tracking. */
export function useMutation(): MutationState & {
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err as ApiClientError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return useMemo(() => ({ loading, error, run, reset }), [loading, error, run, reset]);
}
