import { env } from "@Polyedro-abs/env/server";
import { ApiError } from "@/api/shared";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
export const OPENAI_TRANSCRIPTION_MODEL = "whisper-1";
export const TRANSCRIPTION_LANGUAGE = "es";

export function assertValidAudioFile(audio: unknown): asserts audio is File {
  if (!(audio instanceof File)) {
    throw new ApiError(400, "Audio file is required.");
  }

  if (!audio.size) {
    throw new ApiError(400, "Audio file is empty.");
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    throw new ApiError(400, "Audio file must be 25 MB or smaller.");
  }
}

export async function transcribeAudioFile(audio: unknown): Promise<string> {
  assertValidAudioFile(audio);

  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, "OpenAI transcription is not configured.");
  }

  const openaiFormData = new FormData();
  openaiFormData.append("file", audio, audio.name || "campaign-brief.webm");
  openaiFormData.append("model", OPENAI_TRANSCRIPTION_MODEL);
  openaiFormData.append("language", TRANSCRIPTION_LANGUAGE);
  openaiFormData.append("response_format", "json");

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: openaiFormData,
  });

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    console.error("OpenAI transcription failed", body);
    throw new ApiError(500, "Could not transcribe audio.");
  }

  const text = (body as { text?: unknown } | undefined)?.text;

  if (typeof text !== "string") {
    throw new ApiError(500, "Transcription response was invalid.");
  }

  return text;
}
