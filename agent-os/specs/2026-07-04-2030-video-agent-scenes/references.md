# References for Video Agent: guion por escenas

## Similar Implementations

### Strategy Agent

- **Location:** `apps/server/src/api/services/strategy-agent.ts`
- **Relevance:** Single-row campaign agent using shared structured AI, fallback content, lifecycle events, and campaign status roll-up.
- **Key patterns:** `loadContext`, strict Zod schema, `generateStructuredObject`, fallback on LLM failure, `run*Agent`, `regenerate*`.

### Meta Ads Agent

- **Location:** `apps/server/src/api/services/meta-ads-agent.ts`
- **Relevance:** Text generation agent grounded in campaign strategy and brand kit, with explicit endpoint and regenerate wiring.
- **Key patterns:** prompt construction, fallback content, route-level ownership, hard-failure rollback.

### Campaign Service

- **Location:** `apps/server/src/api/services/campaign.ts`
- **Relevance:** Current `video_script` regenerate stub, dashboard shape, readiness blocks, demo script seed.
- **Key patterns:** preserve approval/readiness behavior and replace only the video script branch.

### Schema

- **Location:** `apps/server/src/db/schema/index.ts`
- **Relevance:** `videoScripts` already has `language`, `title`, `scenes`, and `durationSeconds`.
- **Key patterns:** use existing `VideoScene` JSON shape; no migration required.

### Data Model Docs

- **Location:** `docs/data-model.md`
- **Relevance:** Documents `video_scripts.scenes` as an array of `{ sceneNumber, description, dialogue?, durationSeconds? }`.
