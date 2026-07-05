import {
  generateDemoCreative,
  generateStylePreview,
} from "@/api/services/demo-creatives";
import { ApiError } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

/** Rutas públicas (sin auth) para el voice-demo estático. Se montan fuera de
 *  /api/* para que no pasen por requireAuth. */

const demoCreativeSchema = z.object({
  concept: z.enum(["launch", "leads", "proof"]).default("launch"),
  brandName: z.string().trim().max(200).optional(),
  brief: z.string().trim().max(2000).optional(),
  audience: z.string().trim().max(120).optional(),
  audienceLabel: z.string().trim().max(200).optional(),
  goal: z.string().trim().max(120).optional(),
  goalLabel: z.string().trim().max(200).optional(),
  style: z.string().trim().max(120).optional(),
  styleLabel: z.string().trim().max(200).optional(),
  audienceNotes: z.string().trim().max(2000).optional(),
  socialLink: z.string().trim().max(500).optional(),
  proposalNotes: z.string().trim().max(2000).optional(),
  memory: z.array(z.string().trim().max(500)).max(20).optional(),
});

const stylePreviewSchema = z.object({
  styleKey: z.string().trim().min(1).max(120),
  brandName: z.string().trim().max(200).optional(),
  audience: z.string().trim().max(120).optional(),
  goal: z.string().trim().max(120).optional(),
});

const publicRoutes = new Hono();

publicRoutes.post("/demo/creatives", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = demoCreativeSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid demo creative input", parsed.error.flatten());
  }

  const { concept, ...input } = parsed.data;
  const creative = await generateDemoCreative(input, concept);

  return c.json({ creative });
});

publicRoutes.post("/demo/style-preview", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = stylePreviewSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid style preview input", parsed.error.flatten());
  }

  const { styleKey, ...input } = parsed.data;
  const preview = await generateStylePreview(styleKey, input);

  return c.json({ preview });
});

export { publicRoutes };
