import { env } from "@Polyedro-abs/env/server";
import { ApiError } from "@/api/shared";
import { db } from "@/db";
import { brands, campaignBriefs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_TRANSCRIPTION_MODEL = "whisper-1";
const TRANSCRIPTION_LANGUAGE = "es";

const transcriptionRoutes = new Hono();

transcriptionRoutes.post("/", async (c) => {
  const formData = await c.req.raw.formData().catch(() => null);
  const audio = formData?.get("audio");
  const parsedBrandId = z.uuid().safeParse(formData?.get("brandId"));

  if (!parsedBrandId.success) {
    throw new ApiError(400, "Brand id is required.");
  }

  if (!(audio instanceof File)) {
    throw new ApiError(400, "Audio file is required.");
  }

  if (!audio.size) {
    throw new ApiError(400, "Audio file is empty.");
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    throw new ApiError(400, "Audio file must be 25 MB or smaller.");
  }

  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, parsedBrandId.data),
  });

  if (!brand) {
    throw new ApiError(404, "Brand not found.");
  }

  const openaiFormData = new FormData();
  openaiFormData.append("file", audio, audio.name || "campaign-brief.webm");
  openaiFormData.append("model", OPENAI_TRANSCRIPTION_MODEL);
  openaiFormData.append("language", TRANSCRIPTION_LANGUAGE);
  openaiFormData.append("response_format", "json");

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: openaiFormData,
  });

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    console.error("OpenAI transcription failed", body);
    throw new ApiError(500, "Could not transcribe audio.");
  }

  const text = (body as { text?: unknown } | undefined)?.text;

  if (typeof text !== "string") {
    throw new ApiError(500, "Transcription response was invalid.");
  }

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
