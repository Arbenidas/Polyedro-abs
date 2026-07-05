# References for Meta Ads Agent

## Similar Implementations

### Strategy Agent (skeleton to clone)

- **Location:** `apps/server/src/api/services/strategy-agent.ts`
- **Key patterns:** strict zod schema, never-throw content generation with provider fallback, `generating → review` with `draft` revert, campaign roll-up to `review`, `generation` response object.

### Creative Agent (multi-row semantics)

- **Location:** `apps/server/src/api/services/creative.ts`
- **Key patterns:** `upsertGeneratingAsset` keyed on campaign+variant, `loadCreativeContext` relational query (campaign + brand + brandKit + strategy).

### Seed ad copy upsert

- **Location:** `apps/server/src/api/services/campaign.ts` (`upsertDemoAdCopy`)
- **Key patterns:** upsert key `campaignId + language + variant` (no DB unique — app-level), seed copy text used as the fallback template basis.

### AI wrapper (reused as-is)

- **Location:** `apps/server/src/api/services/ai.ts` — `generateStructuredObject`, `isLlmConfigured`.

### Schema

- **Location:** `apps/server/src/db/schema/index.ts` — `adCopies` table (`callToAction` exists), `languageEnum` (es|en), `variantEnum` (a|b).
