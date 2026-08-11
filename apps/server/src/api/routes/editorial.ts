import { generateEditorialPlan } from "@/api/services/editorial";
import { requireBrandOwnership } from "@/api/services/brand-ownership";
import { parseBody, parseUuidParam } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

import type { AuthEnv } from "@/middleware/auth";

const createPostSchema = z.object({
  topic: z.string().trim().min(1),
  objective: z.string().trim().optional(),
  channel: z
    .enum(["instagram_portrait", "instagram_square", "tiktok_vertical", "linkedin_portrait"])
    .default("instagram_portrait"),
  sourceText: z.string().trim().optional(),
  preferences: z
    .object({
      format: z.enum(["auto", "single", "carousel"]).optional(),
      slideCount: z.union([z.literal("auto"), z.number().int().min(1).max(10)]).optional(),
      goal: z.enum(["teach", "save", "discuss", "act"]).optional(),
      audience: z.string().trim().optional(),
    })
    .optional(),
});

const editorialRoutes = new Hono<AuthEnv>();

/** Genera el guion editorial (EditorialPlan) para una marca. Las llamadas a
 *  DeepSeek/MiMo viven en el server — el cliente nunca ve las API keys. */
editorialRoutes.post("/brands/:brandId/content", async (c) => {
  const brandId = parseUuidParam(c.req.param("brandId"), "brandId");
  const input = await parseBody(c.req.raw, createPostSchema);

  const brand = await requireBrandOwnership(brandId, c.get("user").id);

  const sourceText = input.sourceText ?? input.topic;
  const plan = await generateEditorialPlan({
    brand: { name: brand.name, description: brand.description ?? undefined },
    sourceText,
    preferences: {
      channel: input.channel,
      format: input.preferences?.format ?? "auto",
      slideCount: input.preferences?.slideCount ?? "auto",
      goal: input.preferences?.goal ?? "teach",
      audience: input.preferences?.audience,
    },
  });

  return c.json(
    {
      plan,
      post: {
        id: crypto.randomUUID(),
        brandId,
        topic: plan.topic,
        objective: input.objective ?? input.topic,
        channel: input.channel,
        status: "review",
        hook: plan.hookCandidates.find((hook) => hook.id === plan.selectedHookId)?.text ?? plan.slides[0]?.headline ?? "",
        caption: plan.caption,
        callToAction: plan.cta,
      },
      slides: plan.slides.map((slide, index) => ({
        id: slide.id,
        postId: null,
        slideOrder: index + 1,
        imageUrl: null,
        status: "draft",
        content: {
          order: index + 1,
          kind: slide.role,
          headline: slide.headline,
          body: slide.body,
          composition: slide.recipeId,
          assetIds: [],
        },
      })),
      dimensions: { width: 1080, height: 1350, label: "Instagram 4:5" },
    },
    201,
  );
});

export { editorialRoutes };
