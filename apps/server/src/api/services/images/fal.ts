import type { GeneratedImage, ImageProvider, ImageRequest } from "@/api/services/images/types";
import { ApiError } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";

/** Provider Fal.ai (Flux vía endpoint síncrono fal.run). Dormante mientras no
 *  haya FAL_KEY; al reactivarlo considerar migrar a @ai-sdk/fal para unificar
 *  con el provider de OpenAI. */

const FAL_REQUEST_TIMEOUT_MS = 120_000;

/** Errores transitorios en los que fal recomienda reintentar del lado cliente
 *  (las llamadas síncronas a fal.run no tienen retries del lado del server). */
const TRANSIENT_STATUSES = new Set([408, 502, 503, 504]);

type FalImageResponse = {
  images?: { url?: string; width?: number; height?: number }[];
  seed?: number;
};

const requestFalImage = (falKey: string, request: ImageRequest) =>
  fetch(`https://fal.run/${env.FAL_IMAGE_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
      // Sin esto los archivos del CDN de fal pueden expirar y las URLs
      // guardadas en la base quedarían rotas.
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({
        expiration_duration_seconds: null,
      }),
    },
    body: JSON.stringify({
      prompt: request.prompt,
      image_size: { width: request.width, height: request.height },
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(FAL_REQUEST_TIMEOUT_MS),
  });

const generate = async (request: ImageRequest): Promise<GeneratedImage> => {
  if (!env.FAL_KEY) {
    throw new ApiError(500, "FAL_KEY is not configured");
  }

  let response = await requestFalImage(env.FAL_KEY, request);

  if (TRANSIENT_STATUSES.has(response.status)) {
    response = await requestFalImage(env.FAL_KEY, request);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => undefined);
    throw new ApiError(500, `Fal.ai image generation failed (${response.status})`, detail);
  }

  const data = (await response.json()) as FalImageResponse;
  const image = data.images?.[0];

  if (!image?.url) {
    throw new ApiError(500, "Fal.ai returned no image", data);
  }

  return {
    url: image.url,
    provider: "fal.ai",
    model: env.FAL_IMAGE_MODEL,
    seed: data.seed,
    width: image.width ?? request.width,
    height: image.height ?? request.height,
  };
};

export const falProvider: ImageProvider = {
  name: "fal.ai",
  isConfigured: () => !!env.FAL_KEY,
  generate,
};
