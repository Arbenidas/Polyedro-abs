# Brand Agent: generación del brand kit

## Context

Polyedro /abs needs its Brand Agent: the agent in `apps/server` that fills the `brand_kits` row (color palette, bilingual tone of voice, buyer persona, value proposition, key messages, visual style) with the `draft → generating → review` status lifecycle.

Today `apps/server/src/api/services/brand.ts` already creates the kit with the right lifecycle, but the 6 content fields are **hard-coded templates** (the code comment says the palette "pasará a ser generada por LLM"). This feature replaces that static content with real **OpenAI** generation, extracted into a proper agent following the Creative Agent pattern, plus a dedicated re-run endpoint.

Shaping decisions (confirmed with user):
- **LLM via Vercel AI SDK** (`ai@^7.0.15` + `@ai-sdk/openai@^4.0.7`) so the provider is swappable; **provider: OpenAI**. New optional env `OPENAI_API_KEY` + `OPENAI_MODEL` (default `gpt-5-mini`). Researched online: AI SDK 7 is current stable; structured output is `generateText` + `Output.object({ schema })` with the zod schema passed directly (strict JSON schema by default on the OpenAI provider, `NoObjectGeneratedError` on failure, `maxRetries` built in). Repo's zod `^4.1.13` satisfies the peer range.
- **Content fields only** — logo (`logo_url`/`logo_prompt` via Fal.ai) stays as-is.
- **No visuals**, backend-only. **Standards omitted** (index is empty).
- No `apps/web` changes. `brands.status` roll-up out of scope (only `brand_kits.status` transitions).

Work happens in the worktree `../Polyedro-abs-brand-agent` on branch `feature/brand-agent` (already created).

## Task 1: Save spec documentation

Create `agent-os/specs/2026-07-04-1702-brand-agent-brand-kit/` with:
- `plan.md` — this full plan
- `shape.md` — shaping notes (scope, decisions above, context)
- `references.md` — pointers to Creative Agent / fal.ts / brand.ts patterns studied
- `standards.md` — note that standards were omitted per user (index empty)
- No `visuals/` (none provided)

## Task 2: Dependencies + env vars

- `apps/server/package.json`: add `ai` (^7.0.15) and `@ai-sdk/openai` (^4.0.7) via `pnpm --filter server add ai @ai-sdk/openai`.
- `packages/env/src/server.ts` — add, mirroring the FAL pattern:
```ts
/** OpenAI key para el Brand Agent (via Vercel AI SDK); sin ella el kit usa contenido template. */
OPENAI_API_KEY: z.string().min(1).optional(),
OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
```
- Add both to `apps/server/.env.example` if it exists (key left empty).

## Task 3: AI SDK helper — `apps/server/src/api/services/ai.ts`

Thin, provider-swappable module (analogous to `fal.ts` for images) that other agents (strategy, copy) can reuse:
- `isLlmConfigured = () => !!env.OPENAI_API_KEY`
- `const provider = createOpenAI({ apiKey: env.OPENAI_API_KEY })` (lazy — only constructed when configured) and `getLlmModel = () => provider(env.OPENAI_MODEL)`. Uses the Responses API by default with strict JSON schema for structured output. Swapping providers later = change this one file.
- Optionally a `generateStructuredObject({ schema, schemaName, system, prompt })` wrapper around `generateText({ model, output: Output.object({ schema, name }), system, prompt, abortSignal: AbortSignal.timeout(60_000) })` returning the validated `output`. Uses AI SDK's built-in `maxRetries` (default 2); throws `NoObjectGeneratedError`/`ApiError` for the caller's fallback to catch.

Constraint from strict mode: zod schemas must have **no `.optional()`** fields (all-required, `additionalProperties: false` — AI SDK handles this; use required-everywhere shapes, which are a superset of the DB's optional `$type` fields).

## Task 4: Brand Agent — `apps/server/src/api/services/brand-agent.ts`

Move the **entire kit-generation concern** (content + logo) here; `brand.ts` keeps brand CRUD. Import graph, no cycles: `routes/brand.ts → services/brand.ts + brand-agent.ts → services/ai.ts + fal.ts`.

- **Types + zod schema**: `brandKitContentSchema` for the 6 fields, strict-output compatible — `z.strictObject`, **all fields required** (superset of the DB's optional `$type` fields, so still assignable): `colorPalette {primary, secondary, accent, neutrals: string[]}`, `toneOfVoice/valueProposition {es, en}`, `buyerPersona {name, age, occupation, goals[], painPoints[], notes}`, `keyMessages {es: string[], en: string[]}`, `visualStyle {mood, imageryStyle, typography, references[]}`. No regex/min constraints in the schema (strict-mode compatibility); counts and `#RRGGBB` format enforced by the prompt. `type BrandKitContent = z.infer<...>`.
- **`type BrandContext = { name; description; industry; marketLabel }`** — same normalization as today (defaults: description fallback text, industry "Emerging business", markets `["LATAM"]`).
- **`buildFallbackContent(ctx): BrandKitContent`** — the existing static templates + `KIT_COLOR_PALETTE` moved verbatim from `brand.ts`.
- **`generateBrandKitContent(ctx): Promise<{ content: BrandKitContent; provider: "openai" | "fallback" }>`** — never throws: `!isLlmConfigured()` → fallback; else `generateText` + `Output.object({ schema: brandKitContentSchema })` (via the `ai.ts` wrapper). Prompt: system = Brand Agent for Polyedro, natural LATAM Spanish + English (equivalent meaning, not literal translations), 6-digit hex palette with strong contrast + 2-4 neutrals, exactly 3 key messages per language, 2-4 goals/painPoints/references, grounded in the brief, no placeholder text; user = name/industry/markets/brief. On any error (`NoObjectGeneratedError`, timeout, refusal) **log and fall back** — brand creation must never fail (same semantics as the logo placeholder).
- **Moved logo helpers**: `buildLogoPrompt` + `generateLogoImage` from `brand.ts`, unchanged except the prompt/placeholder color reads `content.colorPalette.primary` instead of the deleted constant.
- **`generateBrandKitForBrand(brand, input)`** (moved + refactored, used by `createBrand`): insert kit `status: "generating"` → `generateBrandKitContent(ctx)` → build logo prompt from the generated palette → `generateLogoImage` → single update `{ status: "review", logoUrl, logoPrompt, ...content }`. Returns `{ brandKit, provider }`. Sequential because the logo prompt consumes the palette.
- **`runBrandAgent(brandId, userId, markets?)`** — the re-run entry:
  1. `db.query.brands.findFirst({ where: and(eq(brands.id, brandId), eq(brands.userId, userId)) })` → `ApiError(404, "Brand not found")` (ownership in the query; 404 not 403, don't leak existence).
  2. Upsert kit to `generating`: update existing kit's status, or insert `{ brandId, status: "generating" }` if missing (partial-failure recovery). Logo fields untouched on re-run.
  3. `generateBrandKitContent(ctx)` → update kit `{ status: "review", ...content }`.
  4. try/catch: on hard failure (DB error) revert kit to `status: "draft"` and rethrow — mirrors `generateVariant` in creative.ts. No 409 on concurrent runs (last write wins; also self-heals stuck `generating` rows).
  5. Return `{ brandKit, generation: { triggered: true, agent: "Brand Agent", provider, status, steps: ["brand_kit.regenerating:generating", "brand_kit.content:<provider>", "brand_kit.completed:review"] } }`.

## Task 5: Slim down `brand.ts`

Keeps `listBrands`, `createBrand`, `upsertDemoUser` (~120 lines deleted). `createBrand` imports `generateBrandKitForBrand` from `brand-agent.ts` and adds `provider` + a `brand_kit.content:<provider>` step to its `generation` response object (web ignores unknown keys — no apps/web change).

## Task 6: Re-run route

`apps/server/src/api/routes/brand.ts`:
```ts
const brandAgentInputSchema = z.object({ markets: marketsSchema }); // reuses existing marketsSchema

brandRoutes.post("/:brandId/agents/brand-kit", async (c) => {
  const brandId = parseUuidParam(c.req.param("brandId"), "brandId");
  const input = await parseBody(c.req.raw, brandAgentInputSchema).catch(() => undefined); // body optional
  const result = await runBrandAgent(brandId, c.get("user").id, input?.markets);
  return c.json(result, 201);
});
```
`markets` is accepted in the body because `brands` has no markets column (create-time markets only exist in that request); defaults to `["LATAM"]`.

## Task 7: Verify end-to-end

- `pnpm --filter server check-types` in the worktree.
- Start server (`pnpm --filter server dev`) with `OPENAI_API_KEY` **unset** → `POST /api/brands` (JWT from the e2e test user via Supabase) → expect 201, kit `status: "review"`, template content, `generation.provider: "fallback"`.
- `POST /api/brands/:brandId/agents/brand-kit` (empty body) → 201, regenerated content, `logoUrl` unchanged.
- With `OPENAI_API_KEY` set in `apps/server/.env` (if the key is available): same two calls → `provider: "openai"`, bilingual es/en content matching the seed-data shapes; verify the row in Supabase (`select status, color_palette, tone_of_voice, key_messages from brand_kits`).
- Edge checks: another user's token → 404; `not-a-uuid` param → 400; status lifecycle hits `generating` then `review`.

Then commit (`feat(server): ...` conventional commits) and open PR to the org repo per the usual dev workflow.

## Edge cases (accepted trade-offs)

- LLM refusal / invalid JSON / timeout → fallback content; create and re-run still succeed at `review`.
- Kit row missing on re-run (crashed create) → fresh kit inserted, logo stays null until a create-style run.
- Re-run doesn't touch the logo, so palette can drift from logo colors — accepted, documented in a comment.
- Non-hex color strings from the LLM accepted as-is (freeform jsonb; prompt requests `#RRGGBB`).
