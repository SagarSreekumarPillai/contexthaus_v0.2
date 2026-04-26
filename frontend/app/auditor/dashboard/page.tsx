"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";

export default function AuditorDashboardPage() {
  return (
    <RequireAuth roles={["auditor"]}>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 28, fontFamily: "system-ui" }}>
        <h1 style={{ color: "#f59e0b", marginTop: 0 }}>Auditor</h1>
        <p style={{ color: "#888", maxWidth: 560 }}>
          Read-only access to properties and vendor context. Use the workspace to review building state; ingest and
          mutations are disabled.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 24, maxWidth: 400 }}>
          <Link
            href="/workspace"
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
            Open read-only workspace →
          </Link>
          <Link
            href="/auditor/audit"
            style={{
              display: "block",
              padding: 16,
              border: "1px solid #333",
              borderRadius: 8,
              color: "#e5e5e5",
              textDecoration: "none",
            }}
          >
            Audit log →
          </Link>
        </div>
      </div>
    </RequireAuth>
  );
}
