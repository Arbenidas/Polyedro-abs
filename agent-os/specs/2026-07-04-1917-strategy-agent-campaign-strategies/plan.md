# Strategy Agent: generación de campaign_strategies

## Context

Next agent in the Polyedro /abs roadmap: the Strategy Agent fills `campaign_strategies` (audience profile, Meta Ads segmentation, commercial angle, notes) with real LLM content. Today the table is only populated by the demo seed and a hardcoded `regenerateAsset` stub; `strategy` is one of the six readiness blocks, `commercialAngle` is consumed by the Creative Agent's prompt, and the full strategy row flows into the Meta Ads export payload — so this closes a real gap in the campaign flow.

Shaping decisions (confirmed with user):
- **Runs on campaign creation** (`POST /api/campaigns` auto-generates the strategy — matches the Buildathon flow) **plus an explicit trigger** `POST /api/campaigns/:campaignId/agents/strategy` (mirrors the Creative Agent).
- **Regenerate wired**: `regenerateAsset`'s `strategy` branch calls the real agent instead of hardcoded strings (like `creative_asset` already does).
- **Reuses `services/ai.ts`** (OpenAI via Vercel AI SDK, `generateStructuredObject`) — no new deps, no new env vars. Fallback-first: without `OPENAI_API_KEY` or on any LLM error, parameterized template content (adapted from the seed strategy) is used; campaign creation never fails. `generation.provider: "openai" | "fallback"` in responses.
- No visuals (backend-only). Standards omitted (index empty). Consistency note: campaign routes have no user scoping today — the new route follows the existing convention (no ownership check), consistent with the creative trigger.

Work in worktree `../Polyedro-abs-strategy-agent`, branch `feature/strategy-agent` (already created at current main `7fab745`).

## Task 1: Save spec documentation

`agent-os/specs/2026-07-04-1917-strategy-agent-campaign-strategies/` with `plan.md` (this plan), `shape.md` (scope + decisions above), `references.md` (brand-agent.ts / ai.ts / creative.ts / campaign.ts touchpoints), `standards.md` (omitted note). No visuals/.

## Task 2: Strategy Agent — `apps/server/src/api/services/strategy-agent.ts`

New service mirroring `brand-agent.ts` (schema-first, fallback, never-throw content generation) and `creative.ts` (context loading, campaign roll-up):

- **zod schema** `strategyContentSchema` (`z.strictObject`, **all fields required**, no `.optional()` — OpenAI strict mode; superset of the DB `$type`s so still assignable):
  - `audience: { description: string, ageRange: string, locations: string[], interests: string[] }` (mirrors `AudienceProfile`, schema/index.ts:80)
  - `segmentation: { ageMin: number, ageMax: number, genders: string[], locations: string[], interests: string[], placements: string[] }` (mirrors `MetaAdsSegmentation`, schema/index.ts:87 — keep shape stable: it feeds `buildMetaAdsPayload`)
  - `commercialAngle: string` (consumed by Creative Agent prompt — must stay meaningful)
  - `notes: string`
- **`loadStrategyContext(campaignId)`**: `db.query.campaigns.findFirst({ with: { brand: { with: { brandKit: true } }, strategy: true } })` (same query as `loadCreativeContext`, creative.ts:33-64) → `ApiError(404, "Campaign not found")`. Context: campaign name/objective, brand name/description/industry, brandKit buyerPersona/valueProposition/keyMessages/toneOfVoice.
- **`buildFallbackContent(ctx)`**: the seed strategy content (campaign.ts:700-737) parameterized with brand/campaign fields (audience description from objective + persona, LATAM defaults, placements Reels/Feed/Stories).
- **`generateStrategyContent(ctx)`** — never throws: `isLlmConfigured()` gate → `generateStructuredObject` with system prompt (senior Meta Ads media buyer + strategist for LATAM SMBs; audience grounded in the brand's buyer persona; segmentation with realistic ages/interests/placements for Meta; one sharp commercial angle ≤ 1 sentence; notes = budget/funnel guidance) and user prompt carrying the context; zod-validated; on any error log + fallback. Returns `{ content, provider }`.
- **`runStrategyAgent(campaignId)`**: load context → upsert strategy to `generating` (update by unique `campaignId` if exists, else insert — same upsert shape as `runBrandAgent`) → generate → update `{ status: "review", ...content }` → set campaign `status: "review"` (mirrors `runCreativeAgent`, creative.ts:228) → return `{ strategy, generation: { triggered, agent: "Strategy Agent", provider, status, steps } }`. try/catch reverts strategy to `draft` and rethrows on hard (DB) failure.
- **`regenerateStrategy(campaignId, strategyId)`**: validates the strategy row belongs to the campaign (404 like current branch), then re-runs generation on it (mirrors `regenerateCreativeAsset`, creative.ts:234-251).

## Task 3: Wire into campaign flow

- `apps/server/src/api/routes/campaign.ts`: add `campaignRoutes.post("/campaigns/:campaignId/agents/strategy", ...)` → `parseUuidParam` + `runStrategyAgent` → `c.json(result, 201)` (exact clone of the creative route at campaign.ts:54-59).
- `apps/server/src/api/services/campaign.ts`:
  - `createCampaign` (campaign.ts:135-159): after inserting the campaign, call `runStrategyAgent(campaign.id)` and return `{ campaign, strategy, generation }` (campaign row re-read or status patched to `review` in the response). Latency note: create now includes one LLM call (~5-15s) — acceptable, same trade-off as brand creation.
  - `regenerateAsset` strategy branch (campaign.ts:387-407): replace the hardcoded update with `await regenerateStrategy(campaignId, input.id)` (keep the 404 semantics inside the helper; the switch keeps forcing campaign `review` afterward as today).
- Import direction (no cycles): `campaign.ts → strategy-agent.ts → ai.ts`; `strategy-agent.ts` does NOT import `campaign.ts` (it re-implements the tiny campaign-status update inline, like creative.ts does).

## Task 4: Verify (delta-scoped smoke test, per convention)

- `pnpm --filter server exec tsc --noEmit` + build.
- Run server from the worktree (`.env` needs copying again — ask user: `! cp apps/server/.env ../Polyedro-abs-strategy-agent/apps/server/.env`).
- **New behavior**: `POST /api/campaigns` (against a real brand) → 201 with strategy `review`, `provider: "openai"`, audience/segmentation grounded in the brand kit; trigger endpoint re-runs (201); regenerate with `target: "strategy"` produces fresh LLM content and forces campaign `review`; fallback instance (`OPENAI_API_KEY="" PORT=3002`) → `provider: "fallback"` template content. Edge: bad uuid 400, nonexistent campaign 404, unauth 401, concurrent trigger calls both land `review`.
- **Touched pre-existing surfaces**: `POST /api/campaigns` contract (adds fields — verify existing `{ campaign }` key intact), `regenerateAsset` other targets untouched (spot-check `ad_copy` regenerate still 200), approve `strategy` target still works, dashboard `agents.strategy` + `progress` blocks correct, creative agent still reads `commercialAngle` (run creative after strategy on the test campaign).
- DB assertions via Supabase MCP; delete test campaign/brand after; then conventional commits + PR to org repo.
