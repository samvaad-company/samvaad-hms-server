"use client";

/**
 * Auth state, kept in the Redux store. `useAuth()` keeps its old shape (user, loading,
 * login, logout, refresh, can) so pages are unchanged, but the returned object is
 * memoised and components only re-render when the user itself changes.
 */
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { SessionUserDTO } from "@/types/api";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store";
import { userLoaded, authLoading } from "@/store/authSlice";
import { clearCache } from "@/store/cacheSlice";

type Access = "none" | "read" | "add" | "edit" | "write";
const LEVEL_RANK: Record<Access, number> = { none: 0, read: 1, add: 2, edit: 3, write: 4 };
/** "write" is "may make changes" (add or more); add / edit / delete are the specific kinds. */
const ACTION_RANK = { read: 1, add: 2, write: 2, edit: 3, delete: 4 } as const;

interface AuthContextValue {
  user: SessionUserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUserDTO>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (resource: string, action?: "read" | "write" | "add" | "edit" | "delete") => boolean;
}

/** Loads "who am I" once when the app starts. Must sit inside <StoreProvider>. */
export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: SessionUserDTO | null;
}) {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    if (store.getState().auth.user) return;
    if (initialUser) { dispatch(userLoaded(initialUser)); return; }
    // The patient booking page is public and never reads the user, so don't ask who is logged in there.
    if (window.location.pathname.startsWith("/book-video")) { dispatch(authLoading(false)); return; }
    api.get<SessionUserDTO>("/auth/me")
      .then((me) => dispatch(userLoaded(me)))
      .catch(() => dispatch(userLoaded(null)));
  }, [dispatch, store, initialUser]);

  return <>{children}</>;
}

export function useAuth(): AuthContextValue {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const loading = useAppSelector((s) => s.auth.loading);

  const refresh = useCallback(async () => {
    try {
      dispatch(userLoaded(await api.get<SessionUserDTO>("/auth/me")));
    } catch {
      dispatch(userLoaded(null));
    }
  }, [dispatch]);

  const login = useCallback(async (email: string, password: string) => {
    const me = await api.post<SessionUserDTO>("/auth/login", { email, password });
    dispatch(clearCache()); // never show the previous user's data to the next one
    dispatch(userLoaded(me));
    return me;
  }, [dispatch]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    dispatch(clearCache());
    dispatch(userLoaded(null));
    window.location.href = "/login";
  }, [dispatch]);

  const can = useCallback(
    (resource: string, action: keyof typeof ACTION_RANK = "read") => {
      const level: Access = user?.permissions?.[resource] ?? "none";
      return LEVEL_RANK[level] >= ACTION_RANK[action];
    },
    [user],
  );

  return useMemo(() => ({ user, loading, login, logout, refresh, can }), [user, loading, login, logout, refresh, can]);
}
