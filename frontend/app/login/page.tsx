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
      <div style={{ width: "100%", maxWidth: 400, border: "1px solid #333", padding: 28 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#f59e0b" }}>ContextHaus</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888" }}>Sign in with your organization account.</p>
        {DEV_LOGIN_EMAIL && (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 12,
              color: "#666",
              borderLeft: "2px solid #f59e0b",
              paddingLeft: 10,
            }}
            data-testid="dev-login-hint"
          >
            Dev login email: <strong style={{ color: "#ccc" }}>{DEV_LOGIN_EMAIL}</strong>
            <span style={{ display: "block", marginTop: 4 }}>
              Use the password from <code style={{ color: "#888" }}>SEED_ADMIN_PASSWORD</code> in your backend{" "}
              <code style={{ color: "#888" }}>.env</code> (never committed).
            </span>
          </p>
        )}
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#888" }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="login-email"
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
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password"
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
          {error && (
            <div style={{ color: "#f87171", fontSize: 12 }} data-testid="login-error">
              {error}
            </div>
          )}
          <button
            type="submit"
            data-testid="login-submit"
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
            Sign in
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 12, color: "#666" }}>
          First time?{" "}
          <Link href="/bootstrap" style={{ color: "#f59e0b" }}>
            Create organization & admin
          </Link>
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{ marginTop: 12, background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
