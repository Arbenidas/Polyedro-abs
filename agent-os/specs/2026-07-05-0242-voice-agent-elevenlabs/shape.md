# Voice Agent (voiceovers with ElevenLabs) — Shaping Notes

## Scope

Build a server-side **Voice Agent** that calls the ElevenLabs Text-to-Speech API to generate **ES and EN
voiceovers** for a campaign's video script, uploads the MP3 to Supabase Storage, and persists `audioUrl`,
`voiceId` and `settings` in the existing `voiceovers` table (one row per language, linked to
`video_script_id`). Replaces the previous stopgap (voiceover was an *optional* publish block whose
"regenerate" wrote a hardcoded fake CDN URL). Listed **P0 deliverable**; the UI voice card already existed
waiting for audio.

## Decisions

- **EN narration source** → build ES narration from the video-script scene dialogues, then translate to EN
  via the shared OpenAI helper (`services/ai.ts`). Graceful fallback chain: LLM translation → EN ad copy →
  brand/objective template. Rationale (researched): `eleven_multilingual_v2` speaks ES and EN with a single
  voice, so language is purely a function of the input text — feeding proper EN text is the honest approach.
- **Publish gating** → voiceover is now a **required** deliverable (removed the `optional` stopgap flag).
- **Trigger** → **manual only** (generated from the voice card), not chained into the Deploy-agents flow.
- **No DB migration** — the `voiceovers` table already had `voiceId`, `audioUrl`, `settings`, `language`,
  `durationSeconds`.
- **Never hard-fail** — missing `ELEVENLABS_API_KEY` or a TTS error produces `provider: "fallback"` rows
  (no audio, estimated duration), mirroring the other agents' template fallbacks.
- **Default voice** → `EXAVITQu4vr4xnSDxMaL` ("Sarah"), a standard premade voice available to all accounts
  including free tier (the initially-chosen "Rachel" turned out to be a paid-only *library* voice → 402).

## Context

- **Visuals:** None (reused the existing neo-brutalist voice card / wave rows).
- **References:** see `references.md`.
- **Product alignment:** No `agent-os/product/` in repo. Aligns with Buildathon MVP flow
  (Brand → Campaign → Agents → Assets → Approval → Meta Ads/n8n export); Voice Agent is one of the 8 agents.

## Verification (done end-to-end)

Booted the server from the worktree with a real `ELEVENLABS_API_KEY`, authenticated the e2e user, seeded the
demo campaign, and ran `POST /api/campaigns/:id/agents/voice`:
- Real ElevenLabs audio generated for ES + EN, uploaded to Supabase Storage (`generated-assets/voiceovers/`),
  publicly playable (`audio/mpeg`).
- Demo ES row upserted in place (no duplicate); fake CDN URL replaced with the real audio URL.
- Fallbacks proven: 402 (library voice) and invalid OpenAI key both degraded gracefully.
- Publish gating confirmed: voiceover counted as a required block, blocks publish until approved.
- approve + regenerate voiceover paths both return 200 and behave correctly.

## Standards Applied

Standards-enforcement step skipped per team workflow (shape-spec minus standards).
