# References for Voice Agent (ElevenLabs)

## Similar implementations studied

### Video Agent (canonical agent shape)
- **Location:** `apps/server/src/api/services/video-agent.ts`
- **Relevance:** Same lifecycle the Voice Agent follows — load context → generate → upsert → emit progress
  events → roll campaign to `review`; never hard-fails on a missing key (falls back). Voiceovers hang off a
  `video_script`, so the Voice Agent loads the campaign's latest script first.
- **Borrowed:** `loadContext` shape, `emitAgentStarted/Log/Completed` + `emitAssetUpdated` usage, the
  `runXAgent(campaignId, { scriptId? })` + `regenerateX(campaignId, id)` export pair, `requireOne` guards.

### Meta Ads Agent (multi-row ES/EN)
- **Location:** `apps/server/src/api/services/meta-ads-agent.ts`
- **Relevance:** Writes multiple rows keyed by `(campaignId, language, variant)` with app-owned upsert (no DB
  unique constraint). Voice Agent mirrors this for `(videoScriptId, language)`.

### Image storage (Supabase Storage)
- **Location:** `apps/server/src/api/services/images/storage.ts`
- **Relevance:** Public bucket `generated-assets` upload → `getPublicUrl`. Generalized into
  `apps/server/src/api/services/storage.ts` (`uploadGeneratedAsset`); the image helper now delegates to it,
  and the Voice Agent uploads MP3 bytes with `keyPrefix: "voiceovers"`, `contentType: "audio/mpeg"`.

### Shared LLM helper (EN translation)
- **Location:** `apps/server/src/api/services/ai.ts`
- **Relevance:** `isLlmConfigured()` + `generateStructuredObject()` used to translate the ES narration to EN
  (strict Zod schema `{ text }`).

### Provider fetch/error pattern
- **Location:** `apps/server/src/api/services/images/fal.ts`
- **Relevance:** `isConfigured()` + raw `fetch` + `AbortSignal.timeout` + `ApiError` on non-2xx — mirrored in
  `apps/server/src/api/services/voice/elevenlabs.ts`.

## New files
- `apps/server/src/api/services/voice/elevenlabs.ts` — ElevenLabs TTS client (`/with-timestamps`).
- `apps/server/src/api/services/voice-agent.ts` — the agent (`runVoiceAgent`, `regenerateVoiceover`).
- `apps/server/src/api/services/storage.ts` — generic Supabase Storage uploader.

## ElevenLabs API (researched)
- `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128`
- Header `xi-api-key`; body `{ text, model_id, voice_settings }`; response JSON `{ audio_base64, alignment:
  { character_end_times_seconds } }` → duration = last alignment value.
- Free-tier accounts can use premade voices in their `/v1/voices` list but **not** "library" voices (402).
