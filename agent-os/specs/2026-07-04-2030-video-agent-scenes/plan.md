# Video Agent: guion por escenas

## Context

Next unimplemented text agent after Strategy and Meta Ads. The database already has `video_scripts` with `language`, `title`, `scenes jsonb`, and `durationSeconds`; the current behavior is limited to demo seed content and a hardcoded `video_script` branch inside `regenerateAsset`.

The requested feature is to generate `video_scripts` with scene objects:

- `sceneNumber`
- `description`
- `dialogue`
- `durationSeconds`

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-07-04-2030-video-agent-scenes/` with:

- `plan.md`
- `shape.md`
- `references.md`
- `standards.md`

## Task 2: Add `apps/server/src/api/services/video-agent.ts`

Implement a server-side Video Agent service following the Strategy/Meta Ads pattern:

- Strict Zod schema for `{ title, scenes, durationSeconds }`.
- `scenes` is an ordered array of 3-5 objects with all fields required: `sceneNumber`, `description`, `dialogue`, `durationSeconds`.
- Context loader fetches campaign, brand, brand kit, strategy, ad copies, and creative assets.
- Prompt asks for a short vertical Meta/Reels-ready script in Latin American Spanish.
- Fallback content uses campaign/brand context and produces valid scenes.
- `runVideoAgent(campaignId)` upserts the Spanish campaign script to `generating`, generates content, updates to `review`, marks the campaign `review`, emits progress lifecycle events, and returns `{ script, generation }`.
- `regenerateVideoScript(campaignId, scriptId)` validates the row belongs to the campaign and re-runs the agent.

## Task 3: Wire Routes And Regenerate Flow

- Add `POST /api/campaigns/:campaignId/agents/video` in `apps/server/src/api/routes/campaign.ts`.
- Import and call `runVideoAgent`.
- Replace the hardcoded `video_script` branch in `regenerateAsset` with `regenerateVideoScript`.
- Preserve existing `voiceover` behavior.

## Task 4: Progress Events

- Extend `ProgressAgent` to include `video`.
- Emit `agent_started`, `asset_updated(generating)`, `agent_log`, `asset_updated(review)`, and `agent_completed`.
- On hard DB failure, revert the script to `draft` and emit failure.

## Task 5: Verify

Run:

- `pnpm --filter server check-types`
- `pnpm --filter server build`

Delta-scoped smoke scope:

- New endpoint `POST /campaigns/:campaignId/agents/video`.
- Existing `/campaigns/:campaignId/regenerate` for `target: "video_script"`.
- Dashboard `agents.videoScripts` shape and readiness behavior.
- Progress event agent typing for the new `video` lifecycle.

## Task 6: Commit

Use Conventional Commits:

- `docs(specs): shape spec for video agent scenes`
- `feat(server): add video script agent`
