"use client";

/**
 * Data-fetching hooks built on the typed API client. Dependency-free
 * (no react-query) — small useState/useEffect wrappers with refetch support.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError, type QueryParams } from "@/lib/api/client";
import type { PaginationMeta } from "@/types/api";

// `useCallback` is re-exported under a local name to keep imports tidy.
function useCallbackShim<T extends (...args: never[]) => unknown>(fn: T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(fn, deps);
}

export interface ListState<T> {
  items: T[];
  meta: PaginationMeta | null;
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}

export function useList<T>(path: string, params?: QueryParams): ListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);
  const key = JSON.stringify(params ?? {});
  const active = useRef(true);

  const load = useCallbackShim(() => {
    setLoading(true);
    setError(null);
    api
      .list<T>(path, params)
      .then((res) => {
        if (!active.current) return;
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err) => {
        if (active.current) setError(err as ApiClientError);
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });
  }, [path, key]);

  useEffect(() => {
    active.current = true;
    load();
    return () => {
      active.current = false;
    };
  }, [load]);

  return { items, meta, loading, error, reload: load };
}

export interface ItemState<T> {
  item: T | null;
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}

export function useItem<T>(path: string | null): ItemState<T> {
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<ApiClientError | null>(null);
  const active = useRef(true);

  const load = useCallbackShim(() => {
    if (!path) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((res) => {
        if (active.current) setItem(res);
      })
      .catch((err) => {
        if (active.current) setError(err as ApiClientError);
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    active.current = true;
    load();
    return () => {
      active.current = false;
    };
  }, [load]);

  return { item, loading, error, reload: load };
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
