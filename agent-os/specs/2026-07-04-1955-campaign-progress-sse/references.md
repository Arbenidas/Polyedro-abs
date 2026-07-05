# References for Campaign Progress SSE

## Similar Implementations

### Agent services pattern

- **Location:** `apps/server/src/api/services/strategy-agent.ts`, `apps/server/src/api/services/creative.ts`, `apps/server/src/api/services/meta-ads-agent.ts`
- **Relevance:** These are the flows being instrumented; each already has explicit lifecycle checkpoints (upsert → `generating`, generate content, update → `review`, rollback → `draft`).
- **Key patterns:** Status transitions per row, provider fallback (`openai`/`fal` → template/placeholder), rollback in `catch` — progress events attach exactly at these points.

### Campaign routes + shared helpers

- **Location:** `apps/server/src/api/routes/campaign.ts`, `apps/server/src/api/shared.ts`, `apps/server/src/api/services/campaign.ts`
- **Relevance:** New routes follow the same shape: `parseUuidParam`, `ApiError` 404s (via `requireCampaign`, newly exported), routes mounted under `/api` behind `requireAuth`.

### Auth middleware

- **Location:** `apps/server/src/middleware/auth.ts`
- **Relevance:** Explains the SSE client constraint — Bearer-header-only auth means `EventSource` can't connect natively; documented in the stream route comment.

### Hono SSE helper

- **Location:** `hono/streaming` (`streamSSE`), hono ^4.8.2 already in `apps/server/package.json`
- **Key patterns:** `stream.writeSSE({ id, event, data })`, `stream.onAbort` for listener cleanup, `stream.sleep` for the heartbeat race.
