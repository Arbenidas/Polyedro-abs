# References for Conectar GenliveView y CampaignView al backend

## Similar Implementations

### Labs simulated campaign flow

- **Location:** `apps/web/src/components/labs/labs-app.tsx`, `apps/web/src/components/labs/flow-views.tsx`, `apps/web/src/components/labs/campaign-view.tsx`
- **Relevance:** Current GenliveView/CampaignView behavior and visual structure.
- **Key patterns:** Preserve the existing brutalist UI and status vocabulary while replacing local timers/state with real API state.

### Web API/auth helper

- **Location:** `apps/web/src/lib/api.ts`
- **Relevance:** Shared `apiFetch` attaches the Supabase access token required by server auth middleware.
- **Key patterns:** Add campaign helpers beside existing brand/transcription helpers and reuse shared error parsing.

### Campaign progress hook

- **Location:** `apps/web/src/lib/use-campaign-progress.ts`
- **Relevance:** Existing SSE consumer with polling fallback for `GET /api/campaigns/:id/progress/stream`.
- **Key patterns:** Subscribe once the real campaign id is known and drive generation UI from emitted events.

### Campaign backend routes

- **Location:** `apps/server/src/api/routes/campaign.ts`
- **Relevance:** Real endpoints for campaigns, dashboard, agents, approval, regeneration, export, and progress.
- **Key patterns:** Ownership is enforced before route handlers delegate to services.

### Campaign services and progress bus

- **Location:** `apps/server/src/api/services/campaign.ts`, `apps/server/src/api/services/progress.ts`
- **Relevance:** Dashboard response shape, progress event payloads, and asset target names.
- **Key patterns:** Use server `AssetTarget` names (`strategy`, `ad_copy`, `creative_asset`, `video_script`, `voiceover`) and refresh dashboard after mutations.
