import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { ApiError, requireOne } from "@/api/shared";
import {
  adCopies,
  brandKits,
  brands,
  campaignStrategies,
  campaigns,
  creativeAssets,
  users,
  videoScripts,
  voiceovers,
} from "@/db/schema";
import { applyMigrations, resetDb, testDb } from "@/test/db";

// Los servicios importan `db` desde @/db; lo apuntamos a la instancia PGlite.
vi.mock("@/db", async () => {
  const { testDb } = await import("@/test/db");
  return { db: testDb };
});

// Fronteras externas mockeadas: los tests validan la orquestación de campaign.ts
// (transición de estados + gate del push), no los agentes ni el webhook de n8n.
const dispatchCampaignExport = vi.fn(async () => ({ executionId: "test-exec-1" }));
vi.mock("@/api/services/n8n", () => ({ dispatchCampaignExport }));

const regenerateStrategy = vi.fn(async () => undefined);
vi.mock("@/api/services/strategy-agent", () => ({
  regenerateStrategy,
  runStrategyAgent: vi.fn(async () => undefined),
}));

const regenerateCreativeAsset = vi.fn(async () => undefined);
vi.mock("@/api/services/creative", () => ({ regenerateCreativeAsset }));

const regenerateAdCopy = vi.fn(async () => undefined);
vi.mock("@/api/services/meta-ads-agent", () => ({ regenerateAdCopy }));

const regenerateVideoScript = vi.fn(async () => undefined);
vi.mock("@/api/services/video-agent", () => ({ regenerateVideoScript }));

const regenerateVoiceover = vi.fn(async () => undefined);
vi.mock("@/api/services/voice-agent", () => ({ regenerateVoiceover }));

// Importado después de los mocks para que resuelvan al módulo mockeado.
const { approveAsset, exportCampaignToMetaAds, getCampaignDashboard, regenerateAsset } =
  await import("@/api/services/campaign");

type AssetStatus =
  | "draft"
  | "generating"
  | "review"
  | "approved"
  | "ready_to_publish"
  | "rejected";

/** Estados por bloque; cada uno arranca en "approved" y el test baja los que
 *  quiere dejar pendientes. */
type SeedStatuses = {
  brandKit?: AssetStatus;
  strategy?: AssetStatus;
  adCopy?: AssetStatus;
  creativeAsset?: AssetStatus;
  videoScript?: AssetStatus;
  voiceover?: AssetStatus;
  campaign?: AssetStatus;
};

let seedCounter = 0;

const seedCampaign = async (statuses: SeedStatuses = {}) => {
  const s = {
    brandKit: "approved" as AssetStatus,
    strategy: "approved" as AssetStatus,
    adCopy: "approved" as AssetStatus,
    creativeAsset: "approved" as AssetStatus,
    videoScript: "approved" as AssetStatus,
    voiceover: "approved" as AssetStatus,
    campaign: "review" as AssetStatus,
    ...statuses,
  };

  seedCounter += 1;
  const user = requireOne(
    (await testDb
      .insert(users)
      .values({ email: `owner-${seedCounter}@test.dev`, name: "Owner" })
      .returning())[0],
    "seed user",
  );

  const brand = requireOne(
    (await testDb
      .insert(brands)
      .values({ userId: user.id, name: "NovaGear Tech", status: "approved" })
      .returning())[0],
    "seed brand",
  );

  const brandKit = requireOne(
    (await testDb.insert(brandKits).values({ brandId: brand.id, status: s.brandKit }).returning())[0],
    "seed brand kit",
  );

  const campaign = requireOne(
    (await testDb
      .insert(campaigns)
      .values({
        brandId: brand.id,
        name: "NovaGear Earbuds Launch",
        objective: "Sell more earbuds",
        status: s.campaign,
      })
      .returning())[0],
    "seed campaign",
  );

  const strategy = requireOne(
    (await testDb
      .insert(campaignStrategies)
      .values({ campaignId: campaign.id, status: s.strategy })
      .returning())[0],
    "seed strategy",
  );

  const adCopy = requireOne(
    (await testDb
      .insert(adCopies)
      .values({ campaignId: campaign.id, language: "es", variant: "a", status: s.adCopy })
      .returning())[0],
    "seed ad copy",
  );

  const creativeAsset = requireOne(
    (await testDb
      .insert(creativeAssets)
      .values({ campaignId: campaign.id, variant: "a", status: s.creativeAsset })
      .returning())[0],
    "seed creative asset",
  );

  const videoScript = requireOne(
    (await testDb
      .insert(videoScripts)
      .values({ campaignId: campaign.id, language: "es", status: s.videoScript })
      .returning())[0],
    "seed video script",
  );

  const voiceover = requireOne(
    (await testDb
      .insert(voiceovers)
      .values({
        videoScriptId: videoScript.id,
        language: "es",
        voiceId: "test-voice",
        status: s.voiceover,
      })
      .returning())[0],
    "seed voiceover",
  );

  return { user, brand, brandKit, campaign, strategy, adCopy, creativeAsset, videoScript, voiceover };
};

const campaignStatus = async (campaignId: string) => {
  const row = await testDb.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  return row?.status;
};

beforeAll(async () => {
  await applyMigrations();
});

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("approveAsset → ready_to_publish transition", () => {
  it("flips the campaign to ready_to_publish when the last asset is approved", async () => {
    const seed = await seedCampaign({ strategy: "review", campaign: "review" });

    const dashboard = await approveAsset(seed.campaign.id, {
      target: "strategy",
      id: seed.strategy.id,
    });

    expect(dashboard.progress.readyToPublish).toBe(true);
    expect(dashboard.progress.pending).toEqual([]);
    expect(await campaignStatus(seed.campaign.id)).toBe("ready_to_publish");
  });

  it("keeps the campaign in review while other assets are still pending", async () => {
    const seed = await seedCampaign({
      strategy: "review",
      adCopy: "review",
      campaign: "review",
    });

    const dashboard = await approveAsset(seed.campaign.id, {
      target: "strategy",
      id: seed.strategy.id,
    });

    expect(dashboard.progress.readyToPublish).toBe(false);
    expect(dashboard.progress.pending).toContain("Ad Copy");
    expect(await campaignStatus(seed.campaign.id)).toBe("review");
  });

  it("marks the approved asset as approved without touching its siblings", async () => {
    const seed = await seedCampaign({
      strategy: "review",
      adCopy: "review",
      campaign: "review",
    });

    await approveAsset(seed.campaign.id, { target: "strategy", id: seed.strategy.id });

    const strategy = await testDb.query.campaignStrategies.findFirst({
      where: eq(campaignStrategies.id, seed.strategy.id),
    });
    const adCopy = await testDb.query.adCopies.findFirst({
      where: eq(adCopies.id, seed.adCopy.id),
    });
    expect(strategy?.status).toBe("approved");
    expect(adCopy?.status).toBe("review");
  });

  it("rejects an asset id that belongs to another campaign", async () => {
    const seed = await seedCampaign();
    const other = await seedCampaign();

    await expect(
      approveAsset(seed.campaign.id, { target: "strategy", id: other.strategy.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("regenerateAsset → back to review", () => {
  it("knocks a ready_to_publish campaign back to review and relaunches only that agent", async () => {
    const seed = await seedCampaign({ campaign: "ready_to_publish" });

    await regenerateAsset(seed.campaign.id, { target: "strategy", id: seed.strategy.id });

    expect(regenerateStrategy).toHaveBeenCalledTimes(1);
    expect(regenerateStrategy).toHaveBeenCalledWith(seed.campaign.id, seed.strategy.id);
    expect(await campaignStatus(seed.campaign.id)).toBe("review");
  });

  it("does not touch the other assets when regenerating one", async () => {
    const seed = await seedCampaign({ campaign: "ready_to_publish" });

    await regenerateAsset(seed.campaign.id, { target: "creative_asset", id: seed.creativeAsset.id });

    expect(regenerateCreativeAsset).toHaveBeenCalledWith(seed.campaign.id, seed.creativeAsset.id);
    expect(regenerateStrategy).not.toHaveBeenCalled();
    expect(regenerateAdCopy).not.toHaveBeenCalled();

    const adCopy = await testDb.query.adCopies.findFirst({
      where: eq(adCopies.id, seed.adCopy.id),
    });
    const strategy = await testDb.query.campaignStrategies.findFirst({
      where: eq(campaignStrategies.id, seed.strategy.id),
    });
    expect(adCopy?.status).toBe("approved");
    expect(strategy?.status).toBe("approved");
  });

  it("routes each target to its own regenerator", async () => {
    const seed = await seedCampaign({ campaign: "ready_to_publish" });

    await regenerateAsset(seed.campaign.id, { target: "voiceover", id: seed.voiceover.id });
    expect(regenerateVoiceover).toHaveBeenCalledWith(seed.campaign.id, seed.voiceover.id);

    await regenerateAsset(seed.campaign.id, { target: "video_script", id: seed.videoScript.id });
    expect(regenerateVideoScript).toHaveBeenCalledWith(seed.campaign.id, seed.videoScript.id);

    await regenerateAsset(seed.campaign.id, { target: "ad_copy", id: seed.adCopy.id });
    expect(regenerateAdCopy).toHaveBeenCalledWith(seed.campaign.id, seed.adCopy.id);
  });
});

describe("exportCampaignToMetaAds → push gate", () => {
  it("returns 409 with the pending list when the campaign is not ready", async () => {
    const seed = await seedCampaign({ voiceover: "review", campaign: "review" });

    await expect(exportCampaignToMetaAds(seed.campaign.id)).rejects.toMatchObject({
      status: 409,
      message: "Campaign is not ready to publish",
    });
    expect(dispatchCampaignExport).not.toHaveBeenCalled();

    // El gate no debe dejar la campaña en ready_to_publish.
    expect(await campaignStatus(seed.campaign.id)).toBe("review");
  });

  it("dispatches the export and marks it sent when every asset is approved", async () => {
    const seed = await seedCampaign();

    const result = await exportCampaignToMetaAds(seed.campaign.id);

    expect(dispatchCampaignExport).toHaveBeenCalledTimes(1);
    expect(result.export.exportStatus).toBe("sent");
    expect(result.export.n8nExecutionId).toBe("test-exec-1");
    expect(result.dashboard.progress.readyToPublish).toBe(true);
    expect(await campaignStatus(seed.campaign.id)).toBe("ready_to_publish");
  });

  it("records a failed export row and rethrows when n8n fails", async () => {
    const seed = await seedCampaign();
    dispatchCampaignExport.mockRejectedValueOnce(new ApiError(502, "n8n unreachable"));

    await expect(exportCampaignToMetaAds(seed.campaign.id)).rejects.toMatchObject({ status: 502 });

    const dashboard = await getCampaignDashboard(seed.campaign.id);
    expect(dashboard.latestExport?.exportStatus).toBe("failed");
  });
});
