"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";

export default function ContractorDashboardPage() {
  return (
    <RequireAuth roles={["contractor"]}>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 28, fontFamily: "system-ui" }}>
        <h1 style={{ color: "#f59e0b", marginTop: 0 }}>Contractor</h1>
        <p style={{ color: "#888", maxWidth: 560 }}>
          You only see properties your administrator has assigned. The workspace is read-only for vendor and ingest
          actions.
        </p>
        <Link
          href="/workspace"
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: 16,
            border: "1px solid #333",
            borderRadius: 8,
            color: "#f59e0b",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open assigned properties →
        </Link>
      </div>
    </RequireAuth>
  );
}
