# Railway Server Deploy — Shaping Notes

## Scope

Deploy `apps/server` (Hono Node backend) to Railway and wire the Netlify web app to it end-to-end. Web stays on Netlify; only the server is newly deployed. Config-as-code (`railway.json`) lives in the repo; Railway account/project/secrets are set up via the Railway CLI.

## Decisions

- **Railway** over Render/Fly/serverless. Forced by two server constraints:
  1. The SSE progress stream needs long-lived HTTP connections — serverless execution timeouts break it.
  2. The progress bus (`apps/server/src/api/services/progress.ts`) is **in-memory and per-process**; agents run inline in that process and clients read events from its memory. Scale-to-zero loses events; multiple replicas fragment the stream (would need a Redis pub/sub fan-out that isn't built).
- Therefore: **one replica, sleep disabled** (`numReplicas: 1`, `sleepApplication: false`). Documented that horizontal scaling requires Redis fan-out first.
- **CLI-guided** setup: user runs `railway login`; the rest is driven from the session with approvals. Secrets are pushed by a bash loop over `apps/server/.env` so values never enter the assistant's context.
- **Web wiring included**: set `NEXT_PUBLIC_SERVER_URL` in Netlify (no file change — `netlify.toml` already reads it), set Railway `CORS_ORIGIN` to the Netlify prod origin, redeploy web, smoke test.
- Healthcheck on `GET /` (cheap `"OK"`), not `/health/db` (runs a DB query per probe).
- Node 22 pinned via root `.nvmrc` to match Netlify.

## Context

- **Visuals:** None
- **References:** `netlify.toml` (existing deploy config for web), `packages/env/src/server.ts` (runtime env contract), `apps/server/src/index.ts` (entry/health), `apps/server/tsdown.config.ts` (build). See references.md.
- **Product alignment:** N/A (no agent-os/product folder).

## Standards Applied

None — `agent-os/standards/` has no standards defined yet.
