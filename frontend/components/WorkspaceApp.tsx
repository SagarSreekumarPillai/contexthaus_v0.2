"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api, Property } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import PropertyView from "@/components/PropertyView";
import { useAuth } from "@/components/AuthProvider";

const CHECKLIST_STORAGE_KEY = "ch.onboarding.v1";
const ROLE_STORAGE_KEY = "ch.user-role.v1";
const ONBOARDING_VISIBLE_KEY = "ch.onboarding.visible.v1";
const ROLES = [
  { id: "owner", label: "Property owner", hint: "Track updates and context for your own assets." },
  { id: "broker", label: "Broker / agent", hint: "Keep multiple properties organized for clients." },
  { id: "ops", label: "Operations", hint: "Maintain operational context and ingest updates quickly." },
];
const ROLE_CHECKLISTS: Record<string, Array<{ id: string; label: string }>> = {
  owner: [
    { id: "create", label: "Create your first property" },
    { id: "select", label: "Select your primary property" },
    { id: "ingest", label: "Ingest first source document" },
  ],
  broker: [
    { id: "create", label: "Create your first client property" },
    { id: "select", label: "Open a property to review context" },
    { id: "ingest", label: "Ingest one deal-related document" },
  ],
  ops: [
    { id: "create", label: "Create operational property record" },
    { id: "select", label: "Open a property workspace" },
    { id: "ingest", label: "Ingest first operations file" },
  ],
};

function SidebarSkeleton() {
  return (
    <div style={{ padding: 16, display: "grid", gap: 10 }} aria-label="Loading properties">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", padding: 10 }}>
          <div className="skeleton shimmer" style={{ height: 10, width: "72%" }} />
          <div className="skeleton shimmer" style={{ height: 8, width: "45%", marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export default function WorkspaceApp() {
  const { user, logout } = useAuth();
  const readOnly = user?.role === "auditor" || user?.role === "contractor";
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    create: false,
    select: false,
    ingest: false,
  });

  const fetchProperties = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const p = await api.getProperties();
      setProperties(p);
      if (p.length > 0) {
        setChecklist((prev) => ({ ...prev, create: true }));
      }
    } catch {
      setLoadError("Could not load properties. Check your connection and retry.");
      trackEvent("properties_load_failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const storedChecklist = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
        if (storedChecklist) {
          setChecklist(JSON.parse(storedChecklist));
        }
      } catch {
        // Ignore storage errors in private mode.
      }
      try {
        const storedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
        if (storedRole) {
          setSelectedRole(storedRole);
        }
      } catch {
        // Ignore storage errors in private mode.
      }
      try {
        const storedVisibility = window.localStorage.getItem(ONBOARDING_VISIBLE_KEY);
        if (storedVisibility) {
          setOnboardingVisible(storedVisibility !== "hidden");
        }
      } catch {
        // Ignore storage errors in private mode.
      }
    });
    Promise.resolve().then(() => {
      setLoading(true);
      setLoadError("");
      api.getProperties()
        .then((p) => {
          setProperties(p);
          if (p.length > 0) {
            setChecklist((prev) => ({ ...prev, create: true }));
          }
        })
        .catch(() => {
          setLoadError("Could not load properties. Check your connection and retry.");
        })
        .finally(() => {
          setLoading(false);
        });
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [checklist]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const cmdOrCtrlK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (cmdOrCtrlK) {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const createProperty = async () => {
    if (!form.name || !form.address) return;
    setCreateError("");
    try {
      const p = await api.createProperty(form.name, form.address);
      setProperties((prev) => [p, ...prev]);
      setSelected(p);
      setCreating(false);
      setForm({ name: "", address: "" });
      setChecklist((prev) => ({ ...prev, create: true, select: true }));
      trackEvent("property_created", { propertyId: p.id });
    } catch {
      setCreateError("Could not create property. Please retry.");
      trackEvent("property_create_failed");
    }
  };

  const updateSelected = (p: Property) => {
    setSelected(p);
    setProperties((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    if (p.context_md) {
      setChecklist((prev) => ({ ...prev, ingest: true }));
      trackEvent("first_value_achieved", { propertyId: p.id });
    }
  };

  const setRole = (roleId: string) => {
    setSelectedRole(roleId);
    setOnboardingVisible(true);
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, roleId);
      window.localStorage.setItem(ONBOARDING_VISIBLE_KEY, "visible");
    } catch {
      // Ignore storage errors in private mode.
    }
    trackEvent("role_selected", { role: roleId });
  };
  const hideOnboarding = () => {
    setOnboardingVisible(false);
    try {
      window.localStorage.setItem(ONBOARDING_VISIBLE_KEY, "hidden");
    } catch {
      // Ignore storage errors in private mode.
    }
    trackEvent("onboarding_hidden");
  };
  const resumeOnboarding = () => {
    setOnboardingVisible(true);
    try {
      window.localStorage.setItem(ONBOARDING_VISIBLE_KEY, "visible");
    } catch {
      // Ignore storage errors in private mode.
    }
    trackEvent("onboarding_resumed");
  };

  const filteredProperties = properties.filter((p) => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
  });

  const checklistItems = ROLE_CHECKLISTS[selectedRole ?? "owner"];
  const completedCount = checklistItems.filter((item) => checklist[item.id]).length;
  const completionLabel = `${completedCount}/${checklistItems.length}`;
  const onboardingCompleted = completedCount === checklistItems.length;

  return (
    <div className="ch-workspace-root">
      {!selectedRole && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          data-testid="role-onboarding-modal"
        >
          <div style={{
            width: "min(720px, 100%)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: 20,
          }}>
            <div className="heading" style={{ fontSize: 20, color: "var(--amber)", marginBottom: 8 }}>
              Welcome to ContextHaus
            </div>
            <div style={{ color: "var(--text-muted)", marginBottom: 14, fontSize: 12 }}>
              Pick your primary goal so we can personalize your onboarding path.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setRole(role.id)}
                  data-testid={`role-option-${role.id}`}
                  style={{
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    textAlign: "left",
                    padding: "10px 12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>{role.label}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{role.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {commandPaletteOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 70,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 80,
          }}
          onClick={() => setCommandPaletteOpen(false)}
          data-testid="command-palette-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(700px, 92vw)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
            data-testid="command-palette"
          >
            <input
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              placeholder="Search commands or properties..."
              autoFocus
              data-testid="command-palette-input"
              style={{
                width: "100%",
                border: "none",
                borderBottom: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                padding: "12px 14px",
                outline: "none",
              }}
            />
            <div style={{ maxHeight: 360, overflowY: "auto", padding: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", margin: "6px 4px", letterSpacing: "0.08em" }}>
                QUICK ACTIONS
              </div>
              {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setCommandPaletteOpen(false);
                  trackEvent("command_palette_action_clicked", { action: "open_create" });
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "1px solid transparent",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
                data-testid="command-open-create"
              >
                + New property
              </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setRole("owner");
                  resumeOnboarding();
                  setCommandPaletteOpen(false);
                  trackEvent("command_palette_action_clicked", { action: "start_guided_onboarding" });
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "1px solid transparent",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
                data-testid="command-start-guided"
              >
                Start guided onboarding
              </button>
              <div style={{ fontSize: 10, color: "var(--text-muted)", margin: "10px 4px 6px", letterSpacing: "0.08em" }}>
                PROPERTIES
              </div>
              {filteredProperties.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 11, padding: "8px 12px" }}>
                  No properties found
                </div>
              )}
              {filteredProperties.map((property) => (
                <button
                  type="button"
                  key={property.id}
                  onClick={() => {
                    setSelected(property);
                    setChecklist((prev) => ({ ...prev, select: true }));
                    setCommandPaletteOpen(false);
                    trackEvent("command_palette_property_selected", { propertyId: property.id });
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "1px solid transparent",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                  data-testid="command-property-item"
                >
                  <div style={{ fontWeight: 600 }}>{property.name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{property.address}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className="ch-workspace-sidebar"
        style={{
          width: 280,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="heading" style={{ fontSize: 18, fontWeight: 800, color: "var(--amber)" }}>
            ContextHaus
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
            Property Context Engine
          </div>
          {user && (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
              <div style={{ color: "var(--text)", fontWeight: 600 }}>{user.full_name || user.email}</div>
              <div>{user.role} · {user.organization_name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {user.role === "admin" && (
                  <Link href="/admin/dashboard" style={{ color: "var(--amber)" }}>
                    Admin
                  </Link>
                )}
                {user.role === "admin" && (
                  <Link href="/admin/audit" style={{ color: "var(--amber)" }}>
                    Audit log
                  </Link>
                )}
                {user.role === "auditor" && (
                  <Link href="/auditor/audit" style={{ color: "var(--amber)" }}>
                    Audit log
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => logout()}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 11,
                    textDecoration: "underline",
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Property Button */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            style={{
              width: "100%", padding: "6px 10px", marginBottom: 8,
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: "pointer", fontSize: 11, textAlign: "left",
            }}
            data-testid="open-command-palette"
          >
            Search or run command... (Cmd/Ctrl + K)
          </button>
          {!readOnly && (
          <button
            onClick={() => setCreating(!creating)}
            data-testid="new-property-button"
            style={{
              width: "100%", padding: "8px 12px", background: "var(--amber)",
              color: "#000", border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.05em",
            }}
          >
            + NEW PROPERTY
          </button>
          )}

          {!readOnly && creating && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }} className="fade-in">
              <input
                placeholder="Property name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="property-name-input"
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--text)", padding: "6px 8px", fontFamily: "inherit",
                  fontSize: 12, outline: "none", width: "100%",
                }}
              />
              <input
                placeholder="Address"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                data-testid="property-address-input"
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--text)", padding: "6px 8px", fontFamily: "inherit",
                  fontSize: 12, outline: "none", width: "100%",
                }}
              />
              <button
                onClick={createProperty}
                data-testid="create-property-submit"
                style={{
                  background: "var(--surface)", border: "1px solid var(--amber)",
                  color: "var(--amber)", padding: "6px 8px", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12,
                }}
              >
                CREATE →
              </button>
              {createError && (
                <div style={{ color: "var(--red)", fontSize: 11 }} data-testid="create-error-message">
                  {createError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Property List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && <SidebarSkeleton />}
          {!loading && loadError && (
            <div style={{ padding: 12 }}>
              <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 6 }}>{loadError}</div>
              <button
                type="button"
                onClick={() => {
                  trackEvent("properties_retry_clicked");
                  fetchProperties();
                }}
                data-testid="retry-load-properties"
                style={{
                  border: "1px solid var(--amber)",
                  color: "var(--amber)",
                  background: "transparent",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Retry
              </button>
            </div>
          )}
          {properties.map(p => (
            <div
              key={p.id}
              onClick={() => {
                setSelected(p);
                setChecklist((prev) => ({ ...prev, select: true }));
              }}
              data-testid="property-list-item"
              style={{
                padding: "12px 16px", cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                background: selected?.id === p.id ? "var(--surface)" : "transparent",
                borderLeft: selected?.id === p.id ? "2px solid var(--amber)" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontWeight: 500, color: "var(--text)", fontSize: 12 }}>{p.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{p.address}</div>
              <div style={{ marginTop: 4 }}>
                <span style={{
                  fontSize: 10, padding: "2px 6px",
                  background: p.context_md ? "rgba(74,222,128,0.1)" : "rgba(107,104,96,0.2)",
                  color: p.context_md ? "var(--green)" : "var(--text-muted)",
                }}>
                  {p.context_md ? "● LIVE" : "○ EMPTY"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 10 }}>
          Powered by Gemini 2.5 · Tavily · Pioneer
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {onboardingVisible ? (
          <>
            <div style={{
              padding: "10px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(245,166,35,0.04)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Onboarding checklist</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 11, color: "var(--amber)" }} data-testid="onboarding-progress">{completionLabel}</div>
                <button
                  type="button"
                  onClick={hideOnboarding}
                  data-testid="hide-onboarding"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    padding: "3px 6px",
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  Hide
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
              {checklistItems.map((item) => (
                <div key={item.id} style={{ fontSize: 11, color: checklist[item.id] ? "var(--green)" : "var(--text-muted)" }}>
                  {checklist[item.id] ? "✓" : "○"} {item.label}
                </div>
              ))}
            </div>
          </>
        ) : (
          !onboardingCompleted && (
            <div style={{
              padding: "10px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(96,165,250,0.06)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Onboarding paused at {completionLabel}. Resume to finish setup.
              </div>
              <button
                type="button"
                onClick={resumeOnboarding}
                data-testid="resume-onboarding"
                style={{
                  border: "1px solid var(--blue)",
                  color: "var(--blue)",
                  background: "transparent",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Resume
              </button>
            </div>
          )
        )}
        {selected ? (
          <PropertyView property={selected} onUpdate={updateSelected} readOnly={readOnly} />
        ) : (
          <div style={{
            height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", gap: 12,
          }}>
            <div className="heading" style={{ fontSize: 32, fontWeight: 800, color: "var(--border)" }}>
              SELECT A PROPERTY
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              or create one to get started
            </div>
          </div>
        )}
      </div>
    </div>
  );
}