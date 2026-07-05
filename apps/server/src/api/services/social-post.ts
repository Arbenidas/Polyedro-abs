import { env } from "@Polyedro-abs/env/server";
import { and, desc, eq, lte } from "drizzle-orm";

import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { campaigns, creativeAssets, socialPosts } from "@/db/schema";

export type SocialPostStatus = (typeof socialPosts.$inferSelect)["status"];
type SocialPost = typeof socialPosts.$inferSelect;

const EDITABLE_STATUSES = new Set<SocialPostStatus>(["draft", "scheduled"]);
const GRAPH_VERSION = "v19.0";

const findCampaign = async (campaignId: string) => {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    throw new ApiError(404, "Campaign not found");
  }

  return campaign;
};

const findCreativeAssetForCampaign = async (campaignId: string, creativeAssetId: string) => {
  const asset = await db.query.creativeAssets.findFirst({
    where: and(eq(creativeAssets.id, creativeAssetId), eq(creativeAssets.campaignId, campaignId)),
  });

  if (!asset) {
    throw new ApiError(404, "Creative asset not found for this campaign");
  }

  return asset;
};

const findPostForCampaign = async (campaignId: string, postId: string) => {
  const post = await db.query.socialPosts.findFirst({
    where: and(eq(socialPosts.id, postId), eq(socialPosts.campaignId, campaignId)),
  });

  if (!post) {
    throw new ApiError(404, "Post not found for this campaign");
  }

  return post;
};

/** scheduledAt en el futuro => "scheduled"; de lo contrario "draft". Misma
 *  regla para create/update/reschedule, para que el status siempre refleje
 *  si el post va a disparar solo o necesita una acción manual. */
const statusForScheduledAt = (scheduledAt: Date | null): "draft" | "scheduled" =>
  scheduledAt && scheduledAt.getTime() > Date.now() ? "scheduled" : "draft";

export const listCampaignPosts = async (campaignId: string) => {
  await findCampaign(campaignId);

  return db.query.socialPosts.findMany({
    where: eq(socialPosts.campaignId, campaignId),
    orderBy: desc(socialPosts.createdAt),
  });
};

export const createPost = async (
  campaignId: string,
  input: { creativeAssetId: string; caption: string; scheduledAt: Date | null },
) => {
  await findCampaign(campaignId);
  await findCreativeAssetForCampaign(campaignId, input.creativeAssetId);

  const [created] = await db
    .insert(socialPosts)
    .values({
      campaignId,
      creativeAssetId: input.creativeAssetId,
      caption: input.caption,
      status: statusForScheduledAt(input.scheduledAt),
      scheduledAt: input.scheduledAt,
    })
    .returning();

  return requireOne(created, "Post could not be created");
};

export const updatePost = async (
  campaignId: string,
  postId: string,
  input: { creativeAssetId?: string; caption?: string },
) => {
  const existing = await findPostForCampaign(campaignId, postId);

  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new ApiError(409, `Only draft or scheduled posts can be updated (current: ${existing.status})`);
  }

  if (input.creativeAssetId) {
    await findCreativeAssetForCampaign(campaignId, input.creativeAssetId);
  }

  const [updated] = await db
    .update(socialPosts)
    .set({
      ...(input.creativeAssetId !== undefined && { creativeAssetId: input.creativeAssetId }),
      ...(input.caption !== undefined && { caption: input.caption }),
    })
    .where(eq(socialPosts.id, postId))
    .returning();

  return requireOne(updated, "Post could not be updated");
};

export const reschedulePost = async (
  campaignId: string,
  postId: string,
  scheduledAt: Date | null,
) => {
  const existing = await findPostForCampaign(campaignId, postId);

  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new ApiError(
      409,
      `Cannot reschedule a post with status ${existing.status}`,
    );
  }

  if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
    throw new ApiError(400, "scheduledAt must be a future date");
  }

  const [updated] = await db
    .update(socialPosts)
    .set({
      scheduledAt,
      status: statusForScheduledAt(scheduledAt),
    })
    .where(eq(socialPosts.id, postId))
    .returning();

  return requireOne(updated, "Post could not be rescheduled");
};

/** Llama al Graph API con la URL pública del creative (ya vive en Supabase
 *  Storage) — a diferencia del prototipo original no hay archivos locales
 *  que leer/subir como multipart, así que un POST con URLSearchParams basta. */
const publishToFacebook = async (post: SocialPost, imageUrl: string): Promise<string> => {
  if (!env.FB_PAGE_ID || !env.FB_PAGE_ACCESS_TOKEN) {
    throw new Error("FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN is not configured");
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${env.FB_PAGE_ID}/photos`;
  const body = new URLSearchParams({
    url: imageUrl,
    caption: post.caption,
    access_token: env.FB_PAGE_ACCESS_TOKEN,
  });

  const response = await fetch(url, { method: "POST", body });
  const data = (await response.json()) as {
    id?: string;
    post_id?: string;
    error?: { message: string };
  };

  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? `Facebook API responded with ${response.status}`);
  }

  const externalId = data.post_id ?? data.id;
  if (!externalId) {
    throw new Error("Facebook API response did not include a post id");
  }

  return externalId;
};

const finalizePost = async (
  postId: string,
  status: "published" | "failed",
  fields: { externalPostId?: string; errorMessage?: string },
) => {
  await db
    .update(socialPosts)
    .set({
      status,
      publishedAt: status === "published" ? new Date() : null,
      externalPostId: status === "published" ? (fields.externalPostId ?? null) : null,
      errorMessage: status === "failed" ? (fields.errorMessage ?? "Publish failed") : null,
    })
    .where(eq(socialPosts.id, postId));
};

/** Corre en background (invocada con `void`) — el caller ya recibió la
 *  respuesta con status "publishing"; este paso solo actualiza la fila al
 *  terminar. Mismo patrón fire-and-forget que el prototipo original. */
export const runPublishWorkflow = async (post: SocialPost): Promise<void> => {
  try {
    const asset = await db.query.creativeAssets.findFirst({
      where: eq(creativeAssets.id, post.creativeAssetId),
    });

    if (!asset?.imageUrl) {
      throw new Error("Creative asset has no image URL to publish");
    }

    const externalPostId = await publishToFacebook(post, asset.imageUrl);
    await finalizePost(post.id, "published", { externalPostId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Publish failed";
    console.error(`Failed to publish post ${post.id}:`, errorMessage);
    await finalizePost(post.id, "failed", { errorMessage });
  }
};

export const publishPost = async (campaignId: string, postId: string) => {
  const existing = await findPostForCampaign(campaignId, postId);

  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new ApiError(409, `Only draft or scheduled posts can be published (current: ${existing.status})`);
  }

  const [updated] = await db
    .update(socialPosts)
    .set({ status: "publishing", errorMessage: null })
    .where(eq(socialPosts.id, postId))
    .returning();

  const publishing = requireOne(updated, "Post could not be published");

  void runPublishWorkflow(publishing);

  return publishing;
};

/** Job del scheduler (node-cron, cada minuto): reclama atómicamente los posts
 *  vencidos (update condicionado al status actual) antes de publicarlos, para
 *  no disparar el mismo post dos veces si el cron se solapa. */
export const fireDueScheduledPosts = async (): Promise<void> => {
  const now = new Date();
  const duePosts = await db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, now)));

  for (const post of duePosts) {
    const [claimed] = await db
      .update(socialPosts)
      .set({ status: "publishing", errorMessage: null })
      .where(and(eq(socialPosts.id, post.id), eq(socialPosts.status, "scheduled")))
      .returning();

    if (!claimed) {
      continue;
    }

    await runPublishWorkflow(claimed);
  }
};
