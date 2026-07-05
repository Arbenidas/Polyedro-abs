import { generateStructuredObject, isLlmConfigured } from "@/api/services/ai";
import {
  emitAgentCompleted,
  emitAgentLog,
  emitAgentStarted,
  emitAssetUpdated,
} from "@/api/services/progress";
import { uploadGeneratedAsset } from "@/api/services/storage";
import {
  estimateDurationSeconds,
  isElevenLabsConfigured,
  synthesizeSpeech,
  type VoiceSettings,
} from "@/api/services/voice/elevenlabs";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { campaigns, voiceovers } from "@/db/schema";
import { env } from "@Polyedro-abs/env/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/** Voice Agent: convierte el guion de video de una campaña en voiceovers ES y EN
 *  con ElevenLabs, hostea el mp3 en Supabase Storage y guarda audioUrl, voiceId y
 *  settings en `voiceovers` (una fila por idioma, colgada del video_script). Sin
 *  ELEVENLABS_API_KEY cae a modo fallback (fila sin audio, provider="fallback"),
 *  igual que los otros agentes no bloquean por falta de key. */

type Language = "es" | "en";
const LANGUAGES: readonly Language[] = ["es", "en"] as const;

export type VoiceoverProvider = "elevenlabs" | "fallback";
type RunProvider = VoiceoverProvider | "mixed";

/** Ajustes de voz por defecto (balance naturalidad/estabilidad para locución
 *  de ads cortos); se guardan en settings para trazabilidad y regeneración. */
const VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
};

type VideoScene = {
  dialogue?: string;
};

type VoiceAgentContext = {
  campaign: { id: string; name: string; objective: string };
  brand: { name: string };
  script: { id: string; scenes: VideoScene[] | null };
  adCopies: {
    language: string;
    headline: string | null;
    primaryText: string | null;
    callToAction: string | null;
  }[];
};

const loadVoiceContext = async (
  campaignId: string,
  scriptId?: string,
): Promise<VoiceAgentContext> => {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      brand: true,
      adCopies: true,
      videoScripts: {
        orderBy: (scriptRows, { desc }) => [desc(scriptRows.createdAt)],
      },
    },
  });

  if (!campaign) {
    throw new ApiError(404, "Campaign not found");
  }

  const script = scriptId
    ? campaign.videoScripts.find((row) => row.id === scriptId)
    : campaign.videoScripts[0];

  if (!script) {
    throw new ApiError(409, "Generate a video script before voiceovers");
  }

  return {
    campaign: { id: campaign.id, name: campaign.name, objective: campaign.objective },
    brand: { name: campaign.brand.name },
    script: { id: script.id, scenes: script.scenes },
    adCopies: campaign.adCopies.map((copy) => ({
      language: copy.language,
      headline: copy.headline,
      primaryText: copy.primaryText,
      callToAction: copy.callToAction,
    })),
  };
};

const joinCopy = (copy: VoiceAgentContext["adCopies"][number] | undefined): string | null => {
  if (!copy) {
    return null;
  }
  const parts = [copy.headline, copy.primaryText, copy.callToAction]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(" ") : null;
};

/** Narración ES = los diálogos del guion en orden. Fallback: copy ES, luego un
 *  template mínimo con marca y objetivo (para no mandar texto vacío a TTS). */
const buildEsNarration = (context: VoiceAgentContext): string => {
  const lines = (context.script.scenes ?? [])
    .map((scene) => scene?.dialogue?.trim())
    .filter((line): line is string => !!line);
  if (lines.length > 0) {
    return lines.join(" ");
  }
  return (
    joinCopy(context.adCopies.find((copy) => copy.language === "es")) ??
    `${context.brand.name}. ${context.campaign.objective}`
  );
};

const englishNarrationSchema = z.strictObject({ text: z.string() });

/** Traduce la narración ES a EN con el LLM compartido. Devuelve null si el LLM
 *  no está configurado o la traducción falla, para que el caller use fallback. */
const translateToEnglish = async (esNarration: string): Promise<string | null> => {
  if (!isLlmConfigured()) {
    return null;
  }
  try {
    const { text } = await generateStructuredObject({
      schema: englishNarrationSchema,
      schemaName: "voiceover_translation",
      system:
        "You translate Latin American Spanish marketing voiceover narration into natural, " +
        "concise English for a short Meta/Reels ad. Preserve the meaning, tone, and rough " +
        "length. Return only the spoken English narration, no quotes or notes.",
      prompt: esNarration,
    });
    return text.trim() || null;
  } catch (error) {
    console.error("Voiceover EN translation failed, using fallback:", error);
    return null;
  }
};

/** Narración EN = traducción de la ES; fallback a copy EN y luego template. */
const buildEnNarration = async (
  esNarration: string,
  context: VoiceAgentContext,
): Promise<string> => {
  const translated = await translateToEnglish(esNarration);
  if (translated) {
    return translated;
  }
  return (
    joinCopy(context.adCopies.find((copy) => copy.language === "en")) ??
    `${context.brand.name}. ${context.campaign.objective}`
  );
};

const resolveVoiceId = (language: Language): string =>
  language === "en" ? (env.ELEVENLABS_VOICE_ID_EN ?? env.ELEVENLABS_VOICE_ID) : env.ELEVENLABS_VOICE_ID;

type VoiceoverResult = {
  voiceId: string;
  audioUrl: string | null;
  durationSeconds: number;
  provider: VoiceoverProvider;
};

const generateVoiceover = async (
  language: Language,
  text: string,
): Promise<VoiceoverResult> => {
  const voiceId = resolveVoiceId(language);

  if (!isElevenLabsConfigured()) {
    return { voiceId, audioUrl: null, durationSeconds: estimateDurationSeconds(text), provider: "fallback" };
  }

  try {
    const { bytes, durationSeconds } = await synthesizeSpeech({
      text,
      voiceId,
      modelId: env.ELEVENLABS_MODEL,
      voiceSettings: VOICE_SETTINGS,
    });
    const audioUrl = await uploadGeneratedAsset({
      bytes,
      contentType: "audio/mpeg",
      keyPrefix: "voiceovers",
      extension: "mp3",
    });
    return { voiceId, audioUrl, durationSeconds, provider: "elevenlabs" };
  } catch (error) {
    console.error(`ElevenLabs voiceover (${language}) failed, using fallback:`, error);
    return { voiceId, audioUrl: null, durationSeconds: estimateDurationSeconds(text), provider: "fallback" };
  }
};

const upsertVoiceover = async (
  videoScriptId: string,
  language: Language,
  result: VoiceoverResult,
  text: string,
) => {
  const existing = await db.query.voiceovers.findFirst({
    where: and(eq(voiceovers.videoScriptId, videoScriptId), eq(voiceovers.language, language)),
  });
  const values = {
    videoScriptId,
    language,
    status: "review" as const,
    voiceId: result.voiceId,
    audioUrl: result.audioUrl,
    durationSeconds: result.durationSeconds,
    settings: {
      provider: result.provider,
      model: env.ELEVENLABS_MODEL,
      voiceSettings: VOICE_SETTINGS,
      text,
    },
  };

  const [row] = existing
    ? await db.update(voiceovers).set(values).where(eq(voiceovers.id, existing.id)).returning()
    : await db.insert(voiceovers).values(values).returning();

  return requireOne(row, "Voiceover could not be saved");
};

const summarizeProvider = (providers: VoiceoverProvider[]): RunProvider => {
  if (providers.every((provider) => provider === "elevenlabs")) {
    return "elevenlabs";
  }
  if (providers.some((provider) => provider === "elevenlabs")) {
    return "mixed";
  }
  return "fallback";
};

/** Marca las filas ya existentes de los idiomas objetivo como "generating" y lo
 *  emite por SSE, para que el UI muestre progreso mientras corre la síntesis. */
const markGenerating = async (
  campaignId: string,
  videoScriptId: string,
  targetLanguages: readonly Language[],
) => {
  const existing = await db.query.voiceovers.findMany({
    where: eq(voiceovers.videoScriptId, videoScriptId),
  });
  for (const language of targetLanguages) {
    const row = existing.find((candidate) => candidate.language === language);
    if (row) {
      await db.update(voiceovers).set({ status: "generating" }).where(eq(voiceovers.id, row.id));
      emitAssetUpdated(campaignId, { target: "voiceover", id: row.id, status: "generating", language });
    }
  }
};

export const runVoiceAgent = async (
  campaignId: string,
  input: { scriptId?: string; languages?: readonly Language[] } = {},
) => {
  const context = await loadVoiceContext(campaignId, input.scriptId);
  const targetLanguages = input.languages ?? LANGUAGES;
  emitAgentStarted(campaignId, "voice", { languages: targetLanguages });
  emitAgentLog(
    campaignId,
    "voice",
    isElevenLabsConfigured()
      ? "Synthesizing voiceovers with ElevenLabs"
      : "ELEVENLABS_API_KEY not set — creating fallback voiceovers (no audio)",
  );

  try {
    await markGenerating(campaignId, context.script.id, targetLanguages);

    // La narración ES viene del guion; la EN se traduce de la ES (fuente aunque
    // no se regenere ES). Solo se traduce si EN es un idioma objetivo.
    const esNarration = buildEsNarration(context);
    const narrations: Record<Language, string> = {
      es: esNarration,
      en: targetLanguages.includes("en") ? await buildEnNarration(esNarration, context) : esNarration,
    };

    const rows: (typeof voiceovers.$inferSelect)[] = [];
    const providers: VoiceoverProvider[] = [];

    for (const language of targetLanguages) {
      const text = narrations[language];
      const result = await generateVoiceover(language, text);
      const row = await upsertVoiceover(context.script.id, language, result, text);
      rows.push(row);
      providers.push(result.provider);
      emitAssetUpdated(campaignId, {
        target: "voiceover",
        id: row.id,
        status: row.status,
        language,
      });
      emitAgentLog(campaignId, "voice", `Voiceover ready (${language}, provider: ${result.provider})`, {
        language,
        provider: result.provider,
      });
    }

    await db.update(campaigns).set({ status: "review" }).where(eq(campaigns.id, campaignId));

    const provider = summarizeProvider(providers);
    emitAgentCompleted(campaignId, "voice", "succeeded", { provider, count: rows.length });

    return {
      voiceovers: rows,
      generation: {
        triggered: true,
        agent: "Voice Agent",
        provider,
        steps: [
          "voiceover.generating",
          ...targetLanguages.map((language, index) => `voiceover.${language}:${providers[index]}`),
          "voiceover.completed:review",
        ],
      },
    };
  } catch (error) {
    emitAgentCompleted(campaignId, "voice", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/** Regenera solo la voiceover pedida (su idioma), preservando el estado de la
 *  otra: regenerar EN no debe des-aprobar la ES ya aprobada. */
export const regenerateVoiceover = async (campaignId: string, voiceoverId: string) => {
  const voiceover = await db.query.voiceovers.findFirst({
    where: eq(voiceovers.id, voiceoverId),
    with: { videoScript: true },
  });

  if (!voiceover || !voiceover.videoScript || voiceover.videoScript.campaignId !== campaignId) {
    throw new ApiError(404, "Voiceover not found for this campaign");
  }

  return runVoiceAgent(campaignId, {
    scriptId: voiceover.videoScriptId,
    languages: [voiceover.language],
  });
};
