# ContextHaus — Enterprise program of record

**Status:** canonical roadmap, delivery plan, testing strategy, and refinement cadence for taking ContextHaus from hackathon-grade to **enterprise-grade** operations.

**Companion documents**

| Document | Purpose |
|----------|---------|
| [`docs/TECHNICAL.md`](TECHNICAL.md) | Architecture, environment variables, runbooks, API surface, security boundaries (no secrets). |
| [`README.md`](../README.md) | Product overview, quick start, and entry point for new contributors. |

This file is the **single source of truth** for *what* we build toward enterprise readiness and *how* we prove it. Implementation details that change frequently (exact CLI flags, port defaults) stay in `TECHNICAL.md` and `README.md`; those docs must stay aligned when tooling changes.

---

## 1. Enterprise problem frame (pain inventory → product obligations)

These pains drive requirements. Every roadmap phase must trace to at least one obligation here.

| Theme | Pain (operator / legal / scale) | Enterprise obligation |
|-------|-----------------------------------|------------------------|
| **Provenance** | Owners and courts care about *exact* decisions, dates, and amounts; summarization errors are unacceptable. | Immutable source store, citation-grade links from `PROPERTY.md` facts to raw sources, explicit “human override” semantics. |
| **WEG / governance** | Beschlusssammlung, protocol registration windows, long retention; digital + original practice. | Audit log of ingest and patch, no silent overwrite of legally material fields without review queue (future). |
| **Silo fragmentation** | ERP, inbox, drive, tickets do not integrate; ~30-tool stacks in large PM orgs. | ContextHaus as **read-side context layer** with clear export and API contracts; avoid duplicating financial system of record. |
| **Master data quality** | Wrong unit, wrong owner row, CSV variant drift. | Schema map evolution, validation gates, confidence flags on extracted facts. |
| **Classifier risk** | False negative → document ignored → silent drift. | Monitoring false negative/positive rate, shadow mode, human review for high-risk property tiers. |
| **LLM precision** | Legal numerics, Beschlussnummern, percentages. | Structured extraction paths for high-risk fields; literal-quote mode for decisions (future). |
| **Non-email reality** | WhatsApp, site photos, verbal handoffs never hit ingest. | Mobile capture / forward-to-ingest workflows (roadmap); document known gaps in UI. |
| **Stakeholders** | Verwalter, board, owners, contractors see different slices; DSGVO. | Role-based views and redaction (roadmap); PII minimization in prompts and logs. |
| **Portfolio scale** | Many buildings, concurrent emergencies. | Property-level SLAs, cross-portfolio search and queues (roadmap), cost caps per ingest. |
| **Institutional memory** | Turnover loses tacit knowledge. | Onboarding views, “unknown / gap” markers, export for successor Verwalter. |
| **Enrichment decay** | One-shot web enrichment goes stale. | Re-enrichment policy, timestamps, and staleness warnings in `## Notes`. |
| **Adoption** | Long ramps to software acceptance in Hausverwaltung. | Frictionless ingest, training materials, optional PDF snapshot export for owners. |

---

## 2. Enterprise pillars (non-negotiables)

1. **Trust:** Every surfaced fact is traceable to a stored source artifact and ingest run.
2. **Security:** Secrets in vaults or environment only; no secrets in git; least-privilege API keys; CORS and TLS configured per environment.
3. **Observability:** Structured logs, ingest metrics (latency, token usage, classifier outcome, patch section), health endpoints.
4. **Quality gates:** Automated tests block regressions on parser, patch application, and API contracts.
5. **Compliance posture:** GDPR-aware handling of personal data; data retention and export story documented (implement in phases).
6. **Operational continuity:** Backup/restore for SQLite (dev) and prescribed DB strategy for production (Postgres, etc., in later phase).

---

## 3. Roadmap (phased)

Phases are sequential for critical path; some work packages can overlap where noted.

### Phase 0 — Baseline (current repo)

- Ingest pipeline (email / PDF / ERP CSV), classifier gate, Gemini Pro/Flash, Tavily enrichment, SQLite persistence, Next.js UI with diff UX.
- **Exit criteria:** Fresh clone passes documented setup; smoke path: create property → ingest → see diff (documented in `TECHNICAL.md`).

### Phase 1 — Enterprise documentation and hygiene

- This program of record + `TECHNICAL.md` + README alignment.
- `.env.example` only (never commit `.env`).
- **Exit criteria:** New engineer productive in under one business day using docs only.

### Phase 2 — Testing and quality rigor

- Backend: `pytest` + HTTP contract tests against FastAPI (TestClient or async client), golden fixtures for `erp_parser` and `patcher` / `diff_sections`.
- **Baseline (in repo):** `backend/tests/test_health.py` — smoke test for `GET /health` with no API keys required; install dev extras: `pip install -e ".[dev]"` from `backend/`.
- Frontend: Playwright CI for critical paths; expand coverage for ingest and property list.
- Classifier: labeled evaluation set (even small) with precision/recall tracked in CI or nightly job.
- **Exit criteria:** CI runs unit + integration on every PR; flake policy documented.

### Phase 3 — Trust and audit (MVP+ for regulated users)

- Append-only `ingest_run` / audit table: who, when, property, outcome, model version.
- UI: source list per property with download or hash reference.
- Explicit “review required” flag for ingests touching `## Decisions` or detected legal numerics (heuristic first).
- **Exit criteria:** Demo audit narrative: reproduce any sentence in `PROPERTY.md` from a source within two clicks.

### Phase 4 — Scale and multi-tenant shape

- AuthN (OIDC or API keys per tenant), tenant isolation in DB, rate limits.
- Replace or augment SQLite with managed Postgres for concurrent writes.
- Background queue for ingests (Redis/RQ or cloud-native queue).
- **Exit criteria:** Load test SLO documented (ingests/min, p95 latency).

### Phase 5 — Role-based access and exports

- Roles: admin, Verwalter, read-only auditor, contractor-limited.
- Redacted PDF or Markdown export for owners / board packs.
- **Exit criteria:** Access matrix documented and enforced in API.

---

## 4. Solid development plan

### 4.1 Engineering principles

- Small PRs with a single intent; each merges with green CI.
- Feature flags for risky paths (classifier strictness, auto-patch vs review).
- Backward-compatible API versioning (`/api/v1/...`) before external consumers (Phase 4).

### 4.2 Workstreams (parallelizable after Phase 2 starts)

| Workstream | Owner (team assigns) | Deliverables |
|------------|----------------------|--------------|
| **Parser & schema** | Backend | New ERP column aliases, validation tests, malformed CSV behavior. |
| **Ingest & LLM** | Backend | Prompt versioning, token budgets, retry policy, idempotent ingest keys. |
| **API & contracts** | Backend | OpenAPI as contract; consumer-driven tests from frontend or golden JSON. |
| **UI & UX** | Frontend | Review queue UI, source viewer, error states, accessibility. |
| **Security** | Platform | Secret scanning, dependency updates, threat model update per major phase. |
| **Data** | Platform | Migrations, backup runbook, anonymized fixtures for CI. |

### 4.3 Milestone cadence (suggested)

- **Weekly:** sprint planning against this roadmap; burn down Phase exit criteria.
- **Bi-weekly:** cross-functional review (product + eng + optional domain SME from Hausverwaltung).
- **Monthly:** roadmap refresh; move items between phases based on risk and customer evidence.

### 4.4 Definition of Done (enterprise-oriented)

A feature is **done** when:

1. Code merged with tests and docs updated.
2. Security impact considered (data classification, new endpoints authenticated when Phase 4+ applies).
3. Observability: logs/metrics or explicit “not applicable” with rationale.
4. Rollback path documented if feature-flagged or migration-backed.

---

## 5. Rigorous testing and refinement plan

### 5.1 Test pyramid

| Layer | Scope | Tools | Cadence |
|-------|--------|-------|---------|
| **Unit** | `erp_parser`, `patcher`, diff helpers, pure utilities | `pytest` | Every PR |
| **Integration** | DB + ingest pipeline with mocked LLM/classifier where possible | `pytest` + fixtures | Every PR |
| **Contract** | OpenAPI response shapes for properties, ingest, vendors, analytics | Schemathesis or hand-written JSON assertions | Every PR or nightly |
| **E2E** | User flows in browser | Playwright | Every PR (smoke) + full suite nightly |
| **Load** | Ingest burst, concurrent reads | k6 or Locust | Before Phase 4 release |
| **Classifier eval** | Fixed corpus: relevant vs irrelevant + regression set | Script + CSV in `backend/tests/fixtures/` (no PII) | Weekly or on classifier prompt change |

### 5.2 Refinement loop (continuous)

1. **Triage:** Production or pilot issues tagged: data bug, model bug, UX bug, infra.
2. **Golden files:** Add minimal reproducer to fixtures; test must fail before fix.
3. **Prompt / schema change:** Require classifier eval + at least one full ingest integration test.
4. **Release checklist:** Migrations applied, feature flags default-safe, `TECHNICAL.md` runbook updated.

### 5.3 Quality metrics (targets to define numerically per pilot)

- Ingest success rate vs validation errors.
- Classifier override rate (human forced relevant).
- Patch conflict rate (human reverted section).
- Time-to-first-answer for scripted support scenarios (UX lab).

---

## 6. Risk register (living)

| Risk | Mitigation | Phase |
|------|------------|-------|
| LLM hallucination on legal text | Review queue, literal extraction for decisions, disclaimers in UI | 3 |
| Classifier false negative | Shadow logging, periodic eval, default-safe “uncertain → classify as relevant” for high-value doc types | 2–3 |
| Secret leak | Pre-commit secret scan, `.env.example` only, CI grep | 1 |
| Single-DB write bottleneck | Queue + Postgres | 4 |
| Vendor lock-in on Gemini/Pioneer | Abstract LLM client interface; keep prompts versioned | ongoing |

---

## 7. Document governance

- **Changing scope of phases:** Edit this file in the same PR as the implementation or as a dedicated “roadmap-only” PR with team review.
- **Changing how to run the app:** Update `TECHNICAL.md` and `README.md` in the **same** PR as the code change.
- **Review cycle:** Quarterly read-through of this file for stale assumptions.

---

## 8. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-04-26 | Initial enterprise program of record, aligned with pain research and repo layout. |
| 1.1 | 2026-04-26 | Phase 2 baseline: documented `pytest` health smoke in backend. |
