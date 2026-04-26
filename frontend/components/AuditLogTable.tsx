"use client";

import { useEffect, useState } from "react";
import { api, type AuditRow } from "@/lib/api";

export default function AuditLogTable() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listAudit(300)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit log"));
  }, []);

  if (error) {
    return <div className="ch-error">{error}</div>;
  }

  return (
    <div className="ch-table-wrap">
      <table className="ch-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Resource</th>
            <th>User</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: "nowrap", color: "var(--ch-text-secondary)" }}>{r.created_at}</td>
              <td style={{ color: "var(--ch-accent)", fontWeight: 500 }}>{r.action}</td>
              <td>
                {r.resource_type}
                {r.resource_id ? ` / ${r.resource_id.slice(0, 8)}…` : ""}
              </td>
              <td style={{ color: "var(--ch-text-muted)" }}>{r.user_id?.slice(0, 8) ?? "—"}</td>
              <td style={{ color: "var(--ch-text-secondary)", maxWidth: 360 }}>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="ch-muted" style={{ padding: "14px 16px", margin: 0 }}>No audit entries yet.</p> : null}
    </div>
  );
}
