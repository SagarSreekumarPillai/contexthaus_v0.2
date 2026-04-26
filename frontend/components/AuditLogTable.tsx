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
    return <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #333", color: "#888" }}>
            <th style={{ padding: "8px 6px" }}>When</th>
            <th style={{ padding: "8px 6px" }}>Action</th>
            <th style={{ padding: "8px 6px" }}>Resource</th>
            <th style={{ padding: "8px 6px" }}>User</th>
            <th style={{ padding: "8px 6px" }}>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={{ padding: "8px 6px", color: "#ccc", whiteSpace: "nowrap" }}>{r.created_at}</td>
              <td style={{ padding: "8px 6px", color: "#f59e0b" }}>{r.action}</td>
              <td style={{ padding: "8px 6px" }}>
                {r.resource_type}
                {r.resource_id ? ` / ${r.resource_id.slice(0, 8)}…` : ""}
              </td>
              <td style={{ padding: "8px 6px", color: "#888" }}>{r.user_id?.slice(0, 8) ?? "—"}</td>
              <td style={{ padding: "8px 6px", color: "#888", maxWidth: 360 }}>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ color: "#666", marginTop: 12 }}>No audit entries yet.</p>}
    </div>
  );
}
