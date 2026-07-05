# Campaign Progress SSE Endpoint (+ polling fallback)

## Context

The web dashboard currently has no way to show live agent progress while a campaign's agents (Strategy, Creative, Meta Ads) run — the agents execute inline in POST requests and the client only sees the final response. This feature adds a per-campaign progress stream from Hono with events `agent_started` / `agent_log` / `agent_completed` / `asset_updated`, plus a polling fallback for clients that can't hold an SSE connection.

Shaping decisions (confirmed with user):
- **Scope: server only.** The apps/web hook/UI ships in a later PR. Note for that PR: native `EventSource` can't send the `Authorization: Bearer` header the API requires, so the client must consume SSE via `fetch` + ReadableStream, or use the polling endpoint.
- **Emitters: agents + approve/regenerate.** The three agent services emit lifecycle events; `approveAsset` and the video/voiceover regenerate stubs also emit `asset_updated` so the dashboard stays live.
- No visuals; references are the existing agent services pattern.
- Standards steps skipped — `agent-os/standards/` is empty.

Work happens in the worktree `../Polyedro-abs-sse-progress` (branch `feature/sse-progress`, created from latest main at PR #14). **A large part of the implementation below is already drafted in that worktree** — the remaining work is the campaign-service emits, typecheck, smoke test, and PR.

## Design

### New service: `apps/server/src/api/services/progress.ts` (done in worktree)

In-memory, per-process event bus — sufficient because agents run inline in this same server process (single instance).

- `ProgressEvent = { id, type, campaignId, timestamp, data }` with per-campaign monotonic `id`.
- Per-campaign channel: ring buffer (last 200 events) + listener set; channel count capped at 100 (prunes most-inactive listenerless channel).
- API: `subscribeToProgress(campaignId, listener) → unsubscribe`, `getProgressEvents(campaignId, after)`, `getLastProgressEventId(campaignId)`, and typed emit helpers: `emitAgentStarted`, `emitAgentLog`, `emitAgentCompleted(outcome: succeeded|failed)`, `emitAssetUpdated({target, id, status, ...})`.
- Duplicates the `AssetTarget` union locally to avoid an import cycle (campaign service imports progress).

### Routes: `apps/server/src/api/routes/campaign.ts` (done in worktree)

Both routes 404 on unknown campaigns via `requireCampaign` (newly exported from `services/campaign.ts`). Auth is unchanged — routes sit behind `requireAuth` like the rest of `/api`.

- `GET /api/campaigns/:campaignId/progress` — polling fallback. `?after=<id>` cursor; returns `{ events, lastEventId }`.
- `GET /api/campaigns/:campaignId/progress/stream` — SSE via `streamSSE` (hono/streaming, already in hono 4.8). Replays buffered events from `Last-Event-ID` header (or `?lastEventId`/`?after`), then streams live events (event name = event type, `id` = event id, data = JSON event). Heartbeat `ping` every 15s to survive proxy idle timeouts; unsubscribes on abort.

### Agent instrumentation (done in worktree)

Pattern per agent — `strategy-agent.ts`, `creative.ts`, `meta-ads-agent.ts`:
- `agent_started` after context load; `asset_updated` on each row → `generating`; `agent_log` around LLM/image generation (includes provider); `asset_updated` on each row → `review` (creative includes `variant`, `imageUrl`; meta-ads includes `language`/`variant`); `agent_completed` `succeeded` with summary, or `failed` (+ rows reverted → `draft` emitted as `asset_updated`) on the existing rollback paths. Regenerate paths (`regenerateCreativeAsset`, creative variant path used by `regenerateStrategy`/`regenerateAdCopy` via re-run) emit the same lifecycle.

### Remaining implementation

1. `apps/server/src/api/services/campaign.ts`: emit `asset_updated` after the status update in `approveAsset` (status `approved`) and in the `video_script`/`voiceover` branches of `regenerateAsset` (status `review`).
2. Save agent-os spec docs (Task 1 below).

## Tasks

1. **Save spec documentation** — create `agent-os/specs/2026-07-04-1955-campaign-progress-sse/` with `plan.md` (this plan), `shape.md` (scope + decisions above), `references.md` (agent services + routes pattern), `standards.md` (note: none defined yet). Commit as `docs(specs): shape spec for campaign progress SSE`.
2. **Progress bus service** — `services/progress.ts` (already drafted; review once more).
3. **SSE + polling routes** — in `routes/campaign.ts` + export `requireCampaign` (already drafted).
4. **Agent emitters** — strategy/creative/meta-ads instrumentation (already drafted).
5. **Campaign service emitters** — `approveAsset` + video/voiceover regenerate stubs emit `asset_updated`.
6. **Verify** — `pnpm check-types` in apps/server; smoke test delta only: run the server, open the SSE stream with `curl -N -H "Authorization: Bearer <token>"` on the seeded demo campaign, trigger `POST .../agents/meta-ads` (fallback provider, no key needed) and confirm the event sequence; hit the polling endpoint with `?after` and confirm cursor behavior.
7. **Ship** — conventional commit (`feat(server): stream campaign progress over SSE with polling fallback`), push branch, open PR to org repo main.

## Verification

- Typecheck: `pnpm --filter server check-types`.
- E2E (delta-scoped): with `pnpm --filter server dev` running and a Supabase session token for the e2e test user: `curl -N .../progress/stream` in one shell, `POST /api/campaigns/:id/agents/meta-ads` in another → expect `agent_started` → 4× `asset_updated(generating)` → `agent_log` ×2 → 4× `asset_updated(review)` → `agent_completed(succeeded)`, then `ping` heartbeats. Then `GET .../progress` → same events; `GET .../progress?after=<lastEventId>` → empty list, cursor stable. Reconnect stream with `Last-Event-ID` → only newer events replayed.
