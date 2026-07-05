import { generateStructuredObject, isLlmConfigured } from "@/api/services/ai";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { adCopies, campaigns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/** Meta Ads Agent: genera ad_copies (headline, primaryText, description,
 *  callToAction) en ES/EN con variantes A/B — 4 filas por campaña, upsert
 *  por campaignId + language + variant (no hay unique en DB; la app es la
 *  dueña de la combinación, igual que el seed). Una sola llamada al LLM
 *  devuelve la matriz completa para diferenciar A/B deliberadamente y
 *  mantener equivalencia ES/EN. Sin OPENAI_API_KEY (o ante error del LLM)
 *  cae a copy template para que el flujo nunca falle. */

const LANGUAGES = ["es", "en"] as const;
const VARIANTS = ["a", "b"] as const;

type Language = (typeof LANGUAGES)[number];
type Variant = (typeof VARIANTS)[number];

const adCopyContentSchema = z.strictObject({
  headline: z.string(),
  primaryText: z.string(),
  description: z.string(),
  callToAction: z.string(),
});

const variantPairSchema = z.strictObject({
  a: adCopyContentSchema,
  b: adCopyContentSchema,
});

const adCopyMatrixSchema = z.strictObject({
  es: variantPairSchema,
  en: variantPairSchema,
});

export type AdCopyContent = z.infer<typeof adCopyContentSchema>;
type AdCopyMatrix = z.infer<typeof adCopyMatrixSchema>;

type MetaAdsContext = {
  campaign: { id: string; name: string; objective: string };
  brand: { name: string; description: string | null; industry: string | null };
  brandKit: {
    toneOfVoice: unknown;
    valueProposition: unknown;
    keyMessages: unknown;
    buyerPersona: unknown;
  } | null;
  strategy: { commercialAngle: string | null; audience: unknown } | null;
};

const loadMetaAdsContext = async (campaignId: string): Promise<MetaAdsContext> => {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      brand: {
        with: {
          brandKit: true,
        },
      },
      strategy: true,
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
        }
      : null,
    strategy: campaign.strategy
      ? {
          commercialAngle: campaign.strategy.commercialAngle,
          audience: campaign.strategy.audience,
        }
      : null,
  };
};

const SYSTEM_PROMPT =
  "You are the Meta Ads Agent for Polyedro, an AI marketing platform for personal brands and small " +
  "businesses in Latin America. Given a campaign brief, produce Meta Ads copy as JSON matching the " +
  "provided schema: Spanish (es) and English (en), each with variants a and b. Rules: variant a is " +
  "benefit-led; variant b is urgency/offer-led — they must be clearly different angles, not rewordings. " +
  "es and en must carry equivalent meaning with natural Latin American Spanish, never literal " +
  "translations. headline: max ~40 characters, punchy. primaryText: 1-3 sentences, conversion-focused, " +
  "grounded in the commercial angle and tone of voice. description: one short supporting sentence. " +
  'callToAction: a short imperative like "Comprar ahora" / "Shop Now" / "Reserva hoy" / "Pre-order". ' +
  'Never use placeholder text like "Lorem" or "TBD".';

const buildContextPrompt = (context: MetaAdsContext) =>
  `Campaign: ${context.campaign.name}\n` +
  `Objective: ${context.campaign.objective}\n` +
  `Brand: ${context.brand.name} (${context.brand.industry ?? "Emerging business"})\n` +
  `Brand description: ${context.brand.description ?? "n/a"}\n` +
  `Commercial angle: ${context.strategy?.commercialAngle ?? "n/a"}\n` +
  `Audience: ${JSON.stringify(context.strategy?.audience ?? {})}\n` +
  `Brand kit context: ${JSON.stringify(context.brandKit ?? {})}`;

const buildMatrixPrompt = (context: MetaAdsContext) =>
  `${buildContextPrompt(context)}\n\nGenerate the full ad copy matrix (es/en × a/b).`;

const buildSingleCopyPrompt = (
  context: MetaAdsContext,
  language: Language,
  variant: Variant,
) =>
  `${buildContextPrompt(context)}\n\n` +
  `Generate ONE ad copy in ${language === "es" ? "Latin American Spanish" : "English"} ` +
  `as variant "${variant}" (${variant === "a" ? "benefit-led" : "urgency/offer-led"}).`;

/** Copy template usado sin OPENAI_API_KEY o si el LLM falla. */
const buildFallbackCopy = (
  context: MetaAdsContext,
  language: Language,
  variant: Variant,
): AdCopyContent => {
  const name = context.brand.name;
  if (language === "es") {
    return variant === "a"
      ? {
          headline: `${name}: valor claro, sin ruido.`,
          primaryText: `${name} resuelve lo que buscas: ${context.campaign.objective}. Beneficios claros y una marca lista para ti.`,
          description: "Hecho para clientes que comparan antes de comprar.",
          callToAction: "Comprar ahora",
        }
      : {
          headline: `Últimos días: ${name} en oferta.`,
          primaryText: `Aprovecha el lanzamiento de ${name} antes de que termine. ${context.campaign.objective}.`,
          description: "Oferta de lanzamiento por tiempo limitado.",
          callToAction: "Aprovechar oferta",
        };
  }
  return variant === "a"
    ? {
        headline: `${name}: clear value, no noise.`,
        primaryText: `${name} delivers what you're looking for: ${context.campaign.objective}. Clear benefits from a brand built for you.`,
        description: "Made for buyers who compare before they commit.",
        callToAction: "Shop Now",
      }
    : {
        headline: `Last days: ${name} launch deal.`,
        primaryText: `Catch the ${name} launch before it ends. ${context.campaign.objective}.`,
        description: "Limited-time launch offer.",
        callToAction: "Get the Deal",
      };
};

const buildFallbackMatrix = (context: MetaAdsContext): AdCopyMatrix => ({
  es: {
    a: buildFallbackCopy(context, "es", "a"),
    b: buildFallbackCopy(context, "es", "b"),
  },
  en: {
    a: buildFallbackCopy(context, "en", "a"),
    b: buildFallbackCopy(context, "en", "b"),
  },
});

export type AdCopyProvider = "openai" | "fallback";

/** Nunca lanza: cualquier fallo del LLM cae al copy template. */
const generateAdCopyMatrix = async (
  context: MetaAdsContext,
): Promise<{ matrix: AdCopyMatrix; provider: AdCopyProvider }> => {
  if (!isLlmConfigured()) {
    return { matrix: buildFallbackMatrix(context), provider: "fallback" };
  }

  try {
    const matrix = await generateStructuredObject({
      schema: adCopyMatrixSchema,
      schemaName: "ad_copy_matrix",
      system: SYSTEM_PROMPT,
      prompt: buildMatrixPrompt(context),
    });

    return { matrix, provider: "openai" };
  } catch (error) {
    console.error(
      `Ad copy matrix generation failed for campaign "${context.campaign.name}", using fallback:`,
      error,
    );
    return { matrix: buildFallbackMatrix(context), provider: "fallback" };
  }
};

/** Nunca lanza: versión de una sola copy (usada por regenerate). */
const generateSingleAdCopy = async (
  context: MetaAdsContext,
  language: Language,
  variant: Variant,
): Promise<{ content: AdCopyContent; provider: AdCopyProvider }> => {
  if (!isLlmConfigured()) {
    return { content: buildFallbackCopy(context, language, variant), provider: "fallback" };
  }

  try {
    const content = await generateStructuredObject({
      schema: adCopyContentSchema,
      schemaName: "ad_copy_content",
      system: SYSTEM_PROMPT,
      prompt: buildSingleCopyPrompt(context, language, variant),
    });

    return { content, provider: "openai" };
  } catch (error) {
    console.error(
      `Ad copy regeneration failed for campaign "${context.campaign.name}", using fallback:`,
      error,
    );
    return { content: buildFallbackCopy(context, language, variant), provider: "fallback" };
  }
};

const upsertGeneratingCopy = async (
  campaignId: string,
  language: Language,
  variant: Variant,
) => {
  const existing = await db.query.adCopies.findFirst({
    where: and(
      eq(adCopies.campaignId, campaignId),
      eq(adCopies.language, language),
      eq(adCopies.variant, variant),
    ),
  });

  const [copy] = existing
    ? await db
        .update(adCopies)
        .set({ status: "generating" })
        .where(eq(adCopies.id, existing.id))
        .returning()
    : await db
        .insert(adCopies)
        .values({ campaignId, language, variant, status: "generating" })
        .returning();

  return requireOne(copy, "Ad copy generation could not be started");
};

/** Corre el agente sobre las 4 copies (es/en × a/b) de una campaña: upsert a
 *  "generating" → matriz del LLM → "review" por fila, y marca la campaña en
 *  "review" (mismo roll-up que Creative/Strategy). Ante un fallo duro (DB)
 *  revierte las filas a "draft" y relanza. */
export const runMetaAdsAgent = async (campaignId: string) => {
  const context = await loadMetaAdsContext(campaignId);

  const combos = LANGUAGES.flatMap((language) =>
    VARIANTS.map((variant) => ({ language, variant })),
  );

  const generating = await Promise.all(
    combos.map(async ({ language, variant }) => ({
      language,
      variant,
      copy: await upsertGeneratingCopy(campaignId, language, variant),
    })),
  );

  try {
    const { matrix, provider } = await generateAdCopyMatrix(context);

    const copies = await Promise.all(
      generating.map(async ({ language, variant, copy }) => {
        const [updated] = await db
          .update(adCopies)
          .set({ status: "review", ...matrix[language][variant] })
          .where(eq(adCopies.id, copy.id))
          .returning();
        return requireOne(updated, "Ad copy could not be updated");
      }),
    );

    await db
      .update(campaigns)
      .set({ status: "review" })
      .where(eq(campaigns.id, campaignId));

    return {
      copies,
      generation: {
        triggered: true,
        agent: "Meta Ads Agent",
        provider,
        status: "review" as const,
        steps: [
          "ad_copies.generating:4",
          `ad_copies.content:${provider}`,
          "ad_copies.completed:review",
        ],
      },
    };
  } catch (error) {
    await Promise.all(
      generating.map(({ copy }) =>
        db.update(adCopies).set({ status: "draft" }).where(eq(adCopies.id, copy.id)),
      ),
    );
    throw error;
  }
};

/** Regeneración de una sola copy desde el flujo approve/regenerate: valida
 *  pertenencia a la campaña (404 como el resto de targets), conserva su
 *  language/variant y llena también callToAction (el stub anterior no lo
 *  tocaba). */
export const regenerateAdCopy = async (campaignId: string, copyId: string) => {
  const copy = await db.query.adCopies.findFirst({
    where: and(eq(adCopies.id, copyId), eq(adCopies.campaignId, campaignId)),
  });

  if (!copy) {
    throw new ApiError(404, "Ad copy not found for this campaign");
  }

  const context = await loadMetaAdsContext(campaignId);

  await db
    .update(adCopies)
    .set({ status: "generating" })
    .where(eq(adCopies.id, copy.id));

  try {
    const { content } = await generateSingleAdCopy(context, copy.language, copy.variant);

    const [updated] = await db
      .update(adCopies)
      .set({ status: "review", ...content })
      .where(eq(adCopies.id, copy.id))
      .returning();

    return requireOne(updated, "Ad copy could not be updated");
  } catch (error) {
    await db
      .update(adCopies)
      .set({ status: "draft" })
      .where(eq(adCopies.id, copy.id));
    throw error;
  }
};
