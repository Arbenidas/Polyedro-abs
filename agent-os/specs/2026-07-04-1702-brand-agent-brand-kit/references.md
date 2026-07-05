# References for Brand Agent: generación del brand kit

## Similar Implementations

### Creative Agent

- **Location:** `apps/server/src/api/services/creative.ts`, trigger route `apps/server/src/api/routes/campaign.ts` (`POST /api/campaigns/:campaignId/agents/creative`)
- **Relevance:** Canonical agent shape in this repo.
- **Key patterns:** load context via relational query + `ApiError(404)`; set rows to `generating`; call provider; on success → `review`; on error revert to `draft` and rethrow; `requireOne` after every `.returning()`.

### Fal.ai helper

- **Location:** `apps/server/src/api/services/fal.ts`
- **Relevance:** Provider-helper pattern the new `services/ai.ts` mirrors (config gate on optional env var, timeout, `ApiError(500)`, callers own the fallback decision).

### Existing brand-kit generation (replaced)

- **Location:** `apps/server/src/api/services/brand.ts` (`generateBrandKitForBrand`)
- **Relevance:** Already implements the exact `draft → generating → review` lifecycle and the logo flow; its hard-coded template content moves to `brand-agent.ts` as the fallback content.

### Route/service conventions

- **Location:** `apps/server/src/api/routes/brand.ts`, `apps/server/src/api/shared.ts`
- **Key patterns:** `Hono<AuthEnv>` + `c.get("user").id` for ownership, `parseUuidParam`, `parseBody` with zod, responses via `c.json(result, 201)`.

## External docs consulted

- Vercel AI SDK 7 structured output: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data (`generateText` + `Output.object`, `NoObjectGeneratedError`)
- OpenAI provider: https://ai-sdk.dev/providers/ai-sdk-providers/openai (Responses API default, strict JSON schema by default, no `.optional()` in schemas, `OPENAI_API_KEY` default env)
