import { ApiError } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";

/** Cliente de ElevenLabs Text-to-Speech para el Voice Agent. Hoy es el único
 *  provider de voz; cambiar de proveedor = cambiar este archivo. */

const TTS_REQUEST_TIMEOUT_MS = 60_000;

/** Formato de salida (mp3 44.1kHz 128kbps) — buen balance calidad/tamaño para
 *  hostear en Storage y reproducir en el navegador. */
const OUTPUT_FORMAT = "mp3_44100_128";

/** Estimación de duración cuando el alignment no viene (fallback): ~2.6 palabras
 *  por segundo es un ritmo de locución razonable. */
const WORDS_PER_SECOND = 2.6;

export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

type TimestampsResponse = {
  audio_base64?: string;
  alignment?: {
    character_end_times_seconds?: number[];
  };
};

export const isElevenLabsConfigured = () => !!env.ELEVENLABS_API_KEY;

/** Estima segundos a partir del conteo de palabras (mínimo 1s). */
export const estimateDurationSeconds = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_SECOND));
};

/** Genera audio para `text` con ElevenLabs y devuelve los bytes del mp3 más la
 *  duración real (derivada del alignment). Lanza `ApiError` si no está
 *  configurado o si la API falla; el caller decide su fallback. */
export const synthesizeSpeech = async (input: {
  text: string;
  voiceId: string;
  modelId: string;
  voiceSettings: VoiceSettings;
}): Promise<{ bytes: Uint8Array; durationSeconds: number }> => {
  if (!env.ELEVENLABS_API_KEY) {
    throw new ApiError(500, "ELEVENLABS_API_KEY is not configured");
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: input.modelId,
      voice_settings: input.voiceSettings,
    }),
    signal: AbortSignal.timeout(TTS_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => undefined);
    throw new ApiError(500, `ElevenLabs TTS failed (${response.status})`, detail);
  }

  const data = (await response.json()) as TimestampsResponse;

  if (!data.audio_base64) {
    throw new ApiError(500, "ElevenLabs returned no audio");
  }

  const bytes = Uint8Array.from(Buffer.from(data.audio_base64, "base64"));
  const endTimes = data.alignment?.character_end_times_seconds;
  const alignedDuration = endTimes?.at(-1);
  const durationSeconds =
    alignedDuration && alignedDuration > 0
      ? Math.max(1, Math.round(alignedDuration))
      : estimateDurationSeconds(input.text);

  return { bytes, durationSeconds };
};
