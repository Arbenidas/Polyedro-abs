import { ApiError } from "@/api/shared";
import { db } from "@/db";
import { brands, campaignBriefs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

const campaignBriefInputSchema = z.object({
  brandId: z.uuid(),
  text: z.string().trim().min(1),
});

const campaignBriefRoutes = new Hono();

campaignBriefRoutes.post("/", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = campaignBriefInputSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid campaign brief", parsed.error.flatten());
  }

  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, parsed.data.brandId),
  });

  if (!brand) {
    throw new ApiError(404, "Brand not found.");
  }

  const [campaignBrief] = await db
    .insert(campaignBriefs)
    .values({
      brandId: brand.id,
      language: "es",
      source: "typed",
      provider: "user",
      model: "manual-entry",
      text: parsed.data.text,
    })
    .returning();

  if (!campaignBrief) {
    throw new ApiError(500, "Campaign brief could not be saved.");
  }

  return c.json(
    {
      id: campaignBrief.id,
      brandId: campaignBrief.brandId,
      campaignId: campaignBrief.campaignId,
      text: campaignBrief.text,
      language: campaignBrief.language,
      model: campaignBrief.model,
      provider: campaignBrief.provider,
      createdAt: campaignBrief.createdAt,
    },
    201,
  );
});

export { campaignBriefRoutes };
