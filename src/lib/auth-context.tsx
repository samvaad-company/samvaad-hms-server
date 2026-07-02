"use client";

/**
 * Client-side auth context. Loads the current user from /api/auth/me, exposes
 * login/logout, and a `can()` helper backed by the server-provided permission
 * matrix so the UI can hide actions the role cannot perform.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import type { SessionUserDTO } from "@/types/api";

type Access = "none" | "read" | "write";

interface AuthContextValue {
  user: SessionUserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUserDTO>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (resource: string, action?: "read" | "write") => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: SessionUserDTO | null;
}) {
  const [user, setUser] = useState<SessionUserDTO | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<SessionUserDTO>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser) void refresh();
  }, [initialUser, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const me = await api.post<SessionUserDTO>("/auth/login", { email, password });
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const can = useCallback(
    (resource: string, action: "read" | "write" = "read") => {
      const level: Access = user?.permissions?.[resource] ?? "none";
      if (level === "write") return true;
      if (level === "read") return action === "read";
      return false;
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
