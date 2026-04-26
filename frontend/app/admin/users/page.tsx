"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import RequireAuth from "@/components/RequireAuth";
import { api, type OrgUser, type Property } from "@/lib/api";
import type { UserRole } from "@/lib/auth";

const ROLES: UserRole[] = ["admin", "verwalter", "auditor", "contractor"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("verwalter");
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignSelection, setAssignSelection] = useState<Record<string, boolean>>({});

  async function refresh() {
    setError("");
    try {
      const [u, p] = await Promise.all([api.listUsers(), api.getProperties()]);
      setUsers(u);
      setProperties(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createUser({ email, password, full_name: fullName, role });
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("verwalter");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function toggleActive(u: OrgUser) {
    try {
      await api.patchUser(u.id, { is_active: !u.is_active });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function changeRole(userId: string, newRole: UserRole) {
    try {
      await api.patchUser(userId, { role: newRole });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  function openAssignments(u: OrgUser) {
    setAssignUserId(u.id);
    const sel: Record<string, boolean> = {};
    for (const p of properties) {
      sel[p.id] = u.assigned_property_ids.includes(p.id);
    }
    setAssignSelection(sel);
  }

  async function saveAssignments() {
    if (!assignUserId) return;
    const ids = Object.entries(assignSelection)
      .filter(([, v]) => v)
      .map(([k]) => k);
    try {
      await api.setUserAssignments(assignUserId, ids);
      setAssignUserId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignments failed");
    }
  }

  return (
    <RequireAuth roles={["admin"]}>
      <AppShell
        title="Team directory"
        subtitle="Create accounts for Verwalter (full operations), Auditor (read + audit), and Contractor (assigned properties, read-only workspace)."
      >
        {error ? <p className="ch-error">{error}</p> : null}

        <form className="ch-card ch-form-grid" onSubmit={createUser}>
          <div style={{ fontSize: 12, color: "var(--ch-accent)", fontWeight: 600 }}>Invite user</div>
          <label className="ch-auth-label">
            Email
            <input className="ch-input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="ch-auth-label">
            Password (min 8)
            <input
              className="ch-input"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label className="ch-auth-label">
            Full name
            <input className="ch-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="ch-auth-label">
            Role
            <select className="ch-select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="ch-btn ch-btn-primary" style={{ justifySelf: "start" }}>
            Create user
          </button>
        </form>

        <h2 className="ch-h1" style={{ marginTop: 36, fontSize: "1.1rem" }}>
          Directory
        </h2>
        <p className="ch-muted" style={{ marginBottom: 14 }}>
          Role changes apply on next request. Contractors need explicit property assignments.
        </p>

        <div className="ch-table-wrap">
          <table className="ch-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.full_name || "—"}</td>
                  <td>
                    <select
                      className="ch-select"
                      style={{ maxWidth: 160 }}
                      value={u.role}
                      onChange={(e) => void changeRole(u.id, e.target.value as UserRole)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.is_active ? "yes" : "no"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm" onClick={() => void toggleActive(u)}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {u.role === "contractor" && (
                        <button type="button" className="ch-btn ch-btn-primary ch-btn-sm" onClick={() => openAssignments(u)}>
                          Assign properties
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {assignUserId && (
          <div className="ch-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
            <div className="ch-modal">
              <div id="assign-modal-title" className="ch-modal-title">
                Property access
              </div>
              {properties.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, cursor: "pointer", color: "var(--ch-text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={!!assignSelection[p.id]}
                    onChange={(e) => setAssignSelection((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                  />
                  <span>
                    {p.name} — {p.address}
                  </span>
                </label>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button type="button" className="ch-btn ch-btn-primary" onClick={() => void saveAssignments()}>
                  Save
                </button>
                <button type="button" className="ch-btn ch-btn-ghost" onClick={() => setAssignUserId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
