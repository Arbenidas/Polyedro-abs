# References for Railway Server Deploy

## Existing deploy config

### Netlify web deploy
- **Location:** `netlify.toml`
- **Relevance:** The pattern for the other half of the stack. `base = "apps/web"`, and the build command already threads `NEXT_PUBLIC_SERVER_URL` from an env var with a localhost fallback — so pointing web at Railway is just a Netlify env var, no file change. Node 22 set here → match on Railway.

## Server runtime contract

### Env validation
- **Location:** `packages/env/src/server.ts` (`@t3-oss/env-core`)
- **Relevance:** Defines exactly which env vars the server needs and which are required vs optional. Validated at boot; a missing required var crashes startup. `SKIP_ENV_VALIDATION` bypasses (used only for a local build smoke test).

### Entry point & health
- **Location:** `apps/server/src/index.ts`
- **Key patterns:** `serve({ fetch: app.fetch, port: process.env.PORT || 3000 })` — already reads Railway's injected `PORT`. `GET /` → `"OK"` (healthcheck target). `GET /health/db` runs `select 1` (not used for probes). CORS via `env.CORS_ORIGIN`.

### Build
- **Location:** `apps/server/tsdown.config.ts`, `apps/server/package.json`
- **Key patterns:** `tsdown` bundles `./src/index.ts` → ESM `dist/index.mjs`, `noExternal` for `@Polyedro-abs/*` (which export TS source, so no pre-build of workspace packages). `start` = `node dist/index.mjs`. Validated locally: `pnpm install --frozen-lockfile && pnpm --filter server build` then boot serves `/` → 200.

## State constraint

### In-memory progress bus
- **Location:** `apps/server/src/api/services/progress.ts`
- **Relevance:** The reason the deploy must be single-instance and never sleep. See sse-progress spec (`agent-os/specs/2026-07-04-1955-campaign-progress-sse/`).
