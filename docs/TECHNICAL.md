# ContextHaus — Technical documentation

Single technical reference for **architecture**, **configuration**, **local development**, **testing**, and **security**. Product and delivery priorities live in [`ENTERPRISE-SOURCE-OF-TRUTH.md`](ENTERPRISE-SOURCE-OF-TRUTH.md).

**Do not commit API keys or `.env` files.** Use `.env.example` files and your platform secret store in production.

---

## 1. System overview

```
                    ┌─────────────────┐
                    │  Next.js (UI)   │
                    │  localhost:3000 │
                    └────────┬────────┘
                             │ HTTP (JSON)
                             ▼
                    ┌─────────────────┐
                    │ FastAPI         │
                    │ localhost:8000  │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌───────────┐   ┌────────────┐
        │ SQLite   │   │ Gemini    │   │ Pioneer    │
        │ (async)  │   │ Pro/Flash │   │ classifier │
        └──────────┘   └───────────┘   └────────────┘
              │              │
              │              └── Tavily (enrichment, optional key)
              ▼
        PROPERTY.md per property + source metadata
```

---

## 2. Repository layout

```
contexthaus_v0.2/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, lifespan, health
│   │   ├── api/              # properties, ingest, analytics, vendors
│   │   ├── core/             # llm, patcher, classifier, enricher, erp_parser
│   │   └── db/               # SQLAlchemy async, models
│   ├── pyproject.toml
│   └── .env.example          # copy to .env (never commit .env)
├── frontend/
│   ├── app/                  # Next.js App Router
│   ├── lib/api.ts            # API client (NEXT_PUBLIC_API_URL)
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── ENTERPRISE-SOURCE-OF-TRUTH.md
│   └── TECHNICAL.md          # this file
└── README.md
```

---

## 3. Prerequisites

| Component | Version | Notes |
|-----------|---------|--------|
| Python | 3.11+ | Matches `backend/pyproject.toml` |
| Node.js | 20+ | LTS recommended for Next.js |
| `uv` | current | Fast Python env and installs: https://github.com/astral-sh/uv |

---

## 4. Environment variables

Create `backend/.env` by copying `backend/.env.example`. **Never paste real keys into documentation or commits.**

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for LLM features) | Google AI Studio / Vertex key for `google-genai` client |
| `TAVILY_API_KEY` | No | If missing, enrichment is skipped |
| `PIONEER_API_KEY` | No | If missing, classifier returns relevant with reason `no pioneer key` |
| `DATABASE_URL` | No | Default `sqlite+aiosqlite:///./contexthaus.db` (relative to process CWD) |
| `JWT_SECRET` | Strongly recommended in production | Signs session tokens; insecure default is baked in for local dev only |
| `JWT_EXPIRE_DAYS` | No | Access token lifetime (default `7`) |

**Frontend** (`frontend/.env.local`, gitignored):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Default `http://localhost:8000` |

`load_dotenv()` runs from `app.main` and from `classifier.py`; run the backend **from the `backend/` directory** so `backend/.env` is discovered reliably.

---

## 5. Backend: install and run

```bash
cd backend
cp .env.example .env
# Edit .env: set GEMINI_API_KEY at minimum. Never commit .env.

uv venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
uv pip install -e .
uvicorn app.main:app --reload --port 8000
```

- API base: `http://127.0.0.1:8000`
- Interactive OpenAPI: `http://127.0.0.1:8000/docs`
- Health: `GET /health`
- Optional Gemini connectivity: `GET /api/test-gemini` (uses your API key)

**Database file location:** With the default `DATABASE_URL`, SQLite creates `contexthaus.db` in the **current working directory** (typically `backend/`). `*.db` is gitignored.

---

## 6. Frontend: install and run

```bash
cd frontend
npm install
# Optional: cp .env.example .env.local && edit for custom API URL
npm run dev
```

App: `http://localhost:3000`. The UI calls `NEXT_PUBLIC_API_URL` or `http://localhost:8000`.

**Production build (sanity check):**

```bash
cd frontend
npm run build
npm run start
```

---

## 7. API surface (summary)

Full schemas: OpenAPI at `/docs` on the running backend.

| Method | Path | Description |
|--------|------|---------------|
| GET | `/health` | Liveness (no auth) |
| POST | `/api/auth/bootstrap` | First-run only: create organization + first admin, returns JWT |
| POST | `/api/auth/login` | Email/password login, returns JWT |
| GET | `/api/auth/me` | Current user profile (requires `Authorization: Bearer`) |
| GET | `/api/users/` | List org users (**admin** only) |
| POST | `/api/users/` | Create user (**admin** only) |
| PATCH | `/api/users/{id}` | Update user (**admin** only) |
| PUT | `/api/users/{id}/assignments` | Set contractor property IDs (**admin** only) |
| GET | `/api/audit/` | Audit log (**admin** or **auditor**) |
| GET | `/api/properties/` | List properties |
| POST | `/api/properties/` | Create property |
| GET | `/api/properties/{id}` | Property detail + `context_md` |
| DELETE | `/api/properties/{id}` | Delete property |
| POST | `/api/ingest/{id}/source` | Multipart ingest (file) |
| GET | `/api/ingest/{id}/context` | Raw `PROPERTY.md` |
| POST | `/api/analytics/events` | Client analytics (204) |
| GET/POST | `/api/vendors/...` | Vendor CRUD, availability, bookings, recommendations, communications, auto-dispatch |

---

## 8. Testing

### Frontend (E2E)

```bash
cd frontend
npm install
npx playwright install   # first time only
npm run test:e2e
```

UI mode: `npm run test:e2e:ui`.

### Backend

From `backend/` with Python 3.11+:

```bash
pip install -e ".[dev]"   # or: uv pip install -e ".[dev]"
pytest -q
```

The default suite includes a **health endpoint smoke test** that does not call Gemini or external APIs. Expand coverage per [`ENTERPRISE-SOURCE-OF-TRUTH.md`](ENTERPRISE-SOURCE-OF-TRUTH.md) Phase 2 (parser, patcher, ingest contracts).

**Manual smoke** (any environment):

1. `GET /health` → 200  
2. `GET /api/properties/` → 200  
3. Create property + ingest sample file via UI or `POST /api/ingest/{id}/source`

---

## 9. Security and secrets

- **Git:** `.gitignore` excludes `.env`, `.env.local`, `.venv`, `node_modules`, `*.db`.
- **CI:** inject secrets via environment or OIDC to cloud secret managers; never echo keys in logs.
- **CORS:** `main.py` allows local dev origins only; production must set explicit `allow_origins` from configuration.
- **Uploads:** Treat all uploads as untrusted; size limits and safe decoding are enforced in application code—keep them reviewed when changing ingest.

---

## 10. Production notes (high level)

- Run FastAPI behind HTTPS (reverse proxy), with Uvicorn/Gunicorn workers as appropriate.
- Use a managed database (e.g. Postgres) for multi-worker writes; migrate off SQLite before horizontal scale.
- Store API keys in a vault (GCP Secret Manager, AWS Secrets Manager, Doppler, etc.).
- Enable structured logging and request IDs; correlate with ingest run IDs when Phase 3 audit tables exist.

---

## 11. Troubleshooting

| Symptom | Check |
|---------|--------|
| Frontend cannot reach API | `NEXT_PUBLIC_API_URL`, browser console, CORS origins in `main.py` |
| Gemini errors | `GEMINI_API_KEY`, quota, model availability in region |
| DB not found / wrong path | `DATABASE_URL`, CWD when launching `uvicorn` |
| Classifier always “relevant” | Missing `PIONEER_API_KEY` (by design fallback) |

---

## 12. Revision history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-04-26 | Initial consolidated technical document. |
| 1.1 | 2026-04-26 | Documented backend pytest baseline and install command. |
