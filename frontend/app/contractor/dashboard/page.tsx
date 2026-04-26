"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";

export default function ContractorDashboardPage() {
  return (
    <RequireAuth roles={["contractor"]}>
      <AppShell
        title="Contractor dashboard"
        subtitle="You only see properties your administrator has assigned. Vendor and ingest actions stay read-only in the workspace."
      >
        <div className="ch-tile-grid">
          <Link href="/workspace" className="ch-link-tile">
            <span className="ch-link-tile-title">Open assigned properties →</span>
            <span className="ch-link-tile-desc">Switch between permitted buildings and review operational context.</span>
          </Link>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
