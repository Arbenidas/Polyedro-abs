# Meta Ads Agent — Shaping Notes

## Scope

Agent in `apps/server` that generates `ad_copies` (headline, primaryText, description, callToAction) in ES and EN with A/B variants (4 rows per campaign, upserted by `campaignId + language + variant`), lifecycle `draft → generating → review`, grounded in the campaign's strategy and brand kit. Exposed via `POST /api/campaigns/:campaignId/agents/meta-ads`; the `regenerate` `ad_copy` target uses the real agent.

## Decisions

- **Explicit trigger only** (no auto-run on campaign creation — that already runs the Strategy Agent inline, and copies benefit from the strategy existing first).
- **Full 2×2 matrix per run** (ES/EN × A/B); variant A benefit-led, variant B urgency/offer-led.
- **Single structured LLM call for the whole matrix** (cheaper, deliberate A/B differentiation, ES/EN equivalence); per-copy call for single-row regenerate.
- Regenerate wired to the real agent — also fixes the old stub never filling `callToAction`.
- `callToAction` column already exists (`call_to_action` text, migrated) — **no migration**. No new deps/env; reuses `services/ai.ts` with fallback-first semantics.

## Context

- **Visuals:** None (backend-only).
- **References:** `services/strategy-agent.ts` (skeleton), `services/creative.ts` (multi-row upsert + campaign roll-up), `services/campaign.ts` seed `upsertDemoAdCopy` (upsert key + fallback copy basis), `docs/features.md` F4.3.
- **Product alignment:** Buildathon flow step 4 ("copies en español e inglés", "variantes A/B").

## Standards Applied

Omitted per user instruction — `agent-os/standards/index.yml` is empty.
