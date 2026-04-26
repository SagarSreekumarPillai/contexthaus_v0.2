"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import AuditLogTable from "@/components/AuditLogTable";

export default function AdminAuditPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 28, fontFamily: "system-ui" }}>
        <Link href="/admin/dashboard" style={{ color: "#888", fontSize: 13 }}>
          ← Admin
        </Link>
        <h1 style={{ color: "#f59e0b" }}>Audit log</h1>
        <p style={{ color: "#888", fontSize: 13 }}>Immutable trail of logins, ingests, property changes, and user administration.</p>
        <AuditLogTable />
      </div>
    </RequireAuth>
  );
}
