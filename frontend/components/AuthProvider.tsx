"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import { clearToken, getToken, homePathForRole, setToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  loginWithToken: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) {
        clearToken();
        setUser(null);
        setLoading(false);
        return;
      }
      const data = (await r.json()) as AuthUser;
      setUser(data);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loginWithToken = useCallback(
    (token: string, u: AuthUser) => {
      setToken(token);
      setUser(u);
      router.push(homePathForRole(u.role));
    },
    [router]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    if (!pathname?.startsWith("/login") && !pathname?.startsWith("/bootstrap")) {
      router.push("/login");
    }
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export { AuthProvider, useAuth };
export default AuthProvider;
