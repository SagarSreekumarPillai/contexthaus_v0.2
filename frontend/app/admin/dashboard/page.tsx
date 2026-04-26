"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";

export default function AdminDashboardPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 28, fontFamily: "system-ui" }}>
        <h1 style={{ color: "#f59e0b", marginTop: 0 }}>Admin</h1>
        <p style={{ color: "#888", maxWidth: 560 }}>
          Manage users, review audit activity, and open the property workspace for full operations.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 24, maxWidth: 400 }}>
          <Link
            href="/admin/users"
            style={{
              display: "block",
              padding: 16,
              border: "1px solid #333",
              borderRadius: 8,
              color: "#f59e0b",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            User accounts →
          </Link>
          <Link
            href="/admin/audit"
            style={{
              display: "block",
              padding: 16,
              border: "1px solid #333",
              borderRadius: 8,
              color: "#f59e0b",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Audit log →
          </Link>
          <Link
            href="/workspace"
            style={{
              display: "block",
              padding: 16,
              border: "1px solid #333",
              borderRadius: 8,
              color: "#e5e5e5",
              textDecoration: "none",
            }}
          >
            Property workspace →
          </Link>
        </div>
      </div>
    </RequireAuth>
  );
}
