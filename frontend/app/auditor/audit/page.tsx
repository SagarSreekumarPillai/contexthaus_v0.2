"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import AuditLogTable from "@/components/AuditLogTable";

export default function AuditorAuditPage() {
  return (
    <RequireAuth roles={["auditor"]}>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 28, fontFamily: "system-ui" }}>
        <Link href="/auditor/dashboard" style={{ color: "#888", fontSize: 13 }}>
          ← Auditor home
        </Link>
        <h1 style={{ color: "#f59e0b" }}>Audit log (read-only)</h1>
        <AuditLogTable />
      </div>
    </RequireAuth>
  );
}
