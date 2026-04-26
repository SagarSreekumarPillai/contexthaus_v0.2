"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, homePathForRole, type AuthUser } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    void fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: AuthUser) => {
        router.replace(homePathForRole(u.role));
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="ch-auth-page">
      <div className="ch-loading-card">Redirecting…</div>
    </div>
  );
}
