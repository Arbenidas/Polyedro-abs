import { generateStructuredObject, isLlmConfigured } from "@/api/services/ai";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { campaignStrategies, campaigns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/** Strategy Agent: genera el contenido de campaign_strategies (audiencia,
 *  segmentación para Meta Ads, ángulo comercial y notas) con OpenAI vía el
 *  wrapper compartido de Vercel AI SDK, con transición draft → generating →
 *  review. Sin OPENAI_API_KEY (o ante cualquier error del LLM) cae a
 *  contenido template para que la creación de campañas nunca falle. */

/** Shapes espejo de los $type de campaign_strategies. Para structured output
 *  estricto todos los campos son requeridos (superset de los opcionales de la
 *  DB, así que sigue siendo asignable). `segmentation` alimenta el payload de
 *  export a Meta Ads — mantener el shape estable. */
const strategyContentSchema = z.strictObject({
  audience: z.strictObject({
    description: z.string(),
    ageRange: z.string(),
    locations: z.array(z.string()),
    interests: z.array(z.string()),
  }),
  segmentation: z.strictObject({
    ageMin: z.number(),
    ageMax: z.number(),
    genders: z.array(z.string()),
    locations: z.array(z.string()),
    interests: z.array(z.string()),
    placements: z.array(z.string()),
  }),
  // Lo consume el Creative Agent en su prompt de imagen — debe ser concreto.
  commercialAngle: z.string(),
  notes: z.string(),
});

export type StrategyContent = z.infer<typeof strategyContentSchema>;

type StrategyContext = {
  campaign: { id: string; name: string; objective: string };
  brand: { name: string; description: string | null; industry: string | null };
  brandKit: {
    buyerPersona: unknown;
    valueProposition: unknown;
    keyMessages: unknown;
    toneOfVoice: unknown;
  } | null;
};

const loadStrategyContext = async (campaignId: string): Promise<StrategyContext> => {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      brand: {
        with: {
          brandKit: true,
        },
      },
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
          buyerPersona: kit.buyerPersona,
          valueProposition: kit.valueProposition,
          keyMessages: kit.keyMessages,
          toneOfVoice: kit.toneOfVoice,
        }
      : null,
  };
};

const SYSTEM_PROMPT =
  "You are the Strategy Agent for Polyedro, an AI marketing platform for personal brands and small " +
  "businesses running Meta Ads in Latin America. Given a campaign brief, produce a campaign strategy " +
  "as JSON matching the provided schema. Rules: ground the audience in the brand's buyer persona and " +
  "the campaign objective; segmentation must be realistic for Meta Ads (integer ageMin/ageMax between " +
  "18 and 65, genders like \"all\" or \"female\"/\"male\", concrete geo locations, 3-6 interest targets, " +
  "and placements from: Facebook Feed, Instagram Feed, Instagram Reels, Instagram Stories, Audience " +
  "Network). commercialAngle is ONE sharp selling angle in a single sentence — it will seed image " +
  "prompts. notes covers funnel split and budget guidance in 1-3 sentences. Never use placeholder " +
  'text like "Lorem" or "TBD".';

const buildUserPrompt = (context: StrategyContext) =>
  `Campaign: ${context.campaign.name}\n` +
  `Objective: ${context.campaign.objective}\n` +
  `Brand: ${context.brand.name} (${context.brand.industry ?? "Emerging business"})\n` +
  `Brand description: ${context.brand.description ?? "n/a"}\n` +
  `Brand kit context: ${JSON.stringify(context.brandKit ?? {})}\n\n` +
  "Generate the campaign strategy.";

/** Contenido template usado sin OPENAI_API_KEY o si el LLM falla (adaptado
 *  de la estrategia del seed demo, parametrizado por marca/campaña). */
const buildFallbackContent = (context: StrategyContext): StrategyContent => ({
  audience: {
    description:
      `People in Latin America who match ${context.brand.name}'s buyer profile and respond to: ${context.campaign.objective}`,
    ageRange: "18-40",
    locations: ["Mexico", "Colombia", "Peru", "Chile"],
    interests: ["online shopping", "small business products", "deals and launches"],
  },
  segmentation: {
    ageMin: 18,
    ageMax: 40,
    genders: ["all"],
    locations: ["Latin America"],
    interests: ["Online shopping", "Consumer trends", "Entrepreneurship"],
    placements: ["Instagram Reels", "Facebook Feed", "Instagram Stories"],
  },
  commercialAngle: `${context.brand.name}: clear value, modern brand, made for ${context.campaign.objective.toLowerCase()}`,
  notes:
    "Funnel: 60% cold, 25% retargeting, 15% lookalike. Optimize for conversions; start broad and narrow by engagement.",
});

export type StrategyProvider = "openai" | "fallback";

/** Nunca lanza: cualquier fallo del LLM cae al contenido template. */
const generateStrategyContent = async (
  context: StrategyContext,
): Promise<{ content: StrategyContent; provider: StrategyProvider }> => {
  if (!isLlmConfigured()) {
    return { content: buildFallbackContent(context), provider: "fallback" };
  }

  try {
    const content = await generateStructuredObject({
      schema: strategyContentSchema,
      schemaName: "campaign_strategy_content",
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(context),
    });

    return { content, provider: "openai" };
  } catch (error) {
    console.error(
      `Strategy generation failed for campaign "${context.campaign.name}", using fallback:`,
      error,
    );
    return { content: buildFallbackContent(context), provider: "fallback" };
  }
};

/** Corre el agente sobre la estrategia (única por campaña) de una campaña:
 *  upsert a "generating" → contenido → "review", y marca la campaña en
 *  "review" (mismo roll-up que el Creative Agent). Ante un fallo duro (DB)
 *  revierte la estrategia a "draft" y relanza. */
export const runStrategyAgent = async (campaignId: string) => {
  const context = await loadStrategyContext(campaignId);

  const existing = await db.query.campaignStrategies.findFirst({
    where: eq(campaignStrategies.campaignId, campaignId),
  });

  const [generatingStrategy] = existing
    ? await db
        .update(campaignStrategies)
        .set({ status: "generating" })
        .where(eq(campaignStrategies.id, existing.id))
        .returning()
    : await db
        .insert(campaignStrategies)
        .values({ campaignId, status: "generating" })
        .returning();

  const strategy = requireOne(
    generatingStrategy,
    "Strategy generation could not be started",
  );

  try {
    const { content, provider } = await generateStrategyContent(context);

    const [updated] = await db
      .update(campaignStrategies)
      .set({ status: "review", ...content })
      .where(eq(campaignStrategies.id, strategy.id))
      .returning();

    const completed = requireOne(updated, "Strategy could not be updated");

    await db
      .update(campaigns)
      .set({ status: "review" })
      .where(eq(campaigns.id, campaignId));

    return {
      strategy: completed,
      generation: {
        triggered: true,
        agent: "Strategy Agent",
        provider,
        status: completed.status,
        steps: [
          "strategy.generating",
          `strategy.content:${provider}`,
          "strategy.completed:review",
        ],
      },
    };
  } catch (error) {
    await db
      .update(campaignStrategies)
      .set({ status: "draft" })
      .where(eq(campaignStrategies.id, strategy.id));
    throw error;
  }
};

/** Regeneración desde el flujo approve/regenerate: valida que la estrategia
 *  pertenezca a la campaña (404 como el resto de targets) y re-corre el
 *  agente sobre esa fila. */
export const regenerateStrategy = async (campaignId: string, strategyId: string) => {
  const strategy = await db.query.campaignStrategies.findFirst({
    where: and(
      eq(campaignStrategies.id, strategyId),
      eq(campaignStrategies.campaignId, campaignId),
    ),
  });

  if (!strategy) {
    throw new ApiError(404, "Strategy not found for this campaign");
  }

  return runStrategyAgent(campaignId);
};
