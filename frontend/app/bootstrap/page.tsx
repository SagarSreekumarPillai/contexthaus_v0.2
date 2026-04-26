"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function BootstrapPage() {
  const { loginWithToken } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    try {
      const res = await api.bootstrap({
        organization_name: orgName,
        admin_email: email,
        admin_password: password,
        admin_full_name: fullName,
      });
      loginWithToken(res.access_token, res.user);
      setDone("Organization created. Redirecting…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap failed");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, border: "1px solid #333", padding: 28 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#f59e0b" }}>Bootstrap</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>
          Runs only when no users exist yet. Creates your organization and the first admin account.
        </p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#888" }}>
            Organization name
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                background: "#111",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 4,
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#888" }}>
            Admin email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                background: "#111",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 4,
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#888" }}>
            Admin password (min 8 characters)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                background: "#111",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 4,
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#888" }}>
            Admin full name (optional)
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                background: "#111",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 4,
              }}
            />
          </label>
          {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}
          {done && <div style={{ color: "#4ade80", fontSize: 12 }}>{done}</div>}
          <button
            type="submit"
            style={{
              padding: "12px 16px",
              background: "#f59e0b",
              color: "#000",
              border: "none",
              borderRadius: 4,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Create organization
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 12 }}>
          <Link href="/login" style={{ color: "#f59e0b" }}>
            Already have an account? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
