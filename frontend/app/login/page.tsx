"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const DEV_LOGIN_EMAIL = process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL?.trim() || "";

export default function LoginPage() {
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(DEV_LOGIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.login(email, password);
      loginWithToken(res.access_token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="ch-auth-page">
      <div className="ch-auth-card">
        <div className="ch-auth-brand">ContextHaus</div>
        <p className="ch-auth-sub">Sign in with your organization account.</p>
        {DEV_LOGIN_EMAIL ? (
          <p className="ch-auth-hint" data-testid="dev-login-hint">
            Dev login email: <strong style={{ color: "var(--ch-text)" }}>{DEV_LOGIN_EMAIL}</strong>
            <span style={{ display: "block", marginTop: 6 }}>
              Use the password from <code className="ch-mono">SEED_ADMIN_PASSWORD</code> or your known-user script in backend{" "}
              <code className="ch-mono">.env</code>.
            </span>
          </p>
        ) : null}
        <form className="ch-auth-form" onSubmit={onSubmit}>
          <label className="ch-auth-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="login-email"
              className="ch-input"
            />
          </label>
          <label className="ch-auth-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password"
              className="ch-input"
            />
          </label>
          {error ? (
            <div className="ch-error" data-testid="login-error" style={{ marginBottom: 0 }}>
              {error}
            </div>
          ) : null}
          <button type="submit" data-testid="login-submit" className="ch-btn ch-btn-primary" style={{ marginTop: 4 }}>
            Sign in
          </button>
        </form>
        <p className="ch-auth-footer">
          First time?{" "}
          <Link href="/bootstrap">Create organization &amp; admin</Link>
        </p>
        <button type="button" className="ch-auth-back" onClick={() => router.push("/")}>
          Back to home
        </button>
      </div>
    </div>
  );
}
