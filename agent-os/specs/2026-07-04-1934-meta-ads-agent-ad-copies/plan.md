# Meta Ads Agent: ad_copies ES/EN con variantes A/B

## Context

Next agent in the roadmap (docs/features.md F4.3, "por conectar"): generate `ad_copies` — headline, primaryText, description, callToAction — in Spanish and English with A/B variants. Today only the demo seed (2 variant-a rows) and a hardcoded `regenerateAsset` stub touch this table. The `ad_copy` readiness block requires **all** rows approved, and copies flow into the Meta Ads export payload.

Verified facts: `ad_copies` already has `callToAction` (nullable text — **no migration needed**), `language`/`variant` are pgEnums (`es|en`, `a|b`), no DB unique on the combo (app-level upsert like the seed does), and the web UI doesn't consume these fields yet.

Shaping decisions (confirmed with user):
- **Explicit trigger only**: `POST /api/campaigns/:campaignId/agents/meta-ads` (campaign creation already runs the Strategy Agent inline; copies benefit from the strategy existing first).
- **Full 2×2 matrix**: one run produces/refreshes 4 rows (ES/EN × A/B), upserted by `campaignId + language + variant`.
- Regenerate `ad_copy` target wired to the real agent (established pattern from the Strategy Agent; also fixes the current stub never filling `callToAction`).
- Reuses `services/ai.ts`; no new deps/env. Fallback-first (parameterized seed-style copy, extended with B variants). No visuals; standards omitted (index empty).

Design refinement vs a blind Creative-Agent clone: **one structured LLM call returns the whole matrix** (`{es: {a, b}, en: {a, b}}`) instead of 4 separate calls — cheaper/faster, and the model can differentiate A vs B deliberately (e.g. benefit-led vs urgency-led) while keeping ES/EN equivalent. Regenerating a single copy uses a smaller per-copy call.

Worktree `../Polyedro-abs-meta-ads-agent`, branch `feature/meta-ads-agent` (created at main `120548e`).

## Task 1: Save spec documentation

`agent-os/specs/2026-07-04-1934-meta-ads-agent-ad-copies/` with plan.md / shape.md / references.md / standards.md (omitted note).

## Task 2: `apps/server/src/api/services/meta-ads-agent.ts`

Clone the Strategy Agent skeleton with Creative-Agent row semantics:

- **Schemas** (strict, all-required): `adCopyContentSchema = z.strictObject({ headline, primaryText, description, callToAction })` (all strings); `adCopyMatrixSchema = z.strictObject({ es: z.strictObject({ a: adCopyContentSchema, b: adCopyContentSchema }), en: {...} })`.
- **`loadMetaAdsContext(campaignId)`**: same relational query as `loadCreativeContext` (campaign + brand + brandKit + strategy) → 404 "Campaign not found". Context: campaign name/objective, brand, brandKit (toneOfVoice, valueProposition, keyMessages, buyerPersona), strategy (commercialAngle, audience) — copies must be grounded in the strategy when it exists.
- **Prompts**: system = senior Meta Ads copywriter for LATAM SMBs; headline ≤ 40 chars-ish, primaryText 1-3 sentences, description ≤ 1 sentence, callToAction a short imperative (Meta-style: "Shop Now"/"Comprar ahora" etc.); ES natural LATAM Spanish, EN equivalent meaning not literal; **variant A = benefit-led, variant B = urgency/offer-led**; grounded in commercial angle + tone of voice.
- **`buildFallbackMatrix(ctx)`**: seed-style copy parameterized by brand/campaign, with distinct B variants.
- **`generateAdCopyMatrix(ctx)`** — never throws: `isLlmConfigured()` gate → one `generateStructuredObject` call → fallback on any error. Returns `{ matrix, provider }`.
- **`runMetaAdsAgent(campaignId)`**: load context → `Promise.all` upsert 4 rows to `generating` (find by `campaignId+language+variant`, update else insert — same shape as the seed's `upsertDemoAdCopy` and creative's `upsertGeneratingAsset`) → generate matrix → update each row `{ status: "review", ...matrix[lang][variant] }` → campaign `status: "review"` → return `{ copies, generation: { triggered, agent: "Meta Ads Agent", provider, status, steps } }`. try/catch reverts the 4 rows to `draft` and rethrows on hard failure.
- **`regenerateAdCopy(campaignId, copyId)`**: find row scoped to campaign (404 "Ad copy not found for this campaign"), set `generating`, per-copy LLM call (same prompts + explicit language/variant instruction; fallback likewise) → `review` with all four content fields (finally fills `callToAction`, which the old stub never set); revert `draft` on hard failure.

## Task 3: Wire into campaign flow

- `routes/campaign.ts`: add `campaignRoutes.post("/campaigns/:campaignId/agents/meta-ads", ...)` → `runMetaAdsAgent` → 201 (clone of the creative/strategy trigger routes).
- `services/campaign.ts`: `regenerateAsset` `ad_copy` branch (campaign.ts:402-424) → `await regenerateAdCopy(campaignId, input.id)` (hardcoded NovaGear strings deleted). Import direction: `campaign.ts → meta-ads-agent.ts → ai.ts` (no cycles).

## Task 4: Verify (delta-scoped smoke test) + ship

- `tsc --noEmit` + build.
- Env: ask user to `! cp apps/server/.env ../Polyedro-abs-meta-ads-agent/apps/server/.env`.
- **New behavior** (:3000 openai / :3002 fallback): create test brand + campaign → run meta-ads agent → 201 with exactly 4 copies (es/en × a/b) `review`, A vs B visibly different angles, copy grounded in strategy's commercialAngle; re-run → still 4 rows (upsert, no duplicates); regenerate one copy via `/regenerate` → fresh content incl. `callToAction`, campaign `review`; approve one copy → block still pending (all-4 rule), approve all 4 → block approved; fallback instance → `provider: "fallback"`. Edges: bad uuid 400, nonexistent campaign 404, unauth 401, concurrent runs end `review` with 4 rows.
- **Touched surfaces**: other regenerate targets untouched (strategy regenerate still works — quick check), dashboard `agents.adCopies` ordering (language asc, variant asc), export payload carries the 4 rows.
- Cleanup test data; conventional commits; PR to org repo.
