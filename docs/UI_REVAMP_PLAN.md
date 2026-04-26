# ContextHaus UI revamp — source of truth

This document is the **authoritative plan** for the product UI. Implementation should match these principles; when code and this doc disagree, **update the code or the doc explicitly** (never leave silent drift).

## 1. References and direction

We align with patterns common in **B2B SaaS dashboards** on Dribbble and similar portfolios (e.g. analytics / ops consoles, multi-tenant admin tools):

- **Dark-first shell**: deep neutral background, one warm accent (amber) for primary actions and active nav—not neon gradients.
- **Persistent application chrome**: left navigation + top header with page title and org context (not a new layout per page).
- **Information hierarchy**: page title → short subtitle → content in **cards** or **bounded tables**; avoid full-bleed unstructured forms.
- **Density**: comfortable for operators (13–14px body, clear table row height, generous tap targets ≥40px where interactive).
- **Role clarity**: navigation only shows destinations the role can access; copy states read-only vs full ops where relevant.

**Not** in scope for this pass: illustration-heavy marketing site, custom charting library, or full design-system package publish.

## 2. Brand and tokens

| Token role | Intent |
|------------|--------|
| Background (`--ch-bg`) | App canvas |
| Elevated / surface (`--ch-bg-elevated`, `--ch-surface`) | Header, cards, sidebar |
| Borders (`--ch-border`, `--ch-border-subtle`) | Separation without harsh #333 grids |
| Accent (`--ch-accent`) | Primary CTA, active nav, links |
| Text (`--ch-text`, secondary, muted) | Body, labels, de-emphasis |
| Semantic | Success / danger / info for states |

Typography: **Geist Sans** (already loaded in `app/layout.tsx`) as primary UI font; **Geist Mono** for code, IDs, timestamps in tables.

Radius: **6–14px**; shadows minimal (dark UI reads flatter).

## 3. Layout model

### 3.1 Authenticated “console” routes

Routes: `/admin/*`, `/auditor/*`, `/contractor/*`.

Use **`AppShell`**:

- **Left sidebar (264px desktop)**: logo wordmark, grouped nav links with icons, active state.
- **Top bar**: page title, optional subtitle, org name, user email + role, sign out.
- **Main**: scrollable content, max-width ~1120px centered with horizontal padding.

**Mobile (<901px)**: sidebar off-canvas; menu button in header; backdrop dismisses drawer.

### 3.2 Workspace (`/workspace`)

Stays a **dedicated two-column workspace** (property list + detail) because it is the primary working surface, not a simple CRUD list.

Visual treatment must **match the shell**: same CSS variables, typography, and button/input styles so it feels one product. Optional later: embed workspace list into `AppShell` sidebar (larger refactor).

### 3.3 Auth routes (`/login`, `/bootstrap`)

Centered **card** on canvas, same tokens; no persistent nav.

## 4. Component inventory (implementation checklist)

| Item | Status |
|------|--------|
| CSS variables + utilities (`globals.css` — `ch-*`) | Done |
| `lib/nav-config.ts` — role-filtered nav | Done |
| `components/AppShell.tsx` | Done |
| Admin dashboard — KPI cards + link tiles | Done |
| Admin users / audit — shell + cards + table styles | Done |
| Auditor / contractor dashboards — shell + tiles | Done |
| `AuditLogTable` — shared table classes | Done |
| `RequireAuth` loading state | Done |
| Login + bootstrap pages | Done |
| `WorkspaceApp` — token-aligned root + sidebar class | Done |
| `PropertyView` — `ch-pv-*` layout, rail panels, markdown prose, a11y | Done |
| `WorkspaceApp` — role modal + command palette (`ch-ws-*`) | Done |

## 5. Accessibility and QA

- Preserve existing **`data-testid`** hooks used by Playwright (`role-onboarding-modal`, `property-list-item`, `command-palette`, `selected-property-title`, etc.).
- Focus states visible on keyboard nav (`:focus-visible`).
- Run `npm run build` and `npx playwright test` before merge.
- Playwright uses `npm run build && npx next start` on port **3100** so tests do not conflict with another `next dev` for this repo. Install browsers once: `npx playwright install chromium`. Tests that open **PropertyView** mock `**/api/vendors/**` so unauthenticated backend calls do not 401 the session.

## 6. Changelog

| Date | Note |
|------|------|
| 2026-04-26 | Initial plan + Phase 1–5 implementation (shell, tokens, dashboards, auth polish). |
| 2026-04-26 | Peak pass: `PropertyView` polished shell + vendor rail + responsive split; markdown typography; workspace modals. |
