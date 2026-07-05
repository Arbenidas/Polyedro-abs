import { ApiError } from "@/api/shared";
import {
  OPENAI_TRANSCRIPTION_MODEL,
  TRANSCRIPTION_LANGUAGE,
  assertValidAudioFile,
  transcribeAudioFile,
} from "@/api/services/transcription";
import { db } from "@/db";
import { brands, campaignBriefs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { AuthEnv } from "@/middleware/auth";

const transcriptionRoutes = new Hono<AuthEnv>();

transcriptionRoutes.post("/", async (c) => {
  const formData = await c.req.raw.formData().catch(() => null);
  const audio = formData?.get("audio");
  const parsedBrandId = z.uuid().safeParse(formData?.get("brandId"));

  if (!parsedBrandId.success) {
    throw new ApiError(400, "Brand id is required.");
  }

  assertValidAudioFile(audio);

  // Ownership en la query, ANTES de llamar a OpenAI (evita quemar créditos
  // de transcripción contra marcas ajenas); 404 para no filtrar existencia.
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.id, parsedBrandId.data), eq(brands.userId, c.get("user").id)),
  });

  if (!brand) {
    throw new ApiError(404, "Brand not found.");
  }

  const text = await transcribeAudioFile(audio);

  const [campaignBrief] = await db
    .insert(campaignBriefs)
    .values({
      brandId: brand.id,
      language: TRANSCRIPTION_LANGUAGE,
      source: "microphone",
      provider: "openai",
      model: OPENAI_TRANSCRIPTION_MODEL,
      text,
      audioMimeType: audio.type || null,
      audioSizeBytes: audio.size,
      metadata: {
        originalFilename: audio.name || null,
      },
    })
    .returning();

  if (!campaignBrief) {
    throw new ApiError(500, "Transcription could not be saved.");
  }

  return c.json({
    id: campaignBrief.id,
    brandId: campaignBrief.brandId,
    campaignId: campaignBrief.campaignId,
    text: campaignBrief.text,
    language: campaignBrief.language,
    model: campaignBrief.model,
    provider: campaignBrief.provider,
    createdAt: campaignBrief.createdAt,
  });
});

export { transcriptionRoutes };
