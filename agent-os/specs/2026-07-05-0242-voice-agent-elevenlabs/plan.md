# F5 — Voice Agent (voiceovers with ElevenLabs)

## Context

Voiceovers are a listed **P0 deliverable** ("Voice Agent: voiceovers con ElevenLabs — llama a la API de
ElevenLabs desde el server y guarda `audioUrl`, `voiceId` y `settings` en `voiceovers` (ES y EN)"). The UI
voice card (`VOICE AGENT · ELEVENLABS`) and the `voiceovers` table already exist, but there is **no agent**:
the previous PR made voiceover an *optional* publish block as a stopgap and left `regenerateAsset`'s voiceover
case writing a **hardcoded fake CDN URL**. Voiceovers can only appear via the demo seed today — a fresh
campaign has no way to produce them, and the UI wave rows are decorative (they never play `audioUrl`).

This feature adds a real server-side Voice Agent that calls ElevenLabs TTS, hosts the audio in Supabase
Storage, and persists ES + EN rows — closing the gap so the deliverable is genuinely done.

**Decisions (confirmed):**
- **EN text** → build ES narration from the video-script scene dialogues, then **translate to EN via the
  existing OpenAI helper** (`ai.ts`); graceful fallback to EN ad copy → template when no LLM key.
  (`eleven_multilingual_v2` speaks both languages with one voice; language is a function of the input text.)
- **Publish gating** → make voiceover **required** (remove the optional stopgap).
- **Trigger** → **manual only**: generated from the voice card, not chained into the Deploy flow.
- **No DB migration** — the `voiceovers` table already has `voiceId`, `audioUrl`, `settings`, `language`,
  `durationSeconds`.

## Reference implementations (mirror these)

- `apps/server/src/api/services/video-agent.ts` — canonical agent shape (context load → generate → upsert →
  emit progress → roll campaign to `review`; never hard-fails on missing key). Voiceover attaches to a
  `video_script`, so the Voice Agent loads the campaign's latest script first.
- `apps/server/src/api/services/meta-ads-agent.ts` — multi-row (ES/EN) upsert pattern.
- `apps/server/src/api/services/images/storage.ts` — Supabase Storage upload (bucket `generated-assets`).
- `apps/server/src/api/services/ai.ts` — `isLlmConfigured()` / `generateStructuredObject()` for EN translation.
- `apps/server/src/api/services/images/fal.ts` — provider `isConfigured()` + `fetch` + `ApiError` pattern.

## ElevenLabs API (researched)

- `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128`
- Headers: `xi-api-key: <key>`, `Content-Type: application/json`
- Body: `{ text, model_id: "eleven_multilingual_v2", voice_settings: { stability, similarity_boost, style, use_speaker_boost } }`
- Response JSON: `{ audio_base64, alignment: { character_end_times_seconds: number[] } }`
  → decode base64 → mp3 bytes; **duration = last value of `character_end_times_seconds`**.

---

## Task 1 — Save spec documentation (agent-os)

Create `agent-os/specs/2026-07-05-XXXX-voice-agent-elevenlabs/` (timestamp at write time) with:
- `plan.md` (this plan), `shape.md` (scope + the 3 confirmed decisions + context), `references.md`
  (files above), `standards.md` (n/a — note "standards step skipped per workflow").

## Task 2 — Env config

- `packages/env/src/server.ts`: add
  - `ELEVENLABS_API_KEY: z.string().min(1).optional()`
  - `ELEVENLABS_VOICE_ID: z.string().min(1).default("21m00Tcm4TlvDq8ikWAM")` (premade "Rachel"; overridable)
  - `ELEVENLABS_VOICE_ID_EN: z.string().min(1).optional()` (defaults to `ELEVENLABS_VOICE_ID`)
  - `ELEVENLABS_MODEL: z.string().min(1).default("eleven_multilingual_v2")`
- `apps/server/.env.example`: document the four keys (agent uses fallback without `ELEVENLABS_API_KEY`).

## Task 3 — ElevenLabs client + generic asset storage

- New `apps/server/src/api/services/voice/elevenlabs.ts`:
  - `isElevenLabsConfigured = () => !!env.ELEVENLABS_API_KEY`
  - `synthesizeSpeech({ text, voiceId, modelId, voiceSettings }): Promise<{ bytes: Uint8Array; durationSeconds: number }>`
    — POST to `/with-timestamps`, `AbortSignal.timeout`, throw `ApiError` on non-2xx, base64-decode audio,
    derive duration from alignment (estimate from word count as a safety fallback).
- Generalize storage (DRY): add `uploadGeneratedAsset({ bytes, contentType, keyPrefix, extension })` (shared
  Supabase upload to `generated-assets`); refactor `images/storage.ts`'s `uploadGeneratedImage` to delegate to
  it (behavior unchanged). Voice agent uploads with `keyPrefix: "voiceovers"`, `contentType: "audio/mpeg"`.

## Task 4 — Voice Agent service

New `apps/server/src/api/services/voice-agent.ts`:
- `loadVoiceContext(campaignId)` — campaign + brand + latest `videoScript` (with scenes) + `adCopies`
  (EN fallback). Throw `ApiError(409, "Generate a video script before voiceovers")` if none.
- Narration: `buildEsNarration(script)` joins scene `dialogue`s; `buildEnNarration(es, ctx)` translates via
  `generateStructuredObject({ schema: { text } })` when LLM configured, else EN ad copy, else template.
- For each language (`es`, `en`): resolve `voiceId` (EN uses `ELEVENLABS_VOICE_ID_EN ?? ELEVENLABS_VOICE_ID`),
  `voiceSettings` (stability 0.5 / similarity_boost 0.75 / style 0.3 / use_speaker_boost true).
  - configured → `synthesizeSpeech` → `uploadGeneratedAsset` → `audioUrl`; `settings.provider = "elevenlabs"`.
  - not configured / TTS error → `audioUrl = null`, duration estimated, `settings.provider = "fallback"`
    (never hard-fail — mirrors other agents).
  - Upsert one row per `(videoScriptId, language)`: `status "review"`, `voiceId`, `audioUrl`,
    `durationSeconds`, `settings { provider, model, voiceSettings, text }`.
- Emit `emitAgentStarted/Log/Completed` + `emitAssetUpdated` (agent `"voice"`); roll campaign to `review`.
- Export `runVoiceAgent(campaignId)` and `regenerateVoiceover(campaignId, voiceoverId)` (validates the row
  belongs to the campaign, then re-runs the agent for its script — regenerates the ES/EN pair).
- `progress.ts`: add `"voice"` to the `ProgressAgent` union.

## Task 5 — Route + campaign wiring

- `apps/server/src/api/routes/campaign.ts`: add `POST /campaigns/:campaignId/agents/voice` → `runVoiceAgent`.
- `apps/server/src/api/services/campaign.ts`:
  - Replace the hardcoded voiceover stub (`regenerateAsset`, ~L453-473) with `regenerateVoiceover(campaignId, input.id)`.
  - `getProgressBlocks`: drop the `optional` flag on the voiceover block (now required); update the comment.

## Task 6 — Web wiring (manual generate + real playback)

- `apps/web/src/lib/api.ts`: allow `"voice"` in `runCampaignAgent`'s agent arg.
- `apps/web/src/components/labs/labs-app.tsx`: in `regen`, special-case `"voice"` — call
  `runCampaignAgent(campaignId, "voice")` then refresh the dashboard (handles both first generate and
  regenerate, since the agent upserts the ES/EN pair). `hasRealAssets(..., "voice")` → true when a
  **video script** exists (so "Generate" is enabled once the script is there).
- `apps/web/src/components/labs/campaign-view.tsx`: give `WaveRow` a `src` prop with an internal
  `<audio>` element driven by the existing `playing` flag; when `audioUrl` is null (fallback) disable the
  play button and show a small "audio pending — set ELEVENLABS_API_KEY" hint.

## Verification

1. Copy the server `.env` into the worktree (`apps/server/.env`) and add `ELEVENLABS_API_KEY` if available.
2. `pnpm check-types` (or turbo) across `apps/server` + `apps/web` — no type errors.
3. Run server + web (via the `run` skill). Create a campaign, run the video agent, then click **Generate** on
   the voice card:
   - **No key** → two rows (ES/EN) appear in `review`, `settings.provider = "fallback"`, play button disabled.
   - **With key** → real MP3s uploaded to Supabase Storage; wave rows play the audio; DB `voiceovers` rows
     hold real `audioUrl`, `voiceId`, `settings`.
4. Confirm publish gating: with voiceover now required, a fresh campaign is not `ready_to_publish` until the
   ES/EN voiceovers are approved; the demo seed still works (it seeds a voiceover row).
5. Scope smoke test to the voiceover delta + the touched publish-readiness path only.

Then commit (Conventional Commits), open PR to `origin` (Arbenidas) for CI, and deploy per the usual flow
after merge.
