# ContextHaus

> **The living context engine for property management.**  
> One document per building. Always current. Always traced.

[![Security: Aikido](https://img.shields.io/badge/security-aikido-green?style=flat-square)](https://aikido.dev)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue?style=flat-square)](https://python.org)
[![Next.js 16](https://img.shields.io/badge/next.js-16-black?style=flat-square)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](LICENSE)

---

## The Problem

Property managers drown in context. A single building generates dozens of touchpoints every month: ownership-transfer emails, DOMUS ERP exports, PDF maintenance reports, assembly minutes, contractor invoices. Each document lands in a different silo — inbox, drive folder, ERP system — and none of them talk to each other.

When a contractor calls about a boiler at Kastanienallee 88, the manager needs to know: who owns it, who the caretaker is, what the last assembly decided, and whether there's an open ticket. That answer lives across four systems, two languages, and three years of emails.

**ContextHaus solves this by maintaining a single, always-current `PROPERTY.md` per building** — dense, structured, sourced, and surgically updated every time a new document arrives.

---

## Documentation

| Document | Audience | Contents |
|----------|----------|----------|
| [`docs/ENTERPRISE-SOURCE-OF-TRUTH.md`](docs/ENTERPRISE-SOURCE-OF-TRUTH.md) | Product, engineering, delivery | Enterprise pain mapping, phased roadmap, development plan, testing and refinement strategy, risks. **Program source of truth** for maturity work. |
| [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | Engineers and operators | Architecture, environment variables, runbooks, API summary, security boundaries, troubleshooting. **Canonical setup and operations guide.** |
| [`docs/ui-ux-execution-simple.md`](docs/ui-ux-execution-simple.md) | Design / frontend | Lightweight UI execution checklist. |
| [`docs/ui-ux-next-level-master-plan.md`](docs/ui-ux-next-level-master-plan.md) | Design / frontend | Deeper UX principles and component direction. |

---

## Solution Overview

ContextHaus is an ingestion-first context engine. Drop in an email, a PDF, or a German ERP CSV export — ContextHaus classifies it, extracts what matters, and patches only the relevant section of the property's living document. Human edits are preserved. Every fact is traced to its source.

```
Email / PDF / ERP CSV
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     INGEST PIPELINE                         │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  File Parser │───▶│   Pioneer    │───▶│  ERP Schema   │  │
│  │ (email/PDF/  │    │  Classifier  │    │   Resolver    │  │
│  │   ERP CSV)   │    │ (signal/noise│    │ Eigentümer→   │  │
│  └──────────────┘    │  filter)     │    │  owner etc.   │  │
│                      └──────┬───────┘    └───────┬───────┘  │
│                             │ relevant           │           │
│                             ▼                    ▼           │
│                      ┌─────────────────────────────────┐    │
│                      │      Gemini 2.5 Pro/Flash        │    │
│                      │  First ingest → full PROPERTY.md │    │
│                      │  Subsequent → surgical section   │    │
│                      │  patch (Flash, targeted prompt)  │    │
│                      └─────────────┬───────────────────┘    │
│                                    │                         │
│                      ┌─────────────▼───────────────────┐    │
│                      │       Tavily Enrichment          │    │
│                      │  (first ingest only — public     │    │
│                      │   web data appended to Notes)    │    │
│                      └─────────────┬───────────────────┘    │
└────────────────────────────────────┼────────────────────────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │   PROPERTY.md    │
                          │  (SQLite, async) │
                          │                  │
                          │ ## Meta          │
                          │ ## Ownership     │
                          │ ## Open Issues   │
                          │ ## Decisions     │
                          │ ## Contractors   │
                          │ ## Notes         │
                          └────────┬─────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   Next.js UI          │
                        │  Dark mode, live diff │
                        │  Amber flash on update│
                        └──────────────────────┘
```

---

## Three Hard Problems Solved

### 1. Schema Alignment — German ERP Babel

German Hausverwaltung software (DOMUS, Haufe, WEG-Manager) exports CSVs with inconsistent column names depending on version, module, and house. `Eigentümer`, `MietEig`, `Eigentuemer`, and `Kontakt` all mean "owner" — but a naive parser silently drops three of them.

ContextHaus ships a canonical schema map that resolves all known aliases before the LLM ever sees the data:

```
Eigentümer    ──┐
MietEig       ──┼──▶  owner
Eigentuemer   ──┘

MietEig_Kontakt ─┬──▶  owner_contact
Kontakt         ─┘

Heizung_Wartung ────▶  heating_contractor
Letzter_Beschluss ──▶  last_decision
Offene_Tickets ─────▶  open_issues
```

This happens in `backend/app/core/erp_parser.py` before any token is spent on LLM inference. The schema map is extensible — new ERP variants are one line to add.

---

### 2. Surgical Patching — Human Edits Preserved

The naive approach regenerates the entire `PROPERTY.md` on every ingest. This destroys any corrections a property manager made by hand and burns expensive Pro-tier tokens on unchanged sections.

ContextHaus uses a two-phase strategy:

```
First ingest (empty doc)          Subsequent ingest (doc exists)
        │                                    │
        ▼                                    ▼
  Gemini 2.5 Pro                  Pioneer classifies section
  Full generation                  │
  + Tavily enrichment              ▼
  + PROPERTY.md written      Gemini 2.5 Flash
                             targeted PATCH_SECTION prompt
                             only the relevant ## section
                             is rewritten
                                   │
                                   ▼
                             patch_section() regex
                             replaces only that block
                             all other sections unchanged
```

**Before** a maintenance report arrives:

```markdown
## Open Issues
- Roof inspection overdue (noted by manager 2025-03-01)

## Ownership
- owner: Hans Müller   ← manager corrected spelling manually
```

**After** surgical patch (only `Open Issues` touched):

```markdown
## Open Issues
- Roof inspection overdue (noted by manager 2025-03-01)
- URGENT: Water damage reported 2nd floor — contractor dispatched

## Ownership
- owner: Hans Müller   ← untouched
```

The diff engine (`diff_sections`) returns structured change objects — added/updated sections with old and new content — which the frontend uses to drive the amber flash animation.

---

### 3. Signal vs Noise — Pioneer Classifier Gate

Every ingest first passes through a Pioneer (Llama 3.2-3B-Instruct) classifier before spending tokens on Gemini. A newsletter, a spam email, or an unrelated PDF is rejected at the gate with zero LLM cost beyond the classifier call.

The classifier returns structured JSON:

```json
{
  "relevant": false,
  "confidence": 0.94,
  "reason": "marketing newsletter, no property management content"
}
```

Irrelevant documents return `{ "status": "ignored" }` to the caller immediately. The property document is not touched.

Pioneer is called only on documents ingested when a property already has context (first ingest always proceeds to bootstrap the document). This avoids the cold-start problem.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Backend runtime | Python | 3.11 | Async API server |
| API framework | FastAPI | 0.115 | REST endpoints, async handlers |
| Database | SQLite + SQLAlchemy async | 2.0 | Property and source storage |
| ASGI server | uvicorn | 0.34 | Production-grade serving |
| Frontend | Next.js | 16 | React app, App Router |
| Styling | Tailwind CSS | 4.x | Dark UI, amber diff highlights |
| Language (FE) | TypeScript | 5 | Type-safe API client |
| LLM (generation) | Gemini 2.5 Pro | latest | Full PROPERTY.md generation |
| LLM (patching) | Gemini 2.5 Flash | latest | Surgical section patches |
| Classifier | Pioneer / Llama 3.2-3B | Instruct | Signal/noise gate |
| Enrichment | Tavily Search API | v2 | Public property data |
| PDF parsing | pypdf | 5.x | Text extraction from PDFs |
| Security | Aikido | — | 0 open issues |

---

## Partner Technologies

ContextHaus was built for a hackathon requiring a minimum of three partner technologies. Four are integrated:

### Google DeepMind — Gemini 2.5 Pro + Flash

Two tiers of Gemini serve different purposes:

- **Gemini 2.5 Pro** handles initial document generation (`GENERATE_CONTEXT` prompt). It sees all source documents for a property and produces the full structured `PROPERTY.md`. Used once per property.
- **Gemini 2.5 Flash** handles subsequent surgical patches (`PATCH_SECTION` prompt). It receives only the target section and the new document, minimising cost and latency on every subsequent ingest.

### Tavily — Property Enrichment

After the first ingest generates a `PROPERTY.md`, Tavily enriches it with public web data about the address. Neighbourhood data, planning permits, and local service ratings are appended to the `## Notes` section. This happens automatically and only once per property to avoid stale enrichment.

### Pioneer by Fastino — Signal / Noise Classifier

Pioneer serves `meta-llama/Llama-3.2-3B-Instruct` via an OpenAI-compatible endpoint. ContextHaus uses it as a cheap, fast gate before committing Gemini tokens. The 3B model is sufficient for binary relevance classification of property documents and returns structured JSON classification results in under 500ms.

### Aikido — Security Scanning

Aikido runs continuous security analysis on the codebase. Current status: **0 open issues**. All dependencies are scanned for CVEs; CORS, injection vectors, and secret exposure are monitored.

---

## Architecture

```
contexthaus/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── api/
│   │   │   ├── properties.py    # CRUD /api/properties
│   │   │   ├── ingest.py        # POST /api/ingest/{id}/source
│   │   │   ├── analytics.py     # POST /api/analytics/events
│   │   │   └── vendors.py       # vendor workflows
│   │   ├── core/
│   │   │   ├── llm.py           # Gemini Pro/Flash wrappers
│   │   │   ├── patcher.py       # Surgical section patching
│   │   │   ├── classifier.py    # Pioneer relevance gate
│   │   │   ├── enricher.py      # Tavily enrichment
│   │   │   └── erp_parser.py    # German ERP CSV + schema map
│   │   └── db/
│   │       ├── database.py      # SQLite async engine
│   │       └── models.py        # Property, Source, Fact models
│   └── prompts/
│       └── context_generate.py  # SYSTEM, GENERATE_CONTEXT, PATCH_SECTION
└── frontend/
    ├── app/                     # Next.js 14 app router
    ├── components/              # PropertyCard, DiffViewer, UploadPanel
    └── lib/
        └── api.ts               # Typed API client
```

---

## Setup

Follow these steps from a fresh clone. **Never commit `.env` files or API keys.** Use the committed `*.env.example` files as templates only.

### Prerequisites

- **Python 3.11+** (required by the backend)
- **Node.js 20+** (LTS recommended)
- **npm** (ships with Node)
- Recommended: [`uv`](https://github.com/astral-sh/uv) for fast Python environments (`pip install uv`). Plain `python -m venv` and `pip` work as well.

### 1. Backend environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at least **`GEMINI_API_KEY`** for LLM generation and patching. `TAVILY_API_KEY` and `PIONEER_API_KEY` are optional (enrichment and the classifier gate are skipped or degraded without them). Variable descriptions: [`docs/TECHNICAL.md`](docs/TECHNICAL.md#4-environment-variables).

### 2. Install and run the API

Run commands **from the `backend/` directory** so `load_dotenv()` picks up `backend/.env` and the default SQLite file is created next to your working directory.

**Option A — `uv`**

```bash
cd backend
uv venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
uv pip install -e .
uvicorn app.main:app --reload --port 8000
```

**Option B — `venv` + `pip`**

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -U pip
pip install -e .
uvicorn app.main:app --reload --port 8000
```

- API: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`
- Health: `GET http://127.0.0.1:8000/health`

### 3. Frontend environment (optional)

If the API is not on `localhost:8000`, copy the template:

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your API base URL
```

### 4. Install and run the web app

```bash
cd frontend
npm install
npm run dev
```

- UI: `http://localhost:3000`

### 5. Quick verification

1. With the backend running: open `/docs` and call `GET /health`.
2. With **`GEMINI_API_KEY`** set: try `GET /api/test-gemini` once to confirm outbound access to Google AI.
3. Open the UI at `http://localhost:3000` — you are redirected to **Login**. On a **fresh database**, use **Create organization & admin** (`/bootstrap`) once, then sign in.
4. After login, role-based home applies: **Admin** → admin dashboard; **Verwalter** → workspace; **Auditor** / **Contractor** → their dashboards (workspace is read-only for ingest and vendor mutations for those roles).

---

## Authentication and roles

- **Bootstrap** (`POST /api/auth/bootstrap` or UI `/bootstrap`): allowed only while **no users exist**; creates an organization and the first **admin** user.
- **One dev account (optional):** In `backend/.env`, set `SEED_DEFAULT_ACCOUNT=true` plus `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (8+ characters), and optionally `SEED_ORG_NAME` / `SEED_ADMIN_FULL_NAME`. On API startup, if there are **no users yet**, that admin is created automatically so you can go straight to **Login** (see `backend/.env.example`). Use a **normal-looking email** (e.g. `admin@example.com`); addresses like `admin@localhost` are rejected with **422** because the API validates emails strictly. For a matching hint on the login screen, set `NEXT_PUBLIC_DEV_LOGIN_EMAIL` in `frontend/.env.local` to the same email (never put the password in the frontend).
- **Login** (`POST /api/auth/login` or UI `/login`): returns a JWT stored in the browser as `ch_access_token` (see [`frontend/lib/auth.ts`](frontend/lib/auth.ts)).
- **Roles**: `admin` (user management + full ops), `verwalter` (properties, ingest, vendors), `auditor` (read properties + audit log), `contractor` (only **assigned** properties, read-only mutations in UI; API enforces the same).
- **JWT**: set **`JWT_SECRET`** in `backend/.env` for any shared or production environment (see [`docs/TECHNICAL.md`](docs/TECHNICAL.md#4-environment-variables)).

---

## Testing

### Backend (`pytest`)

Does not require API keys for the default smoke test.

```bash
cd backend
pip install -e ".[dev]"    # or: uv pip install -e ".[dev]"
pytest -q
```

Details and future coverage goals: [`docs/TECHNICAL.md`](docs/TECHNICAL.md#8-testing) and [`docs/ENTERPRISE-SOURCE-OF-TRUTH.md`](docs/ENTERPRISE-SOURCE-OF-TRUTH.md#52-refinement-loop-continuous).

### Frontend (Playwright)

```bash
cd frontend
npm install
npx playwright install    # first run only
npm run test:e2e
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/properties/` | List all properties |
| `POST` | `/api/properties/` | Create a new property |
| `GET` | `/api/properties/{id}` | Get a single property with context |
| `DELETE` | `/api/properties/{id}` | Delete a property |
| `POST` | `/api/ingest/{id}/source` | Ingest a file (email/PDF/CSV), returns diff |
| `GET` | `/api/ingest/{id}/context` | Get raw `PROPERTY.md` for a property |
| `POST` | `/api/analytics/events` | Client analytics events (204 No Content) |
| `GET` / `POST` | `/api/vendors/...` | Vendor directory, availability, bookings, recommendations, communications, auto-dispatch |
| `GET` | `/api/test-gemini` | Gemini connectivity check (requires `GEMINI_API_KEY`) |

Full path list and production notes: [`docs/TECHNICAL.md`](docs/TECHNICAL.md#7-api-surface-summary).

### Ingest Response Schema

```json
{
  "status": "ingested",
  "source_id": "uuid",
  "filename": "domus_export.csv",
  "section_updated": "Ownership",
  "changes": [
    {
      "section": "Ownership",
      "type": "updated",
      "old": "- owner: unknown",
      "new": "- owner: Hans Müller\n- owner_contact: h.mueller@example.com"
    }
  ],
  "context_md": "## Meta\n..."
}
```

When a document is filtered by Pioneer:

```json
{
  "status": "ignored",
  "reason": "marketing newsletter, no property management content",
  "changes": []
}
```

---

## Demo Properties

Three Berlin properties are pre-seeded for demonstration:

| Property | Address | Demo Document | What It Shows |
|---|---|---|---|
| Schönhauser Allee 15 | Schönhauser Allee 15, 10435 Berlin | Ownership transfer email | First ingest → full generation + Tavily enrichment |
| Kastanienallee 88 | Kastanienallee 88, 10435 Berlin | `domus_export.csv` | ERP schema resolution (Eigentümer→owner) |
| Rykestraße 7 | Rykestraße 7, 10405 Berlin | Water damage PDF | Surgical patch of `Open Issues` only, human edits preserved |

---

## How the UI Works

The frontend displays each property's `PROPERTY.md` rendered as structured cards. When an ingest completes:

1. The diff response identifies which sections changed (`added` or `updated`)
2. Changed sections flash **amber** for 2 seconds
3. The document settles back to the dark theme with new content in place

This makes it immediately visible what a document changed — without showing a raw diff or reloading the page.

---

## Security

Scanned by [Aikido](https://aikido.dev) — **0 open issues**.

- **Secrets:** Never commit `.env`, `.env.local`, or real API keys. Only `*.env.example` placeholders belong in git. Use a secret manager in production.
- **Gitignore:** `.env`, `.env.local`, `*.db`, `.venv/`, `node_modules/`, `.next/` are excluded from version control.
- **CORS:** Restricted to local dev origins in `backend/app/main.py`; configure explicitly for production.
- **LLM inputs:** User uploads are treated as data to the model, not as executable instructions; still treat all uploads as untrusted files.
- **Uploads:** Size-capped and decoded with safe error handling in the ingest pipeline.

---

## License

MIT © 2025 Nafees Ahamed

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
