import { generateStructuredObject, isLlmConfigured } from "@/api/services/ai";
import {
  emitAgentCompleted,
  emitAgentLog,
  emitAgentStarted,
  emitAssetUpdated,
} from "@/api/services/progress";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { campaigns, videoScripts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const SCRIPT_LANGUAGE = "es" as const;

const videoSceneSchema = z.strictObject({
  sceneNumber: z.number(),
  description: z.string(),
  dialogue: z.string(),
  durationSeconds: z.number(),
});

const videoScriptContentSchema = z.strictObject({
  title: z.string(),
  scenes: z.array(videoSceneSchema).min(3).max(5),
  durationSeconds: z.number(),
});

export type VideoScriptContent = z.infer<typeof videoScriptContentSchema>;
export type VideoScriptProvider = "openai" | "fallback";

type VideoAgentContext = {
  campaign: { id: string; name: string; objective: string };
  brand: { name: string; description: string | null; industry: string | null };
  brandKit: {
    toneOfVoice: unknown;
    valueProposition: unknown;
    keyMessages: unknown;
    buyerPersona: unknown;
    visualStyle: unknown;
  } | null;
  strategy: {
    commercialAngle: string | null;
    audience: unknown;
    notes: string | null;
  } | null;
  adCopies: {
    language: string;
    variant: string;
    headline: string | null;
    primaryText: string | null;
    description: string | null;
    callToAction: string | null;
  }[];
  creativeAssets: {
    variant: string;
    prompt: string | null;
    altText: string | null;
  }[];
};

const loadVideoAgentContext = async (campaignId: string): Promise<VideoAgentContext> => {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      brand: {
        with: {
          brandKit: true,
        },
      },
      strategy: true,
      adCopies: true,
      creativeAssets: true,
    },
  });

  if (!campaign) {
    throw new ApiError(404, "Campaign not found");
  }

  const kit = campaign.brand.brandKit;

  return {
    campaign: { id: campaign.id, name: campaign.name, objective: campaign.objective },
    brand: {
      name: campaign.brand.name,
      description: campaign.brand.description,
      industry: campaign.brand.industry,
    },
    brandKit: kit
      ? {
          toneOfVoice: kit.toneOfVoice,
          valueProposition: kit.valueProposition,
          keyMessages: kit.keyMessages,
          buyerPersona: kit.buyerPersona,
          visualStyle: kit.visualStyle,
        }
      : null,
    strategy: campaign.strategy
      ? {
          commercialAngle: campaign.strategy.commercialAngle,
          audience: campaign.strategy.audience,
          notes: campaign.strategy.notes,
        }
      : null,
    adCopies: campaign.adCopies.map((copy) => ({
      language: copy.language,
      variant: copy.variant,
      headline: copy.headline,
      primaryText: copy.primaryText,
      description: copy.description,
      callToAction: copy.callToAction,
    })),
    creativeAssets: campaign.creativeAssets.map((asset) => ({
      variant: asset.variant,
      prompt: asset.prompt,
      altText: asset.altText,
    })),
  };
};

const SYSTEM_PROMPT =
  "You are the Video Agent for Polyedro, an AI marketing platform for personal brands and small " +
  "businesses in Latin America. Given campaign context, produce a short vertical Meta/Reels video " +
  "script as JSON matching the schema. Rules: write in natural Latin American Spanish; scenes must " +
  "be ordered with sceneNumber starting at 1; each description must be concrete and filmable; each " +
  "dialogue line must be short enough for voiceover; durationSeconds must be an integer-like number; " +
  "total duration should be 12-20 seconds; ground the hook and CTA in the campaign strategy, approved " +
  "ad copy, brand tone, and creative direction when available. Never use placeholder text like Lorem " +
  "or TBD.";

const buildUserPrompt = (context: VideoAgentContext) =>
  `Campaign: ${context.campaign.name}\n` +
  `Objective: ${context.campaign.objective}\n` +
  `Brand: ${context.brand.name} (${context.brand.industry ?? "Emerging business"})\n` +
  `Brand description: ${context.brand.description ?? "n/a"}\n` +
  `Commercial angle: ${context.strategy?.commercialAngle ?? "n/a"}\n` +
  `Audience: ${JSON.stringify(context.strategy?.audience ?? {})}\n` +
  `Strategy notes: ${context.strategy?.notes ?? "n/a"}\n` +
  `Brand kit context: ${JSON.stringify(context.brandKit ?? {})}\n` +
  `Ad copies: ${JSON.stringify(context.adCopies)}\n` +
  `Creative assets: ${JSON.stringify(context.creativeAssets)}\n\n` +
  "Generate one Spanish video script for a short Meta/Reels ad.";

const buildFallbackContent = (context: VideoAgentContext): VideoScriptContent => {
  const brandName = context.brand.name;
  const objective = context.campaign.objective;
  const angle =
    context.strategy?.commercialAngle ??
    `${brandName} convierte una necesidad clara en una decision facil.`;

  return {
    title: `${brandName} - guion corto`,
    scenes: [
      {
        sceneNumber: 1,
        description: `Hook visual: una persona enfrenta el problema que ${brandName} resuelve.`,
        dialogue: `${brandName} existe para esto: ${objective}.`,
        durationSeconds: 4,
      },
      {
        sceneNumber: 2,
        description: `Close-up del producto o servicio con un beneficio principal en pantalla.`,
        dialogue: angle,
        durationSeconds: 5,
      },
      {
        sceneNumber: 3,
        description: `Prueba social o detalle de uso real con ritmo rapido.`,
        dialogue: "Menos friccion, mas valor desde el primer contacto.",
        durationSeconds: 4,
      },
      {
        sceneNumber: 4,
        description: `End card con marca, oferta y llamado a la accion.`,
        dialogue: "Descubre la propuesta y toma accion hoy.",
        durationSeconds: 4,
      },
    ],
    durationSeconds: 17,
  };
};

const normalizeVideoScriptContent = (content: VideoScriptContent): VideoScriptContent => {
  const scenes = content.scenes.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
    durationSeconds: Math.max(1, Math.round(scene.durationSeconds)),
  }));
  const durationSeconds = scenes.reduce((total, scene) => total + scene.durationSeconds, 0);

  return {
    ...content,
    scenes,
    durationSeconds: durationSeconds > 0 ? durationSeconds : Math.max(1, Math.round(content.durationSeconds)),
  };
};

const generateVideoScriptContent = async (
  context: VideoAgentContext,
): Promise<{ content: VideoScriptContent; provider: VideoScriptProvider }> => {
  if (!isLlmConfigured()) {
    return { content: buildFallbackContent(context), provider: "fallback" };
  }

  try {
    const content = await generateStructuredObject({
      schema: videoScriptContentSchema,
      schemaName: "video_script_content",
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(context),
    });

    return { content: normalizeVideoScriptContent(content), provider: "openai" };
  } catch (error) {
    console.error(
      `Video script generation failed for campaign "${context.campaign.name}", using fallback:`,
      error,
    );
    return { content: buildFallbackContent(context), provider: "fallback" };
  }
};

const upsertGeneratingScript = async (campaignId: string, scriptId?: string) => {
  const existing = scriptId
    ? await db.query.videoScripts.findFirst({
        where: and(eq(videoScripts.id, scriptId), eq(videoScripts.campaignId, campaignId)),
      })
    : await db.query.videoScripts.findFirst({
        where: and(
          eq(videoScripts.campaignId, campaignId),
          eq(videoScripts.language, SCRIPT_LANGUAGE),
        ),
      });

  const [script] = existing
    ? await db
        .update(videoScripts)
        .set({ status: "generating" })
        .where(eq(videoScripts.id, existing.id))
        .returning()
    : await db
        .insert(videoScripts)
        .values({ campaignId, language: SCRIPT_LANGUAGE, status: "generating" })
        .returning();

  return requireOne(script, "Video script generation could not be started");
};

export const runVideoAgent = async (campaignId: string, input: { scriptId?: string } = {}) => {
  const context = await loadVideoAgentContext(campaignId);
  emitAgentStarted(campaignId, "video", { language: SCRIPT_LANGUAGE });

  const script = await upsertGeneratingScript(campaignId, input.scriptId);
  emitAssetUpdated(campaignId, {
    target: "video_script",
    id: script.id,
    status: "generating",
    language: SCRIPT_LANGUAGE,
  });
  emitAgentLog(campaignId, "video", "Generating video script scenes");

  try {
    const { content, provider } = await generateVideoScriptContent(context);
    emitAgentLog(campaignId, "video", `Video script ready (provider: ${provider})`, {
      provider,
      scenes: content.scenes.length,
    });

    const [updated] = await db
      .update(videoScripts)
      .set({ status: "review", language: SCRIPT_LANGUAGE, ...content })
      .where(eq(videoScripts.id, script.id))
      .returning();

    const completed = requireOne(updated, "Video script could not be updated");

    await db
      .update(campaigns)
      .set({ status: "review" })
      .where(eq(campaigns.id, campaignId));

    emitAssetUpdated(campaignId, {
      target: "video_script",
      id: completed.id,
      status: completed.status,
      language: completed.language,
    });
    emitAgentCompleted(campaignId, "video", "succeeded", {
      provider,
      scenes: content.scenes.length,
      status: completed.status,
    });

    return {
      script: completed,
      generation: {
        triggered: true,
        agent: "Video Agent",
        provider,
        status: completed.status,
        steps: [
          "video_script.generating",
          `video_script.content:${provider}`,
          "video_script.completed:review",
        ],
      },
    };
  } catch (error) {
    await db
      .update(videoScripts)
      .set({ status: "draft" })
      .where(eq(videoScripts.id, script.id));
    emitAssetUpdated(campaignId, {
      target: "video_script",
      id: script.id,
      status: "draft",
      language: SCRIPT_LANGUAGE,
    });
    emitAgentCompleted(campaignId, "video", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

export const regenerateVideoScript = async (campaignId: string, scriptId: string) => {
  const script = await db.query.videoScripts.findFirst({
    where: and(eq(videoScripts.id, scriptId), eq(videoScripts.campaignId, campaignId)),
  });

  if (!script) {
    throw new ApiError(404, "Video script not found for this campaign");
  }

  return runVideoAgent(campaignId, { scriptId });
};
