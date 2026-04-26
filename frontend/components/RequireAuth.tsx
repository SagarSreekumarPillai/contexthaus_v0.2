"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getToken } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

export default function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!getToken() || !user) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/workspace");
    }
  }, [loading, user, roles, router]);

  if (loading || !user) {
    return (
      <div style={{ padding: 24, color: "var(--text-muted, #888)" }}>
        Checking session…
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return null;
  }
  return <>{children}</>;
}
