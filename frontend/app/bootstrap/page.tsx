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
    <div className="ch-auth-page">
      <div className="ch-auth-card">
        <div className="ch-auth-brand">Bootstrap</div>
        <p className="ch-auth-sub">Runs only when no users exist yet. Creates your organization and the first admin account.</p>
        <form className="ch-auth-form" onSubmit={onSubmit}>
          <label className="ch-auth-label">
            Organization name
            <input className="ch-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
          </label>
          <label className="ch-auth-label">
            Admin email
            <input className="ch-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="ch-auth-label">
            Admin password (min 8 characters)
            <input
              className="ch-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label className="ch-auth-label">
            Admin full name (optional)
            <input className="ch-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          {error ? <div className="ch-error">{error}</div> : null}
          {done ? (
            <div style={{ color: "var(--ch-success)", fontSize: 13 }}>
              {done}
            </div>
          ) : null}
          <button type="submit" className="ch-btn ch-btn-primary">
            Create organization
          </button>
        </form>
        <p className="ch-auth-footer">
          <Link href="/login">Already have an account? Sign in</Link>
        </p>
      </div>
    </div>
  );
}
