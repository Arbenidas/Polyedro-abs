import {
  type GeneratedImage,
  generateFalImage,
  isFalConfigured,
} from "@/api/services/fal";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { campaigns, creativeAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Creative Agent — genera creativos estáticos 1080×1080 para Meta Ads con
 *  Flux vía Fal.ai (FLUX.2 por defecto), en variantes A/B. Sin FAL_KEY el
 *  agente cae a imágenes placeholder para no romper la demo. */

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1080;

type Variant = "a" | "b";

const VARIANTS: Variant[] = ["a", "b"];

type CreativeContext = {
  campaign: { id: string; name: string; objective: string };
  brand: { name: string; description: string | null; industry: string | null };
  brandKit: {
    colorPalette: { primary: string; secondary: string; accent: string } | null;
    visualStyle: { mood?: string; imageryStyle?: string; typography?: string } | null;
    keyMessages: { es: string[]; en: string[] } | null;
  } | null;
  strategy: { commercialAngle: string | null } | null;
};

const loadCreativeContext = async (campaignId: string): Promise<CreativeContext> => {
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

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
    },
    brand: {
      name: campaign.brand.name,
      description: campaign.brand.description,
      industry: campaign.brand.industry,
    },
    brandKit: campaign.brand.brandKit,
    strategy: campaign.strategy,
  };
};

/** Cada variante ataca un ángulo distinto para el test A/B: A es hero de
 *  producto, B es tipográfica orientada a beneficio. */
const VARIANT_DIRECTIONS: Record<Variant, string> = {
  a: "Hero product shot composition: the product front and center on a bold flat background, dramatic studio lighting, generous negative space for ad overlay text.",
  b: "Benefit-led typographic layout: oversized bold sans-serif headline as the main visual element, product shown small in a corner, high-contrast color blocking.",
};

const buildPrompt = (context: CreativeContext, variant: Variant) => {
  const palette = context.brandKit?.colorPalette;
  const style = context.brandKit?.visualStyle;
  const keyMessage =
    context.brandKit?.keyMessages?.en?.[0] ?? context.brandKit?.keyMessages?.es?.[0];

  const parts = [
    `Static square advertising creative for a Meta Ads campaign by ${context.brand.name}` +
      (context.brand.industry ? ` (${context.brand.industry})` : "") +
      ".",
    `Campaign goal: ${context.campaign.objective}.`,
    context.strategy?.commercialAngle
      ? `Commercial angle: ${context.strategy.commercialAngle}.`
      : undefined,
    keyMessage ? `Key message to convey visually: ${keyMessage}.` : undefined,
    VARIANT_DIRECTIONS[variant],
    style?.mood ? `Mood: ${style.mood}.` : undefined,
    style?.imageryStyle ? `Imagery style: ${style.imageryStyle}.` : undefined,
    palette
      ? `Brand color palette: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}.`
      : undefined,
    "Professional commercial photography quality, crisp product detail, no watermarks, no brand logos of real companies.",
  ];

  return parts.filter(Boolean).join(" ");
};

const buildAltText = (context: CreativeContext, variant: Variant) => {
  const angle =
    variant === "a"
      ? "product hero shot"
      : "bold typographic benefit layout";

  return `${context.brand.name} — ${context.campaign.name}: 1080×1080 ad creative (${angle}), variant ${variant.toUpperCase()}.`;
};

const buildPlaceholderImage = (context: CreativeContext, variant: Variant): GeneratedImage => {
  const background = (context.brandKit?.colorPalette?.primary ?? "#B7FF1A").replace("#", "");
  const text = encodeURIComponent(`${context.brand.name}\nVariant ${variant.toUpperCase()}`);

  return {
    url: `https://placehold.co/${IMAGE_WIDTH}x${IMAGE_HEIGHT}/${background}/111111/png?text=${text}`,
    provider: "placeholder",
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  };
};

const generateImage = async (
  context: CreativeContext,
  variant: Variant,
  prompt: string,
): Promise<GeneratedImage> => {
  if (!isFalConfigured()) {
    return buildPlaceholderImage(context, variant);
  }

  return generateFalImage({ prompt, width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
};

const buildMetadata = (image: GeneratedImage) => ({
  provider: image.provider,
  model: image.model,
  seed: image.seed,
  width: image.width,
  height: image.height,
  format: "meta_ads_static",
  generatedAt: new Date().toISOString(),
});

const upsertGeneratingAsset = async (campaignId: string, variant: Variant) => {
  const existing = await db.query.creativeAssets.findFirst({
    where: and(eq(creativeAssets.campaignId, campaignId), eq(creativeAssets.variant, variant)),
  });

  if (existing) {
    const [updated] = await db
      .update(creativeAssets)
      .set({ status: "generating" })
      .where(eq(creativeAssets.id, existing.id))
      .returning();
    return requireOne(updated, "Creative asset could not be updated");
  }

  const [created] = await db
    .insert(creativeAssets)
    .values({ campaignId, variant, status: "generating" })
    .returning();

  return requireOne(created, "Creative asset could not be created");
};

const generateVariant = async (context: CreativeContext, assetId: string, variant: Variant) => {
  const prompt = buildPrompt(context, variant);

  try {
    const image = await generateImage(context, variant, prompt);
    const [updated] = await db
      .update(creativeAssets)
      .set({
        status: "review",
        imageUrl: image.url,
        prompt,
        altText: buildAltText(context, variant),
        metadata: buildMetadata(image),
      })
      .where(eq(creativeAssets.id, assetId))
      .returning();

    return requireOne(updated, "Creative asset could not be updated");
  } catch (error) {
    await db
      .update(creativeAssets)
      .set({
        status: "draft",
        metadata: {
          provider: "fal.ai",
          error: error instanceof Error ? error.message : "Unknown generation error",
          failedAt: new Date().toISOString(),
        },
      })
      .where(eq(creativeAssets.id, assetId));

    throw error;
  }
};

/** Corre el Creative Agent completo: variantes A y B en paralelo. */
export const runCreativeAgent = async (campaignId: string) => {
  const context = await loadCreativeContext(campaignId);

  const pending = await Promise.all(
    VARIANTS.map(async (variant) => ({
      variant,
      asset: await upsertGeneratingAsset(campaignId, variant),
    })),
  );

  const results = await Promise.allSettled(
    pending.map(({ variant, asset }) => generateVariant(context, asset.id, variant)),
  );

  const assets = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) =>
      result.reason instanceof Error ? result.reason.message : "Unknown generation error",
    );

  if (assets.length === 0) {
    throw new ApiError(500, "Creative Agent could not generate any variant", { failures });
  }

  await db.update(campaigns).set({ status: "review" }).where(eq(campaigns.id, campaignId));

  return { assets, failures };
};

/** Regenera un solo creativo existente conservando su variante. */
export const regenerateCreativeAsset = async (campaignId: string, assetId: string) => {
  const asset = await db.query.creativeAssets.findFirst({
    where: and(eq(creativeAssets.id, assetId), eq(creativeAssets.campaignId, campaignId)),
  });

  if (!asset) {
    throw new ApiError(404, "Creative asset not found for this campaign");
  }

  const context = await loadCreativeContext(campaignId);

  await db
    .update(creativeAssets)
    .set({ status: "generating" })
    .where(eq(creativeAssets.id, asset.id));

  return generateVariant(context, asset.id, asset.variant);
};
