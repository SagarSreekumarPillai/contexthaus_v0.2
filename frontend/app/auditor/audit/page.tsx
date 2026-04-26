"use client";

import { AppShell } from "@/components/AppShell";
import AuditLogTable from "@/components/AuditLogTable";
import RequireAuth from "@/components/RequireAuth";

export default function AuditorAuditPage() {
  return (
    <RequireAuth roles={["auditor"]}>
      <AppShell title="Audit log" subtitle="Read-only view of organization events.">
        <p className="ch-lead" style={{ marginTop: 0 }}>
          Same event stream as administrators see; your role cannot change users or property records.
        </p>
        <AuditLogTable />
      </AppShell>
    </RequireAuth>
  );
}
