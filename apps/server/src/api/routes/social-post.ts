import { requireCampaignOwnership } from "@/api/services/campaign";
import {
  createPost,
  listCampaignPosts,
  publishPost,
  reschedulePost,
  updatePost,
} from "@/api/services/social-post";
import { parseBody, parseUuidParam } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

import type { AuthEnv } from "@/middleware/auth";

const socialPostRoutes = new Hono<AuthEnv>();

/** Mismo patrón que campaign.ts: ownership (campaign → brand.userId) se
 *  verifica acá antes de delegar en el servicio, que asume campaignId ya
 *  autorizado. */
const requireOwnedCampaignId = async (c: {
  req: { param: (name: "campaignId") => string };
  get: (key: "user") => { id: string };
}) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  await requireCampaignOwnership(campaignId, c.get("user").id);

  return campaignId;
};

const nullableIsoDateSchema = z
  .preprocess((value) => (value === "" ? null : value), z.iso.datetime().nullable())
  .optional();

const createPostSchema = z.object({
  creativeAssetId: z.uuid(),
  caption: z.string().trim().min(1),
  scheduledAt: nullableIsoDateSchema,
});

const updatePostSchema = z.object({
  creativeAssetId: z.uuid().optional(),
  caption: z.string().trim().min(1).optional(),
});

const scheduleSchema = z.object({
  scheduledAt: nullableIsoDateSchema,
});

socialPostRoutes.get("/campaigns/:campaignId/posts", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const posts = await listCampaignPosts(campaignId);

  return c.json({ posts });
});

socialPostRoutes.post("/campaigns/:campaignId/posts", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const input = await parseBody(c.req.raw, createPostSchema);

  const post = await createPost(campaignId, {
    creativeAssetId: input.creativeAssetId,
    caption: input.caption,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
  });

  return c.json(post, 201);
});

socialPostRoutes.patch("/campaigns/:campaignId/posts/:postId", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const postId = parseUuidParam(c.req.param("postId"), "postId");
  const input = await parseBody(c.req.raw, updatePostSchema);

  const post = await updatePost(campaignId, postId, input);

  return c.json(post);
});

socialPostRoutes.patch("/campaigns/:campaignId/posts/:postId/schedule", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const postId = parseUuidParam(c.req.param("postId"), "postId");
  const input = await parseBody(c.req.raw, scheduleSchema);

  const post = await reschedulePost(
    campaignId,
    postId,
    input.scheduledAt ? new Date(input.scheduledAt) : null,
  );

  return c.json(post);
});

socialPostRoutes.post("/campaigns/:campaignId/posts/:postId/publish", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const postId = parseUuidParam(c.req.param("postId"), "postId");

  const post = await publishPost(campaignId, postId);

  return c.json(post);
});

export { socialPostRoutes };
