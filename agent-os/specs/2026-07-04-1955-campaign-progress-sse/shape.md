# Campaign Progress SSE — Shaping Notes

## Scope

Per-campaign progress stream from the Hono server: `GET /api/campaigns/:campaignId/progress/stream` (SSE) emitting `agent_started` / `agent_log` / `agent_completed` / `asset_updated` events while the campaign's agents run, plus `GET /api/campaigns/:campaignId/progress` as a polling fallback.

Scope amendment (post-shaping, user request): also ship the client consumption primitive — `useCampaignProgress` in `apps/web/src/lib/use-campaign-progress.ts`, built on `event-source-plus` (fetch-based SSE that can send the Bearer header, auto `Last-Event-ID` replay on reconnect) with automatic fallback to polling after 3 consecutive stream failures. Wiring it into the labs campaign UI (today fully timer-simulated) stays out of scope for a later PR.

## Decisions

- **In-memory, per-process event bus.** Agents run inline in the same server process (single instance), so no external broker is needed. Per-campaign ring buffer (200 events) with monotonic ids enables SSE reconnection via `Last-Event-ID` and cursor-based polling via `?after=<id>`.
- **Auth unchanged.** Both routes sit behind `requireAuth` (Bearer JWT). Native `EventSource` can't send headers, so the future web client must consume the stream with `fetch` + ReadableStream — or use the polling endpoint. No token-in-query-param auth was added.
- **Emitters: agents + approve/regenerate.** Strategy, Creative and Meta Ads agents emit the full lifecycle (started → asset generating → logs → asset review → completed, with `failed` + draft-revert emits on the existing rollback paths). `approveAsset` and the video/voiceover regenerate stubs also emit `asset_updated` so the dashboard stays live.
- **Event shape:** `{ id, type, campaignId, timestamp, data }`; `data.agent` is `strategy | creative | meta_ads`; `asset_updated` data mirrors the approve/regenerate `target` union plus `id`/`status` (and variant/language/imageUrl where relevant).
- **Heartbeat:** `ping` event every 15s to survive proxy idle timeouts.
- The progress service duplicates the `AssetTarget` union locally to avoid an import cycle (campaign service imports progress).

## Context

- **Visuals:** None
- **References:** See references.md — existing agent services pattern and campaign routes.
- **Product alignment:** N/A (no agent-os/product folder).

## Standards Applied

None — `agent-os/standards/` has no standards defined yet (skipped by agreement).
