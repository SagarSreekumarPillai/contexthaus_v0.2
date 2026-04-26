"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ users: 0, properties: 0, auditRows: 0 });
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listUsers(), api.getProperties(), api.listAudit(400)])
      .then(([users, properties, audit]) => {
        if (!cancelled) {
          setStats({ users: users.length, properties: properties.length, auditRows: audit.length });
        }
      })
      .catch(() => {
        if (!cancelled) setStatsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RequireAuth roles={["admin"]}>
      <AppShell
        title="Control center"
        subtitle="Manage your organization, team access, and compliance trail. Full operations live in the property workspace."
      >
        {statsError ? <p className="ch-error">Could not load live metrics. Links below still work.</p> : null}
        <div className="ch-stat-grid">
          <div className="ch-stat">
            <div className="ch-stat-label">Team members</div>
            <div className="ch-stat-value">{stats.users}</div>
          </div>
          <div className="ch-stat">
            <div className="ch-stat-label">Properties</div>
            <div className="ch-stat-value">{stats.properties}</div>
          </div>
          <div className="ch-stat">
            <div className="ch-stat-label">Audit events (sample)</div>
            <div className="ch-stat-value">{stats.auditRows}</div>
          </div>
        </div>

        <div className="ch-tile-grid">
          <Link href="/admin/users" className="ch-link-tile">
            <span className="ch-link-tile-title">Team directory →</span>
            <span className="ch-link-tile-desc">Invite Verwalter, Auditor, and Contractor roles. Contractors need property assignments.</span>
          </Link>
          <Link href="/admin/audit" className="ch-link-tile">
            <span className="ch-link-tile-title">Audit log →</span>
            <span className="ch-link-tile-desc">Immutable trail of logins, ingests, property changes, and administration.</span>
          </Link>
          <Link href="/workspace" className="ch-link-tile">
            <span className="ch-link-tile-title">Property workspace →</span>
            <span className="ch-link-tile-desc">Ingest sources, edit context, and run vendor workflows as an admin.</span>
          </Link>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
