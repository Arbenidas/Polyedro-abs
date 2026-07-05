import { createOpenAI } from "@ai-sdk/openai";
import { uploadGeneratedImage } from "@/api/services/images/storage";
import type { GeneratedImage, ImageProvider, ImageRequest } from "@/api/services/images/types";
import { ApiError } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";
import { generateImage as sdkGenerateImage } from "ai";

/** Provider OpenAI (gpt-image) vía Vercel AI SDK, mismo stack que los agentes
 *  de texto. gpt-image devuelve bytes base64 (no URL hosteada), así que el
 *  resultado se sube a Supabase Storage y se guarda nuestra URL pública.
 *  Requiere OPENAI_API_KEY y organización verificada en OpenAI. */

// gpt-image tarda hasta ~2 min en prompts complejos según OpenAI.
const OPENAI_IMAGE_TIMEOUT_MS = 180_000;

/** gpt-image exige lados múltiplos de 16, ratio ≤3:1 y ≥655,360 px totales
 *  (ej. 1080×1080 → 1088×1088). */
const MIN_TOTAL_PIXELS = 655_360;

const toSupportedSize = (width: number, height: number) => {
  let mappedWidth = Math.max(Math.round(width / 16) * 16, 1024);
  let mappedHeight = Math.max(Math.round(height / 16) * 16, 1024);

  while (mappedWidth * mappedHeight < MIN_TOTAL_PIXELS) {
    mappedWidth += 16;
    mappedHeight += 16;
  }

  return { width: mappedWidth, height: mappedHeight };
};

let provider: ReturnType<typeof createOpenAI> | undefined;

const getImageModel = () => {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, "OPENAI_API_KEY is not configured");
  }
  provider ??= createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return provider.image(env.OPENAI_IMAGE_MODEL);
};

const generate = async (request: ImageRequest): Promise<GeneratedImage> => {
  const size = toSupportedSize(request.width, request.height);

  const { image } = await sdkGenerateImage({
    model: getImageModel(),
    prompt: request.prompt,
    size: `${size.width}x${size.height}`,
    providerOptions: {
      openai: {
        quality: env.IMAGE_QUALITY,
        outputFormat: "jpeg",
      },
    },
    abortSignal: AbortSignal.timeout(OPENAI_IMAGE_TIMEOUT_MS),
  });

  const url = await uploadGeneratedImage({
    bytes: image.uint8Array,
    contentType: image.mediaType ?? "image/jpeg",
    keyPrefix: "openai",
  });

  return {
    url,
    provider: "openai",
    model: env.OPENAI_IMAGE_MODEL,
    width: size.width,
    height: size.height,
  };
};

export const openaiProvider: ImageProvider = {
  name: "openai",
  isConfigured: () => !!env.OPENAI_API_KEY,
  generate,
};
