# References for Strategy Agent

## Similar Implementations

### Brand Agent (primary pattern)

- **Location:** `apps/server/src/api/services/brand-agent.ts`
- **Key patterns:** strict-output zod schema (`z.strictObject`, all-required, no `.optional()`), never-throw `generate*Content` with provider fallback, upsert-to-`generating` → `review` with `draft` revert on hard failure, `generation` response object with `provider` + `steps`.

### AI SDK wrapper (reused as-is)

- **Location:** `apps/server/src/api/services/ai.ts`
- **Key patterns:** `isLlmConfigured()`, `generateStructuredObject({ schema, schemaName, system, prompt })`.

### Creative Agent

- **Location:** `apps/server/src/api/services/creative.ts`
- **Key patterns:** `loadCreativeContext` relational query (campaign + brand + brandKit + strategy), campaign `status: "review"` roll-up on success, `regenerateCreativeAsset(campaignId, assetId)` shape for the regenerate branch. Note: its `buildPrompt` consumes `strategy.commercialAngle`.

### Campaign service touchpoints

- **Location:** `apps/server/src/api/services/campaign.ts`
- `upsertDemoStrategy` (seed content → basis for the fallback template), `regenerateAsset` strategy branch (replaced), `approveAsset` strategy branch (unchanged), `getProgressBlocks`/`updateCampaignReadiness` (strategy is 1 of 6 blocks), `buildMetaAdsPayload` (exports the full strategy row).

### Route convention

- **Location:** `apps/server/src/api/routes/campaign.ts` — creative trigger route (`POST /campaigns/:campaignId/agents/creative`) is the template for the strategy trigger; `campaignInputSchema` for create.
