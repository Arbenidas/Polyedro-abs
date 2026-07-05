# Video Agent: guion por escenas — Shaping Notes

## Scope

Build the Video Agent in `apps/server` to generate `video_scripts` rows with scene-based JSON content:
`sceneNumber`, `description`, `dialogue`, and `durationSeconds`.

The agent should create or refresh the campaign's Spanish video script, grounded in the campaign strategy, brand kit, ad copies, and visual assets when available.

## Decisions

- Use the existing `video_scripts` table and `scenes jsonb`; no migration is needed.
- Add an explicit trigger endpoint: `POST /api/campaigns/:campaignId/agents/video`.
- Generate one Spanish script per campaign for now, matching the current demo and voiceover path.
- Use `services/ai.ts` with strict structured output and a fallback template when OpenAI is not configured or fails.
- Replace the hardcoded `video_script` regenerate stub with a real `regenerateVideoScript` flow.
- Emit progress events with agent key `video`, preserving the existing SSE/polling lifecycle.
- Keep ownership enforcement in routes, using the existing campaign route guard.

## Context

- **Visuals:** None.
- **References:** `strategy-agent.ts`, `meta-ads-agent.ts`, `creative.ts`, `campaign.ts`, `schema/index.ts`, `docs/data-model.md`.
- **Product alignment:** `docs/features.md` describes generated assets transitioning `generating → review`; `docs/data-model.md` already models scenes for the Video Agent.

## Standards Applied

- No standards files apply; `agent-os/standards/index.yml` is empty.
