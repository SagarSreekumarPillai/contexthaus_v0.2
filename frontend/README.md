# ContextHaus frontend

Next.js application for the ContextHaus property context UI.

## Where to start

1. **Root [`README.md`](../README.md)** — product overview, full stack setup, and verification steps.
2. **[`docs/TECHNICAL.md`](../docs/TECHNICAL.md)** — environment variables, API base URL (`NEXT_PUBLIC_API_URL`), Playwright tests, and troubleshooting.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run build      # production build
npm run test:e2e   # Playwright
```

Copy [`./.env.example`](./.env.example) to `.env.local` if the backend is not at `http://localhost:8000`. Do not commit `.env.local`.
