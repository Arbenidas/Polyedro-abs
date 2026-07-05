import { regenerateCreativeAsset } from "@/api/services/creative";
import { regenerateAdCopy } from "@/api/services/meta-ads-agent";
import { dispatchCampaignExport } from "@/api/services/n8n";
import { emitAssetUpdated } from "@/api/services/progress";
import { regenerateStrategy, runStrategyAgent } from "@/api/services/strategy-agent";
import { regenerateVideoScript } from "@/api/services/video-agent";
import { regenerateVoiceover } from "@/api/services/voice-agent";
import { ApiError, requireOne } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";
import { db } from "@/db";
import {
  adCopies,
  automationExports,
  brandKits,
  brands,
  campaigns,
  campaignStrategies,
  creativeAssets,
  users,
  videoScripts,
  voiceovers,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

const APPROVED_STATUSES = new Set(["approved", "ready_to_publish"]);

type AssetStatus = "draft" | "generating" | "review" | "approved" | "ready_to_publish" | "rejected";
type Language = "es" | "en";
type Variant = "a" | "b";
export type AssetTarget =
  | "strategy"
  | "ad_copy"
  | "creative_asset"
  | "video_script"
  | "voiceover";

type ProgressBlock = {
  key: string;
  label: string;
  approved: boolean;
  missing: boolean;
};

const isApproved = (status: AssetStatus | null | undefined) =>
  !!status && APPROVED_STATUSES.has(status);

const buildMetaAdsPayload = async (campaignId: string) => {
  const dashboard = await getCampaignDashboard(campaignId);

  return {
    campaign: dashboard.campaign,
    brand: dashboard.brand,
    strategy: dashboard.agents.strategy,
    adCopies: dashboard.agents.adCopies,
    creativeAssets: dashboard.agents.visualAssets,
    videoScripts: dashboard.agents.videoScripts,
    voiceovers: dashboard.agents.voiceovers,
  };
};

const getProgressBlocks = (dashboard: {
  brandKit: { status: AssetStatus } | null;
  agents: {
    strategy: { status: AssetStatus } | null;
    adCopies: { status: AssetStatus }[];
    visualAssets: { status: AssetStatus }[];
    videoScripts: { status: AssetStatus }[];
    voiceovers: { status: AssetStatus }[];
  };
}): ProgressBlock[] => {
  const collectionBlock = (
    key: string,
    label: string,
    items: { status: AssetStatus }[],
  ): ProgressBlock => ({
    key,
    label,
    missing: items.length === 0,
    approved: items.length > 0 && items.every((item) => isApproved(item.status)),
  });

  return [
    {
      key: "brand_kit",
      label: "Brand Kit",
      missing: !dashboard.brandKit,
      approved: isApproved(dashboard.brandKit?.status),
    },
    {
      key: "strategy",
      label: "Strategy Agent",
      missing: !dashboard.agents.strategy,
      approved: isApproved(dashboard.agents.strategy?.status),
    },
    collectionBlock("ad_copy", "Ad Copy", dashboard.agents.adCopies),
    collectionBlock("creative_asset", "Visual Assets", dashboard.agents.visualAssets),
    collectionBlock("video_script", "Video Agent", dashboard.agents.videoScripts),
    // El Voice Agent (ElevenLabs) ya existe, así que el voiceover es un
    // deliverable obligatorio como el resto: debe generarse y aprobarse.
    collectionBlock("voiceover", "Voice Agent", dashboard.agents.voiceovers),
  ];
};

const updateCampaignReadiness = async (campaignId: string) => {
  const dashboard = await getCampaignDashboard(campaignId);
  const nextStatus = dashboard.progress.readyToPublish ? "ready_to_publish" : "review";

  await db
    .update(campaigns)
    .set({ status: nextStatus })
    .where(eq(campaigns.id, campaignId));
};

const findCampaign = async (campaignId: string) => {
  return db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      brand: true,
    },
  });
};

/** Guard de ownership para las rutas /campaigns/:campaignId — la cadena es
 *  campaign → brand.userId. 404 (no 403) para no filtrar existencia de
 *  campañas ajenas. Las rutas lo llaman antes de delegar en los agentes. */
export const requireCampaignOwnership = async (campaignId: string, userId: string) => {
  const campaign = await findCampaign(campaignId);

  if (!campaign || campaign.brand.userId !== userId) {
    throw new ApiError(404, "Campaign not found");
  }

  return campaign;
};

/** Subquery de marcas del usuario, para filtrar campañas por ownership. */
const userBrandIds = (userId: string) =>
  db.select({ id: brands.id }).from(brands).where(eq(brands.userId, userId));

const findVideoScriptForCampaign = async (campaignId: string, videoScriptId: string) => {
  return db.query.videoScripts.findFirst({
    where: and(eq(videoScripts.id, videoScriptId), eq(videoScripts.campaignId, campaignId)),
  });
};

const findVoiceoverForCampaign = async (campaignId: string, voiceoverId: string) => {
  const voiceover = await db.query.voiceovers.findFirst({
    where: eq(voiceovers.id, voiceoverId),
    with: {
      videoScript: true,
    },
  });

  if (!voiceover || !voiceover.videoScript || voiceover.videoScript.campaignId !== campaignId) {
    return undefined;
  }

  return voiceover;
};

export const createCampaign = async (input: {
  brandId: string;
  name: string;
  objective: string;
  userId: string;
}) => {
  // Ownership en la query; 404 para no filtrar existencia de marcas ajenas.
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.id, input.brandId), eq(brands.userId, input.userId)),
  });

  if (!brand) {
    throw new ApiError(404, "Brand not found");
  }

  const [campaign] = await db
    .insert(campaigns)
    .values({
      brandId: input.brandId,
      name: input.name,
      objective: input.objective,
      status: "draft",
    })
    .returning();

  const createdCampaign = requireOne(campaign, "Campaign could not be created");
  // El Strategy Agent corre inline en la creación (mismo trade-off de
  // latencia que el Brand Agent en POST /api/brands) y deja la campaña en
  // "review"; el row devuelto refleja ese estado.
  const { strategy, generation } = await runStrategyAgent(createdCampaign.id);

  return {
    campaign: { ...createdCampaign, status: "review" as const },
    strategy,
    generation,
  };
};

export const listCampaigns = async (userId: string) => {
  const rows = await db.query.campaigns.findMany({
    where: inArray(campaigns.brandId, userBrandIds(userId)),
    orderBy: (campaignRows, { desc }) => [desc(campaignRows.createdAt)],
    with: {
      brand: true,
      strategy: true,
      adCopies: true,
      creativeAssets: true,
      videoScripts: {
        with: {
          voiceovers: true,
        },
      },
      automationExports: {
        orderBy: (exportRows, { desc }) => [desc(exportRows.createdAt)],
        limit: 1,
      },
    },
  });

  return rows.map((row) => {
    const voiceoverCount = row.videoScripts.reduce(
      (total, script) => total + script.voiceovers.length,
      0,
    );

    return {
      id: row.id,
      name: row.name,
      objective: row.objective,
      status: row.status,
      brand: {
        id: row.brand.id,
        name: row.brand.name,
        industry: row.brand.industry,
      },
      assetCounts: {
        adCopies: row.adCopies.length,
        creativeAssets: row.creativeAssets.length,
        videoScripts: row.videoScripts.length,
        voiceovers: voiceoverCount,
      },
      latestExport: row.automationExports[0] ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

export const getCampaignDashboard = async (campaignId: string) => {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: {
      brand: {
        with: {
          brandKit: true,
        },
      },
      strategy: true,
      adCopies: {
        orderBy: (copyRows, { asc }) => [asc(copyRows.language), asc(copyRows.variant)],
      },
      creativeAssets: {
        orderBy: (assetRows, { asc }) => [asc(assetRows.variant)],
      },
      videoScripts: {
        orderBy: (scriptRows, { desc }) => [desc(scriptRows.createdAt)],
        with: {
          voiceovers: {
            orderBy: (voiceoverRows, { desc }) => [desc(voiceoverRows.createdAt)],
          },
        },
      },
      automationExports: {
        orderBy: (exportRows, { desc }) => [desc(exportRows.createdAt)],
        limit: 1,
      },
    },
  });

  if (!campaign) {
    throw new ApiError(404, "Campaign not found");
  }

  const voiceoverRows = campaign.videoScripts.flatMap((script) =>
    script.voiceovers.map((voiceover) => ({
      ...voiceover,
      videoScriptId: script.id,
      videoScriptTitle: script.title,
    })),
  );

  const dashboard = {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    },
    brand: {
      id: campaign.brand.id,
      name: campaign.brand.name,
      description: campaign.brand.description,
      industry: campaign.brand.industry,
      status: campaign.brand.status,
    },
    brandKit: campaign.brand.brandKit,
    progress: {
      approved: 0,
      total: 6,
      readyToPublish: false,
      pending: [] as string[],
      blocks: [] as ProgressBlock[],
    },
    agents: {
      strategy: campaign.strategy,
      adCopies: campaign.adCopies,
      visualAssets: campaign.creativeAssets,
      videoScripts: campaign.videoScripts,
      voiceovers: voiceoverRows,
    },
    latestExport: campaign.automationExports[0] ?? null,
  };

  const blocks = getProgressBlocks(dashboard);
  // Todos los deliverables son obligatorios: la campaña publica cuando todos
  // los bloques están aprobados.
  const approved = blocks.filter((block) => block.approved).length;

  return {
    ...dashboard,
    progress: {
      approved,
      total: blocks.length,
      readyToPublish: blocks.length > 0 && blocks.every((block) => block.approved),
      pending: blocks.filter((block) => !block.approved).map((block) => block.label),
      blocks,
    },
  };
};

export const approveAsset = async (
  campaignId: string,
  input: { target: AssetTarget; id: string },
) => {
  await requireCampaign(campaignId);

  switch (input.target) {
    case "strategy": {
      const strategy = await db.query.campaignStrategies.findFirst({
        where: and(
          eq(campaignStrategies.id, input.id),
          eq(campaignStrategies.campaignId, campaignId),
        ),
      });
      if (!strategy) {
        throw new ApiError(404, "Strategy not found for this campaign");
      }
      await db
        .update(campaignStrategies)
        .set({ status: "approved" })
        .where(eq(campaignStrategies.id, input.id));
      break;
    }
    case "ad_copy": {
      const copy = await db.query.adCopies.findFirst({
        where: and(eq(adCopies.id, input.id), eq(adCopies.campaignId, campaignId)),
      });
      if (!copy) {
        throw new ApiError(404, "Ad copy not found for this campaign");
      }
      await db.update(adCopies).set({ status: "approved" }).where(eq(adCopies.id, input.id));
      break;
    }
    case "creative_asset": {
      const asset = await db.query.creativeAssets.findFirst({
        where: and(
          eq(creativeAssets.id, input.id),
          eq(creativeAssets.campaignId, campaignId),
        ),
      });
      if (!asset) {
        throw new ApiError(404, "Creative asset not found for this campaign");
      }
      await db
        .update(creativeAssets)
        .set({ status: "approved" })
        .where(eq(creativeAssets.id, input.id));
      break;
    }
    case "video_script": {
      const script = await findVideoScriptForCampaign(campaignId, input.id);
      if (!script) {
        throw new ApiError(404, "Video script not found for this campaign");
      }
      await db
        .update(videoScripts)
        .set({ status: "approved" })
        .where(eq(videoScripts.id, input.id));
      break;
    }
    case "voiceover": {
      const voiceover = await findVoiceoverForCampaign(campaignId, input.id);
      if (!voiceover) {
        throw new ApiError(404, "Voiceover not found for this campaign");
      }
      await db.update(voiceovers).set({ status: "approved" }).where(eq(voiceovers.id, input.id));
      break;
    }
  }

  emitAssetUpdated(campaignId, { target: input.target, id: input.id, status: "approved" });

  await updateCampaignReadiness(campaignId);

  return getCampaignDashboard(campaignId);
};

export const regenerateAsset = async (
  campaignId: string,
  input: { target: AssetTarget; id: string },
) => {
  await requireCampaign(campaignId);

  switch (input.target) {
    case "strategy": {
      await regenerateStrategy(campaignId, input.id);
      break;
    }
    case "ad_copy": {
      await regenerateAdCopy(campaignId, input.id);
      break;
    }
    case "creative_asset": {
      await regenerateCreativeAsset(campaignId, input.id);
      break;
    }
    case "video_script": {
      await regenerateVideoScript(campaignId, input.id);
      break;
    }
    case "voiceover": {
      // Re-corre el Voice Agent (ElevenLabs) para el guion de esta voiceover,
      // regenerando el par ES/EN; emite sus propios eventos de progreso.
      await regenerateVoiceover(campaignId, input.id);
      break;
    }
  }

  await db.update(campaigns).set({ status: "review" }).where(eq(campaigns.id, campaignId));

  return getCampaignDashboard(campaignId);
};

export const exportCampaignToMetaAds = async (campaignId: string) => {
  const campaign = await requireCampaign(campaignId);
  const dashboard = await getCampaignDashboard(campaignId);

  if (!dashboard.progress.readyToPublish) {
    throw new ApiError(409, "Campaign is not ready to publish", {
      pending: dashboard.progress.pending,
    });
  }

  const metaAdsPayload = await buildMetaAdsPayload(campaignId);

  // Fila en "processing" antes de llamar a n8n: queda registro aunque el
  // webhook cuelgue o falle, y el estado refleja el ciclo real del export.
  const [pending] = await db
    .insert(automationExports)
    .values({
      campaignId,
      exportStatus: "processing",
      n8nWorkflowId: env.N8N_EXPORT_WORKFLOW_ID,
      metaAdsPayload,
    })
    .returning();
  const exportRow = requireOne(pending, "Export could not be created");

  try {
    const result = await dispatchCampaignExport({
      brandId: campaign.brand.id,
      campaignId,
      target: "meta_ads",
      payload: metaAdsPayload,
    });

    const [sent] = await db
      .update(automationExports)
      .set({
        exportStatus: "sent",
        n8nExecutionId: result.executionId,
        metaCampaignId: result.metaCampaignId,
        completedAt: new Date(),
      })
      .where(eq(automationExports.id, exportRow.id))
      .returning();

    await db
      .update(campaigns)
      .set({ status: "ready_to_publish" })
      .where(eq(campaigns.id, campaignId));

    return {
      export: requireOne(sent, "Export could not be updated"),
      dashboard: await getCampaignDashboard(campaignId),
    };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "n8n export failed unexpectedly";
    await db
      .update(automationExports)
      .set({ exportStatus: "failed", errorMessage: message, completedAt: new Date() })
      .where(eq(automationExports.id, exportRow.id));

    throw error instanceof ApiError ? error : new ApiError(502, message);
  }
};

/** El seed cuelga la data demo del usuario de la sesión — con el scoping por
 *  ownership, un seed a un usuario demo aparte sería invisible para quien lo
 *  disparó. */
export const seedDemoCampaign = async (userId: string) => {
  const user = requireOne(
    await db.query.users.findFirst({ where: eq(users.id, userId) }),
    "User not found",
  );
  const brand = await upsertDemoBrand(user.id);
  const brandKit = await upsertDemoBrandKit(brand.id);
  const campaign = await upsertDemoCampaign(brand.id);
  const strategy = await upsertDemoStrategy(campaign.id);
  const copies = await Promise.all([
    upsertDemoAdCopy(campaign.id, "es", "a"),
    upsertDemoAdCopy(campaign.id, "en", "a"),
  ]);
  const assets = await Promise.all([
    upsertDemoCreativeAsset(campaign.id, "a"),
    upsertDemoCreativeAsset(campaign.id, "b"),
  ]);
  const script = await upsertDemoVideoScript(campaign.id);
  const voiceover = await upsertDemoVoiceover(script.id);
  const existingExport = await db.query.automationExports.findFirst({
    where: eq(automationExports.campaignId, campaign.id),
    orderBy: desc(automationExports.createdAt),
  });

  if (!existingExport) {
    await db.insert(automationExports).values({
      campaignId: campaign.id,
      exportStatus: "pending",
      n8nWorkflowId: "demo-polyedro-meta-ads",
      metaAdsPayload: {
        campaignName: campaign.name,
        status: "pending_approval",
      },
    });
  }

  return {
    user,
    brand,
    brandKit,
    campaign,
    strategy,
    copies,
    assets,
    script,
    voiceover,
    dashboard: await getCampaignDashboard(campaign.id),
  };
};

const requireCampaign = async (campaignId: string) => {
  const campaign = await findCampaign(campaignId);

  if (!campaign) {
    throw new ApiError(404, "Campaign not found");
  }

  return campaign;
};

const upsertDemoBrand = async (userId: string) => {
  const existing = await db.query.brands.findFirst({
    where: and(eq(brands.userId, userId), eq(brands.name, "NovaGear Tech")),
  });
  const values = {
    userId,
    name: "NovaGear Tech",
    description:
      "Affordable modern gadgets for young professionals and students in Latin America.",
    industry: "Consumer electronics",
    status: "approved" as const,
  };

  if (existing) {
    const [updated] = await db
      .update(brands)
      .set(values)
      .where(eq(brands.id, existing.id))
      .returning();
    return requireOne(updated, "Demo brand could not be updated");
  }

  const [created] = await db.insert(brands).values(values).returning();

  return requireOne(created, "Demo brand could not be created");
};

const upsertDemoBrandKit = async (brandId: string) => {
  const existing = await db.query.brandKits.findFirst({
    where: eq(brandKits.brandId, brandId),
  });
  const values = {
    brandId,
    status: "approved" as const,
    logoUrl: "https://cdn.polyedro.abs/demo/novagear-logo.png",
    logoPrompt:
      "Bold slash-inspired NovaGear Tech logo, neo-brutalist AI lab aesthetic.",
    colorPalette: {
      primary: "#B7FF1A",
      secondary: "#B9E9FF",
      accent: "#FF705F",
      neutrals: ["#FFF8E8", "#111111", "#F2F2F2"],
    },
    toneOfVoice: {
      es: "Directo, moderno, claro y enfocado en beneficios.",
      en: "Direct, modern, clear, and benefit-led.",
    },
    buyerPersona: {
      name: "Valentina, commuter multitasker",
      age: "22-34",
      occupation: "Young professional or university student",
      goals: ["Focus while commuting", "Buy useful tech at a fair price"],
      painPoints: ["Noise", "Low battery", "Overpriced accessories"],
    },
    valueProposition: {
      es: "Tecnologia inteligente, accesible y lista para tu rutina diaria.",
      en: "Smart, accessible tech built for your daily routine.",
    },
    keyMessages: {
      es: ["36 horas de bateria", "Cancelacion activa de ruido", "20% off lanzamiento"],
      en: ["36-hour battery", "Active noise cancellation", "20% launch discount"],
    },
    visualStyle: {
      mood: "Bright AI lab meets consumer tech launch",
      imageryStyle: "High-contrast product crops with bold text blocks",
      typography: "Heavy sans-serif, compact labels",
      references: ["neo-brutalist dashboard", "Meta Ads product creative"],
    },
  };

  if (existing) {
    const [updated] = await db
      .update(brandKits)
      .set(values)
      .where(eq(brandKits.id, existing.id))
      .returning();
    return requireOne(updated, "Demo brand kit could not be updated");
  }

  const [created] = await db.insert(brandKits).values(values).returning();

  return requireOne(created, "Demo brand kit could not be created");
};

const upsertDemoCampaign = async (brandId: string) => {
  const existing = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.brandId, brandId), eq(campaigns.name, "NovaGear Earbuds Launch")),
  });
  const values = {
    brandId,
    name: "NovaGear Earbuds Launch",
    objective:
      "Launch wireless noise-cancelling earbuds for young professionals and students.",
    status: "review" as const,
  };

  if (existing) {
    const [updated] = await db
      .update(campaigns)
      .set(values)
      .where(eq(campaigns.id, existing.id))
      .returning();
    return requireOne(updated, "Demo campaign could not be updated");
  }

  const [created] = await db.insert(campaigns).values(values).returning();

  return requireOne(created, "Demo campaign could not be created");
};

const upsertDemoStrategy = async (campaignId: string) => {
  const existing = await db.query.campaignStrategies.findFirst({
    where: eq(campaignStrategies.campaignId, campaignId),
  });
  const values = {
    campaignId,
    status: "approved" as const,
    audience: {
      description:
        "Young professionals and students in Latin America who commute, study, and work from noisy environments.",
      ageRange: "18-34",
      locations: ["Mexico", "Colombia", "Guatemala", "El Salvador"],
      interests: ["gadgets", "productivity", "music", "online shopping"],
    },
    segmentation: {
      ageMin: 18,
      ageMax: 34,
      locations: ["Latin America"],
      interests: ["Consumer electronics", "Productivity", "Music streaming"],
      placements: ["Instagram Reels", "Facebook Feed", "Instagram Stories"],
    },
    commercialAngle: "Silence the commute: focus and productivity, not specs.",
    notes: "Conversions: earbuds pre-orders. Funnel: 60% cold, 25% retargeting, 15% lookalike.",
  };

  if (existing) {
    const [updated] = await db
      .update(campaignStrategies)
      .set(values)
      .where(eq(campaignStrategies.id, existing.id))
      .returning();
    return requireOne(updated, "Demo strategy could not be updated");
  }

  const [created] = await db.insert(campaignStrategies).values(values).returning();

  return requireOne(created, "Demo strategy could not be created");
};

const upsertDemoAdCopy = async (campaignId: string, language: Language, variant: Variant) => {
  const existing = await db.query.adCopies.findFirst({
    where: and(
      eq(adCopies.campaignId, campaignId),
      eq(adCopies.language, language),
      eq(adCopies.variant, variant),
    ),
  });
  const values = {
    campaignId,
    language,
    variant,
    status: "review" as const,
    headline:
      language === "es"
        ? "Ultimos dias: tu enfoque no puede esperar."
        : "Your commute just went quiet.",
    primaryText:
      language === "es"
        ? "Audifonos ANC NovaGear Tech: 36h de bateria. Pre-ordena antes del viernes y llevate 20% off."
        : "NovaGear Tech ANC earbuds: 36h battery, adaptive noise canceling. Pre-order and save 20%.",
    description:
      language === "es"
        ? "Tecnologia practica para estudiar, trabajar y moverte sin ruido."
        : "Practical tech for studying, working, and moving without noise.",
    callToAction: language === "es" ? "Preordenar" : "Pre-order",
  };

  if (existing) {
    const [updated] = await db
      .update(adCopies)
      .set(values)
      .where(eq(adCopies.id, existing.id))
      .returning();
    return requireOne(updated, "Demo ad copy could not be updated");
  }

  const [created] = await db.insert(adCopies).values(values).returning();

  return requireOne(created, "Demo ad copy could not be created");
};

const upsertDemoCreativeAsset = async (campaignId: string, variant: Variant) => {
  const existing = await db.query.creativeAssets.findFirst({
    where: and(eq(creativeAssets.campaignId, campaignId), eq(creativeAssets.variant, variant)),
  });
  const values = {
    campaignId,
    variant,
    status: "approved" as const,
    imageUrl: `https://cdn.polyedro.abs/demo/novagear-earbuds-${variant}.png`,
    prompt:
      variant === "a"
        ? "Spanish Meta Ads static creative, black product card, acid green line art, NovaGear ANC earbuds."
        : "Bright product spec creative with acid green background, 36H battery typography, NovaGear earbuds.",
    altText: `NovaGear earbuds launch creative variant ${variant.toUpperCase()}`,
    metadata: {
      provider: "demo",
      format: "meta_ads_static",
      variant,
    },
  };

  if (existing) {
    const [updated] = await db
      .update(creativeAssets)
      .set(values)
      .where(eq(creativeAssets.id, existing.id))
      .returning();
    return requireOne(updated, "Demo creative asset could not be updated");
  }

  const [created] = await db.insert(creativeAssets).values(values).returning();

  return requireOne(created, "Demo creative asset could not be created");
};

const upsertDemoVideoScript = async (campaignId: string) => {
  const existing = await db.query.videoScripts.findFirst({
    where: and(eq(videoScripts.campaignId, campaignId), eq(videoScripts.language, "es")),
  });
  const values = {
    campaignId,
    status: "review" as const,
    language: "es" as const,
    title: "NovaGear commute ad",
    scenes: [
      {
        sceneNumber: 1,
        description: "Noisy commute, user puts on NovaGear earbuds.",
        dialogue: "El ruido no decide tu dia.",
        durationSeconds: 4,
      },
      {
        sceneNumber: 2,
        description: "Product close-up with 36H battery and ANC labels.",
        dialogue: "Audifonos ANC con 36 horas de bateria.",
        durationSeconds: 5,
      },
      {
        sceneNumber: 3,
        description: "Offer card with preorder discount.",
        dialogue: "Preordena esta semana y ahorra 20%.",
        durationSeconds: 5,
      },
    ],
    durationSeconds: 14,
  };

  if (existing) {
    const [updated] = await db
      .update(videoScripts)
      .set(values)
      .where(eq(videoScripts.id, existing.id))
      .returning();
    return requireOne(updated, "Demo video script could not be updated");
  }

  const [created] = await db.insert(videoScripts).values(values).returning();

  return requireOne(created, "Demo video script could not be created");
};

const upsertDemoVoiceover = async (videoScriptId: string) => {
  const existing = await db.query.voiceovers.findFirst({
    where: and(eq(voiceovers.videoScriptId, videoScriptId), eq(voiceovers.language, "es")),
  });
  const values = {
    videoScriptId,
    status: "review" as const,
    language: "es" as const,
    voiceId: "elevenlabs-valentina-demo",
    audioUrl: "https://cdn.polyedro.abs/demo/novagear-voiceover.mp3",
    durationSeconds: 14,
    settings: {
      provider: "elevenlabs-demo",
      voice: "Valentina",
      stability: 0.62,
      style: 0.34,
    },
  };

  if (existing) {
    const [updated] = await db
      .update(voiceovers)
      .set(values)
      .where(eq(voiceovers.id, existing.id))
      .returning();
    return requireOne(updated, "Demo voiceover could not be updated");
  }

  const [created] = await db.insert(voiceovers).values(values).returning();

  return requireOne(created, "Demo voiceover could not be created");
};
