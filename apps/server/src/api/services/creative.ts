import { type ImageRequest, generateImage } from "@/api/services/images";
import {
  emitAgentCompleted,
  emitAgentLog,
  emitAgentStarted,
  emitAssetUpdated,
} from "@/api/services/progress";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { campaigns, creativeAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Creative Agent — genera creativos estáticos 1080×1080 para Meta Ads en
 *  variantes A/B, vía el provider de imágenes configurado (IMAGE_PROVIDER:
 *  fal/openai/placeholder). Sin keys cae a placeholders y la demo no se
 *  rompe. */

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

const buildImageRequest = (
  context: CreativeContext,
  variant: Variant,
  prompt: string,
): ImageRequest => ({
  prompt,
  width: IMAGE_WIDTH,
  height: IMAGE_HEIGHT,
  placeholder: {
    label: `${context.brand.name}\nVariant ${variant.toUpperCase()}`,
    background: context.brandKit?.colorPalette?.primary,
  },
});

const buildMetadata = (image: Awaited<ReturnType<typeof generateImage>>) => ({
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
  const campaignId = context.campaign.id;
  emitAgentLog(campaignId, "creative", `Generating image for variant ${variant.toUpperCase()}`, {
    variant,
  });

  try {
    const image = await generateImage(buildImageRequest(context, variant, prompt));
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

    const asset = requireOne(updated, "Creative asset could not be updated");
    emitAssetUpdated(campaignId, {
      target: "creative_asset",
      id: asset.id,
      status: asset.status,
      variant,
      imageUrl: asset.imageUrl,
      provider: image.provider,
    });

    return asset;
  } catch (error) {
    await db
      .update(creativeAssets)
      .set({
        status: "draft",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown generation error",
          failedAt: new Date().toISOString(),
        },
      })
      .where(eq(creativeAssets.id, assetId));
    emitAssetUpdated(campaignId, {
      target: "creative_asset",
      id: assetId,
      status: "draft",
      variant,
    });

    throw error;
  }
};

/** Corre el Creative Agent completo: variantes A y B en paralelo. */
export const runCreativeAgent = async (campaignId: string) => {
  const context = await loadCreativeContext(campaignId);
  emitAgentStarted(campaignId, "creative", { variants: VARIANTS });

  const pending = await Promise.all(
    VARIANTS.map(async (variant) => {
      const asset = await upsertGeneratingAsset(campaignId, variant);
      emitAssetUpdated(campaignId, {
        target: "creative_asset",
        id: asset.id,
        status: "generating",
        variant,
      });
      return { variant, asset };
    }),
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
    emitAgentCompleted(campaignId, "creative", "failed", { failures });
    throw new ApiError(500, "Creative Agent could not generate any variant", { failures });
  }

  await db.update(campaigns).set({ status: "review" }).where(eq(campaigns.id, campaignId));
  emitAgentCompleted(campaignId, "creative", "succeeded", {
    generated: assets.length,
    failures,
  });

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
  emitAgentStarted(campaignId, "creative", { scope: "regenerate", variant: asset.variant });

  await db
    .update(creativeAssets)
    .set({ status: "generating" })
    .where(eq(creativeAssets.id, asset.id));
  emitAssetUpdated(campaignId, {
    target: "creative_asset",
    id: asset.id,
    status: "generating",
    variant: asset.variant,
  });

  try {
    const regenerated = await generateVariant(context, asset.id, asset.variant);
    emitAgentCompleted(campaignId, "creative", "succeeded", {
      scope: "regenerate",
      variant: asset.variant,
    });
    return regenerated;
  } catch (error) {
    emitAgentCompleted(campaignId, "creative", "failed", {
      scope: "regenerate",
      variant: asset.variant,
      error: error instanceof Error ? error.message : "Unknown generation error",
    });
    throw error;
  }
};
