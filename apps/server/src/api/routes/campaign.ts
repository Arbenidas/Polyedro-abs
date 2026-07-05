import {
  approveAsset,
  createCampaign,
  exportCampaignToMetaAds,
  getCampaignDashboard,
  listCampaigns,
  regenerateAsset,
  seedDemoCampaign,
} from "@/api/services/campaign";
import { runCreativeAgent } from "@/api/services/creative";
import { runMetaAdsAgent } from "@/api/services/meta-ads-agent";
import { runStrategyAgent } from "@/api/services/strategy-agent";
import { parseBody, parseUuidParam } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

const campaignInputSchema = z.object({
  brandId: z.uuid(),
  name: z.string().trim().min(1),
  objective: z.string().trim().min(1),
});

const assetActionSchema = z.object({
  target: z.enum(["strategy", "ad_copy", "creative_asset", "video_script", "voiceover"]),
  id: z.uuid(),
});

const campaignRoutes = new Hono();

campaignRoutes.post("/demo/seed", async (c) => {
  const result = await seedDemoCampaign();

  return c.json(result, 201);
});

campaignRoutes.get("/campaigns", async (c) => {
  const result = await listCampaigns();

  return c.json({ campaigns: result });
});

campaignRoutes.get("/campaigns/:campaignId/dashboard", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const result = await getCampaignDashboard(campaignId);

  return c.json(result);
});

campaignRoutes.post("/campaigns", async (c) => {
  const input = await parseBody(c.req.raw, campaignInputSchema);
  const result = await createCampaign(input);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/strategy", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const result = await runStrategyAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/creative", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const result = await runCreativeAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/meta-ads", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const result = await runMetaAdsAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/approve", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const input = await parseBody(c.req.raw, assetActionSchema);
  const result = await approveAsset(campaignId, input);

  return c.json(result);
});

campaignRoutes.post("/campaigns/:campaignId/regenerate", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const input = await parseBody(c.req.raw, assetActionSchema);
  const result = await regenerateAsset(campaignId, input);

  return c.json(result);
});

campaignRoutes.post("/campaigns/:campaignId/meta-ads/export", async (c) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  const result = await exportCampaignToMetaAds(campaignId);

  return c.json(result, 201);
});

export { campaignRoutes };
