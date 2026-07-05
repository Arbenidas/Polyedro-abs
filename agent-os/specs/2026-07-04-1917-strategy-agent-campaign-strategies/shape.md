# Strategy Agent — Shaping Notes

## Scope

Agent in `apps/server` that fills `campaign_strategies` (audience profile, Meta Ads segmentation, commercial angle, notes) with LLM-generated content and the `draft → generating → review` lifecycle. Replaces the seed-only/hardcoded-stub reality: runs automatically on `POST /api/campaigns`, has an explicit trigger `POST /api/campaigns/:campaignId/agents/strategy`, and powers the `regenerate` `strategy` target.

## Decisions

- Auto-run on campaign creation **and** explicit trigger endpoint (user choice; matches Buildathon flow "user creates campaign → agents generate strategy").
- `regenerateAsset` strategy branch wired to the real agent (like `creative_asset`).
- Reuses `services/ai.ts` (OpenAI via Vercel AI SDK) — no new deps or env vars. Fallback-first: template content (parameterized from the demo seed strategy) on missing key or LLM failure; `generation.provider: "openai" | "fallback"`.
- Keep `segmentation` shape stable — it flows into the Meta Ads export payload. `commercialAngle` must be meaningful — the Creative Agent injects it into image prompts.
- Campaign routes remain without user scoping (existing convention; the known quirk is tracked separately).

## Context

- **Visuals:** None (backend-only).
- **References:** `services/brand-agent.ts` (agent pattern), `services/ai.ts` (LLM wrapper), `services/creative.ts` (context loader + campaign roll-up), `services/campaign.ts` (seed content, regenerate/approve branches, readiness blocks) — see `references.md`.
- **Product alignment:** Buildathon.md MVP flow step 4 ("Los agentes generan: estrategia de campaña, segmentación para Meta Ads…").

## Standards Applied

Omitted per user instruction — `agent-os/standards/index.yml` is empty.
