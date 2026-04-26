"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";

export default function AuditorDashboardPage() {
  return (
    <RequireAuth roles={["auditor"]}>
      <AppShell
        title="Auditor home"
        subtitle="Read-only access to properties and vendor context. Ingest and mutations are disabled in the workspace."
      >
        <div className="ch-tile-grid">
          <Link href="/workspace" className="ch-link-tile">
            <span className="ch-link-tile-title">Open read-only workspace →</span>
            <span className="ch-link-tile-desc">Review building context, vendors, and communications without changing records.</span>
          </Link>
          <Link href="/auditor/audit" className="ch-link-tile">
            <span className="ch-link-tile-title">Audit log →</span>
            <span className="ch-link-tile-desc">Follow authentication and read activity across the organization.</span>
          </Link>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
