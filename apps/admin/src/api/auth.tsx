import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, refreshAccessToken, setAccessToken, setSessionLostHandler } from "./client";
import type { Me } from "./types";

export type Credentials = { email: string; password: string } & ({ kind: "super" } | { kind: "tenant"; slug: string });

interface AuthState {
  user: Me | null;
  loading: boolean;
  login(c: Credentials): Promise<void>;
  logout(): Promise<void>;
  refreshMe(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setSessionLostHandler(clear);
    let alive = true;
    (async () => {
      const token = await refreshAccessToken();
      if (token) {
        try {
          const me = await api<Me>("/auth/me");
          if (alive) setUser(me);
        } catch {
          /* sin sesión */
        }
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [clear]);

  const login = useCallback(async (c: Credentials) => {
    const res = await api<{ accessToken: string }>(
      c.kind === "super" ? "/auth/super-admin/login" : "/auth/tenant/login",
      {
        method: "POST",
        body: c.kind === "super" ? { email: c.email, password: c.password } : { tenantSlug: c.slug, email: c.email, password: c.password },
        auth: false,
      },
    );
    setAccessToken(res.accessToken);
    setUser(await api<Me>("/auth/me"));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", auth: false });
    } finally {
      clear();
    }
  }, [clear]);

  const refreshMe = useCallback(async () => {
    setUser(await api<Me>("/auth/me"));
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refreshMe }), [user, loading, login, logout, refreshMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
