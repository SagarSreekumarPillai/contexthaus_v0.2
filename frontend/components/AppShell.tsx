"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { groupedNav, type ShellNavIcon } from "@/lib/nav-config";

function NavGlyph({ name }: { name: ShellNavIcon }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 };
  switch (name) {
    case "layout":
      return (
        <svg {...common} aria-hidden>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="18" height="8" rx="1.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "scroll":
      return (
        <svg {...common} aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case "building":
      return (
        <svg {...common} aria-hidden>
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v0M9 13v0M9 17v0M13 13v0M13 17v0" />
        </svg>
      );
    default:
      return null;
  }
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = useMemo(() => groupedNav(user?.role), [user?.role]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="ch-shell">
      {mobileOpen && (
        <button
          type="button"
          className="ch-shell-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside id="app-sidebar" className={`ch-shell-sidebar${mobileOpen ? " is-open" : ""}`}>
        <div className="ch-shell-brand">
          <Link href={user?.role === "admin" ? "/admin/dashboard" : "/workspace"} className="ch-shell-brand-link" onClick={() => setMobileOpen(false)}>
            <span className="ch-shell-brand-mark">ContextHaus</span>
            <span className="ch-shell-brand-tag">Operations</span>
          </Link>
        </div>
        <nav className="ch-shell-nav" aria-label="Primary">
          {sections.map(({ group, items }) => (
            <div key={group}>
              <div className="ch-shell-nav-group-label">{group}</div>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="ch-shell-nav-link"
                  data-active={isActive(item.href) ? "true" : "false"}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="ch-shell-nav-icon" aria-hidden>
                    <NavGlyph name={item.icon} />
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="ch-shell-sidebar-footer">Internal use · treat data as sensitive</div>
      </aside>

      <div className="ch-shell-main">
        <header className="ch-shell-header">
          <div className="ch-shell-header-left">
            <button
              type="button"
              className="ch-shell-menu-btn"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileOpen((o) => !o)}
            >
              <span className="ch-shell-menu-bar" />
              <span className="ch-shell-menu-bar" />
              <span className="ch-shell-menu-bar" />
            </button>
            <div>
              <h1 className="ch-shell-title">{title}</h1>
              {subtitle ? <p className="ch-shell-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <div className="ch-shell-header-right">
            {user?.organization_name ? <span className="ch-shell-org-pill">{user.organization_name}</span> : null}
            <div className="ch-shell-user">
              <span className="ch-shell-user-email">{user?.full_name || user?.email}</span>
              <span className="ch-shell-user-role">{user?.role}</span>
            </div>
            <button type="button" className="ch-btn ch-btn-ghost ch-btn-sm" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </header>
        <main className="ch-shell-body">
          <div className="ch-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
