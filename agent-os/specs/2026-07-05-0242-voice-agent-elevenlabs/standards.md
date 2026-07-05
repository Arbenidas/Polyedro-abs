# Standards for Voice Agent (ElevenLabs)

The standards-enforcement step of shape-spec is skipped per the team workflow (full agent-os flow **minus
standards**). This feature nonetheless follows the de-facto patterns already established by the other agents:

- **Env**: validated centrally in `packages/env/src/server.ts` (`@t3-oss/env-core` + Zod); provider keys are
  `.optional()`, models/voices have `.default()`.
- **Errors**: throw `ApiError(status, message, detail?)` from `@/api/shared`; ownership checked at the route
  edge (`requireOwnedCampaignId`).
- **Persistence**: Drizzle `db` from `@/db`, `.returning()` guarded by `requireOne`.
- **Agent resilience**: never hard-fail on a missing provider key — degrade to a `fallback` provider.
- **Progress**: emit via `services/progress.ts` (`agent` = `"voice"`).
- **Commits/PR**: Conventional Commits; PR to `origin` (Arbenidas) for CI, then deploy after merge.
