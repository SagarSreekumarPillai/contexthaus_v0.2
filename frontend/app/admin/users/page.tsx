"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: 28, fontFamily: "system-ui" }}>
        <Link href="/admin/dashboard" style={{ color: "#888", fontSize: 13 }}>
          ← Admin
        </Link>
        <h1 style={{ color: "#f59e0b" }}>Users</h1>
        <p style={{ color: "#888", fontSize: 13 }}>
          Create accounts for <strong>Verwalter</strong> (full operations), <strong>Auditor</strong> (read + audit),
          and <strong>Contractor</strong> (assigned properties, read-only workspace). Assign properties for contractors
          after saving the user.
        </p>
        {error && <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>}

        <form
          onSubmit={createUser}
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #333",
            borderRadius: 8,
            display: "grid",
            gap: 10,
            maxWidth: 480,
          }}
        >
          <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>New user</div>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: 10, background: "#111", border: "1px solid #333", color: "#fff" }}
          />
          <input
            placeholder="Password (min 8)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ padding: 10, background: "#111", border: "1px solid #333", color: "#fff" }}
          />
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ padding: 10, background: "#111", border: "1px solid #333", color: "#fff" }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            style={{ padding: 10, background: "#111", border: "1px solid #333", color: "#fff" }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            style={{ padding: 12, background: "#f59e0b", color: "#000", border: "none", fontWeight: 700, cursor: "pointer" }}
          >
            Create user
          </button>
        </form>

        <h2 style={{ marginTop: 32, fontSize: 16, color: "#888" }}>Directory</h2>
        <table style={{ width: "100%", maxWidth: 900, borderCollapse: "collapse", fontSize: 13, marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888", borderBottom: "1px solid #333" }}>
              <th style={{ padding: 8 }}>Email</th>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Role</th>
              <th style={{ padding: 8 }}>Active</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: 8 }}>{u.email}</td>
                <td style={{ padding: 8 }}>{u.full_name || "—"}</td>
                <td style={{ padding: 8 }}>
                  <select
                    value={u.role}
                    onChange={(e) => void changeRole(u.id, e.target.value as UserRole)}
                    style={{ padding: 6, background: "#111", border: "1px solid #333", color: "#fff" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: 8 }}>{u.is_active ? "yes" : "no"}</td>
                <td style={{ padding: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void toggleActive(u)}
                    style={{ background: "transparent", border: "1px solid #444", color: "#ccc", cursor: "pointer", padding: "4px 8px" }}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                  {u.role === "contractor" && (
                    <button
                      type="button"
                      onClick={() => openAssignments(u)}
                      style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b", cursor: "pointer", padding: "4px 8px" }}
                    >
                      Assign properties
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {assignUserId && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 100,
            }}
          >
            <div style={{ background: "#111", border: "1px solid #333", padding: 20, maxWidth: 480, width: "100%" }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#f59e0b" }}>Property access</div>
              {properties.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, cursor: "pointer" }}>
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
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => void saveAssignments()}
                  style={{ padding: "10px 16px", background: "#f59e0b", color: "#000", border: "none", fontWeight: 700, cursor: "pointer" }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setAssignUserId(null)}
                  style={{ padding: "10px 16px", background: "transparent", border: "1px solid #444", color: "#ccc", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
