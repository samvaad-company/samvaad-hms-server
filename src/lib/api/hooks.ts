"use client";

/**
 * Data-fetching hooks built on the typed API client, backed by SWR for
 * caching + request dedup: two components (or two mounts of the same page
 * via navigation) asking for the same path+params share one cached result
 * instead of each firing its own fetch, and switching back to an
 * already-visited page shows the cached data instantly while revalidating
 * in the background. `path: null` skips the fetch entirely — for data that
 * depends on something not loaded yet (e.g. the signed-in user's name).
 */
import { useCallback, useState } from "react";
import useSWR from "swr";
import { api, ApiClientError, type QueryParams } from "@/lib/api/client";
import type { PaginationMeta } from "@/types/api";

export interface ListState<T> {
  items: T[];
  meta: PaginationMeta | null;
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}

export function useList<T>(path: string | null, params?: QueryParams): ListState<T> {
  const key = path ? ([path, params ?? {}] as const) : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    ([p, prms]) => api.list<T>(p, prms),
  );

  return {
    items: data?.data ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: (error as ApiClientError) ?? null,
    reload: () => void mutate(),
  };
}

export interface ItemState<T> {
  item: T | null;
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}

export function useItem<T>(path: string | null): ItemState<T> {
  const { data, error, isLoading, mutate } = useSWR(path, (p: string) => api.get<T>(p));

  return {
    item: data ?? null,
    loading: isLoading,
    error: (error as ApiClientError) ?? null,
    reload: () => void mutate(),
  };
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

  return { loading, error, run, reset };
}
