"use client";

import { AppShell } from "@/components/AppShell";
import AuditLogTable from "@/components/AuditLogTable";
import RequireAuth from "@/components/RequireAuth";

export default function AdminAuditPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <AppShell
        title="Audit log"
        subtitle="Immutable trail of logins, ingests, property changes, and user administration across your organization."
      >
        <p className="ch-lead" style={{ marginTop: 0 }}>
          Most recent events first. Operational visibility—export and retention policies are not wired yet.
        </p>
        <AuditLogTable />
      </AppShell>
    </RequireAuth>
  );
}
