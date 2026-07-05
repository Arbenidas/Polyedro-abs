# Plan - Conectar GenliveView y CampaignView al backend

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-07-04-2221-conectar-genlive-campaign-backend/` with:

- `plan.md` - this plan
- `shape.md` - scope, decisions, and context
- `references.md` - reference implementations studied
- `standards.md` - empty standards note

## Task 2: Add typed campaign API helpers

- Add web client types for campaign dashboard, assets, progress, action targets, and export response.
- Add helpers for create campaign, get dashboard, run agents, approve asset, regenerate asset, and export campaign.
- Reuse `apiFetch` so Supabase auth remains centralized.

## Task 3: Wire live generation to real backend

- Replace `runIdx` timer orchestration in `deployAgents` with real campaign creation and agent endpoint calls.
- Store the real campaign id and dashboard in labs state.
- Subscribe to `useCampaignProgress(campaignId)` and derive live step status from SSE/polling events.
- Route to campaign review after real agent calls settle and dashboard data is loaded.

## Task 4: Wire campaign review to dashboard data

- Derive card statuses and content from `GET /campaigns/:id/dashboard`.
- Call approve/regenerate endpoints with real asset ids/targets.
- Refresh dashboard after mutations and handle missing assets as draft/unavailable.
- Call real Meta Ads export endpoint instead of setting local pushed state only.

## Task 5: Verify the PR delta

- Run type checks for touched web code.
- Smoke only the changed flow surfaces: new campaign deploy, live generation status, campaign dashboard rendering, approve/regenerate/export action paths as far as local env supports.
