# Conectar GenliveView y CampaignView al backend - Shaping Notes

## Scope

Connect the labs live-generation and campaign review screens to the real campaign backend. Replace the simulated generation timers with actual campaign creation, agent API calls, SSE/polling progress events, dashboard fetches, approval/regeneration actions, and Meta Ads export.

## Decisions

- Use the existing `useCampaignProgress(campaignId)` hook instead of adding another SSE consumer.
- Keep server contracts stable unless the frontend uncovers a missing primitive.
- Use `POST /api/campaigns` to create the campaign and trigger Strategy Agent inline, then call existing `POST /agents/meta-ads` and `POST /agents/creative` endpoints.
- Reflect backend data in `CampaignView`; assets that do not exist in the dashboard remain `draft` instead of being simulated.
- Approval, regeneration, and export must call the existing real API endpoints and refresh from `GET /dashboard`.
- Supabase changes are limited to existing auth/session usage from `apiFetch`; no schema migration is planned.

## Context

- **Visuals:** None provided.
- **References:** Existing labs UI, campaign API routes/services, `useCampaignProgress`, and PR #15 SSE memory.
- **Product alignment:** N/A (no `agent-os/product/` folder).

## Standards Applied

None. `agent-os/standards/index.yml` contains no standards entries.
