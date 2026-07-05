import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const TTS_REQUEST_TIMEOUT_MS = 60_000;
const MAX_NARRATION_CHARS = 480;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_NARRATION_CHARS),
});

let fallbackEnvLoaded = false;

function getElevenLabsApiKey(): string | undefined {
  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }

  if (!fallbackEnvLoaded) {
    fallbackEnvLoaded = true;

    for (const envPath of [
      resolve(process.cwd(), "../server/.env"),
      resolve(process.cwd(), "apps/server/.env"),
    ]) {
      if (existsSync(envPath)) {
        loadEnv({ path: envPath, override: false });
      }

      if (process.env.ELEVENLABS_API_KEY) {
        return process.env.ELEVENLABS_API_KEY;
      }
    }
  }

  return process.env.ELEVENLABS_API_KEY;
}

function getVoiceId(): string {
  return process.env.ELEVENLABS_GUIDE_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
}

function getModelId(): string {
  return process.env.ELEVENLABS_GUIDE_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
}

export async function POST(request: Request) {
  const apiKey = getElevenLabsApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured in apps/web/.env.local or apps/server/.env" },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid narration text" }, { status: 400 });
  }

  const voiceId = getVoiceId();
  const modelId = getModelId();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: parsed.data.text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
      },
    }),
    signal: AbortSignal.timeout(TTS_REQUEST_TIMEOUT_MS),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "ElevenLabs TTS request failed" }, { status: 502 });
  }

  const audio = await upstream.arrayBuffer();

  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
