# Deploy apps/server to Railway (+ wire web)

## Context

The web app is live on Netlify but the Hono backend (`apps/server`) has never been deployed — it only runs locally, so the deployed frontend has no real API. We're deploying the server to **Railway** and wiring the Netlify web app to it end-to-end.

Railway was chosen (over Render/Fly/serverless) because the server has two hard constraints that rule out serverless and multi-instance hosting:
1. **SSE progress stream** needs long-lived HTTP connections (serverless timeouts break it).
2. **In-memory, per-process progress bus** (`apps/server/src/api/services/progress.ts`) assumes a **single always-on instance** — agents run inline in that process and clients read events from its memory. Scale-to-zero loses events; multiple replicas fragment the stream (would need Redis pub/sub fan-out we haven't built).

So the deploy must be **one replica, never sleeping**. Intended outcome: `https://<railway-app>` serves the API, the Netlify site talks to it with correct CORS, and the live flow (auth → agents → SSE) works against the deployed server.

Decisions (confirmed): CLI-guided Railway setup (user runs `railway login`, I drive the rest with approvals); scope includes web wiring (Netlify env + CORS + redeploy + smoke test); config-as-code via `railway.json`. Web stays on Netlify.

## Grounding facts (verified in worktree)

- Build: `apps/server` uses `tsdown` → `dist/index.mjs` (ESM), `noExternal: [/@Polyedro-abs\/.*/]`; workspace `@Polyedro-abs/env` exports **TS source**, so `pnpm --filter server build` needs no pre-built packages. External deps stay in `node_modules` at runtime.
- Start: `node dist/index.mjs`; server reads `process.env.PORT` (Railway injects it) — no change needed.
- Env validation (`packages/env/src/server.ts`, `@t3-oss/env-core`) runs at **runtime boot**, not build. Required: `CORS_ORIGIN` (url), `DATABASE_URL` (postgresql://), `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Optional: `DIRECT_URL`, `OPENAI_API_KEY`, image-provider keys, `NODE_ENV`. Missing required var → boot crash.
- Health: `GET /` → `"OK"` (cheap; use for healthcheck). `GET /health/db` runs a DB query (don't use per-probe).
- Netlify (`netlify.toml`): `base = "apps/web"`, build command already injects `NEXT_PUBLIC_SERVER_URL` from env with a localhost fallback → pointing web at Railway is **just a Netlify env var**, no file change. Node 22 there — match on Railway.
- Netlify prod URL assumed `https://polyedro-ads.netlify.app` (confirm during impl) → becomes `CORS_ORIGIN` on Railway.

## Tasks

1. **Save spec documentation** — `agent-os/specs/<ts>-railway-deploy-server/` with plan.md, shape.md, references.md, standards.md (none defined). Commit `docs(specs): shape spec for Railway server deploy`.

2. **Repo config-as-code** (branch `feature/railway-deploy`):
   - `railway.json` at repo root:
     ```json
     {
       "$schema": "https://railway.com/railway.schema.json",
       "build": { "builder": "NIXPACKS", "buildCommand": "pnpm install --frozen-lockfile && pnpm --filter server build" },
       "deploy": { "startCommand": "pnpm --filter server start", "healthcheckPath": "/", "healthcheckTimeout": 100, "restartPolicyType": "ON_FAILURE", "numReplicas": 1, "sleepApplication": false }
     }
     ```
   - Pin Node 22 for Nixpacks: add root `.nvmrc` (`22`); verify root `package.json` has `packageManager: pnpm@…` (add if missing).
   - `README.md` / `apps/server/.env.example`: document the Railway env vars and the single-instance constraint.
   - Locally validate the exact build+start before committing: `pnpm install --frozen-lockfile && pnpm --filter server build` then boot `dist/index.mjs` with `SKIP_ENV_VALIDATION` or a throwaway env to confirm it serves `/`.

3. **Railway setup (CLI-guided)** — user runs `! railway login`; then I drive with approvals:
   - `railway init` (or link existing project), create service from repo.
   - Push env vars **without exposing secrets to me**: a bash loop reads `apps/server/.env` line-by-line and calls `railway variables --set "K=V"` per non-comment line (values never printed), then override `CORS_ORIGIN` to the Netlify prod URL and set `NODE_ENV=production`. (PORT is injected by Railway — don't set it.)
   - `railway up` / trigger deploy from the branch; watch logs to a healthy boot on `/`.

4. **Wire web → server**:
   - Set `NEXT_PUBLIC_SERVER_URL=https://<railway-app>` in Netlify (Site settings → Environment variables) — no repo change (netlify.toml already reads it).
   - Confirm `CORS_ORIGIN` on Railway == the Netlify prod origin.
   - Redeploy web per workflow: `git pull origin main && git push netlify main` (or trigger Netlify build so the new env var is baked in).

5. **Verify end-to-end** (against live Railway URL):
   - `curl https://<railway>/` → OK; `curl /health/db` → `{db:"ok"}`.
   - Supabase token for e2e user → `curl` SSE stream + `POST …/agents/strategy` → confirm event sequence on the deployed instance.
   - CORS preflight from the Netlify origin: `curl -H "Origin: https://polyedro-ads.netlify.app" -I …` → `access-control-allow-origin` matches.
   - Load the Netlify site, confirm it hits the Railway API (network tab / an authenticated call) with no CORS errors. Note: live SSE *in the UI* isn't wired yet (that's the GenliveView/CampaignView task) — verify API reachability + CORS here, not in-UI streaming.

6. **Ship** — PR for the repo changes (railway.json, .nvmrc, docs, spec) to org main: `feat(deploy): Railway config-as-code for apps/server`.

## Verification

- Build parity: the Railway build command succeeds locally in the worktree; `dist/index.mjs` boots and serves `/`.
- Deployed: health endpoints green; a full agent run over SSE works against the Railway URL; CORS allows the Netlify origin.
- Web: Netlify build picks up `NEXT_PUBLIC_SERVER_URL`; deployed site reaches the API.
- Single-instance guarantee: Railway service shows 1 replica, sleep disabled.
