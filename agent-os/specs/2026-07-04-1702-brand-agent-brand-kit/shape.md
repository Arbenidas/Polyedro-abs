# Brand Agent: generación del brand kit — Shaping Notes

## Scope

Agent in `apps/server` that fills the 6 content fields of `brand_kits` (color_palette, tone_of_voice bilingüe, buyer_persona, value_proposition, key_messages, visual_style) with the `draft → generating → review` status lifecycle on `brand_kits.status`. Replaces the hard-coded template content in `services/brand.ts` with real LLM generation and adds a dedicated re-run endpoint (`POST /api/brands/:brandId/agents/brand-kit`).

## Decisions

- **LLM via Vercel AI SDK** (`ai@^7` + `@ai-sdk/openai@^4`) so the provider is swappable with a one-file change; provider is **OpenAI** (`OPENAI_MODEL` default `gpt-5-mini`). Structured output through `generateText` + `Output.object({ schema })` with the zod schema passed directly.
- **Content fields only** — logo generation (`logo_url`/`logo_prompt` via Fal.ai, PR #9) stays as-is; the only change is the logo prompt now consumes the generated palette in the create flow.
- **Fallback-first**: missing `OPENAI_API_KEY` or any LLM failure falls back to the previous static template content — brand creation must never fail (same philosophy as the logo placeholder). Provider surfaced as `generation.provider: "openai" | "fallback"` in API responses, no new DB columns.
- `brands.status` roll-up out of scope; only `brand_kits.status` transitions.
- No `apps/web` changes.

## Context

- **Visuals:** None (backend-only feature).
- **References:** Creative Agent (`services/creative.ts`), Fal helper (`services/fal.ts`), existing static kit generation (`services/brand.ts`) — see `references.md`.
- **Product alignment:** Buildathon.md MVP flow step 2 ("Polyedro /abs genera su Brand Kit") and the visible-status direction (draft, generating, review, approved, ready_to_publish).

## Standards Applied

Omitted per user instruction — `agent-os/standards/index.yml` is empty at this time.
