import { ApiError } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";

/** Helper compartido para generar imágenes con Flux vía Fal.ai (endpoint
 *  síncrono fal.run). Lo usan el Creative Agent y el Brand Agent (logo). */

export type GeneratedImage = {
  url: string;
  provider: "fal.ai" | "placeholder";
  model?: string;
  seed?: number;
  width: number;
  height: number;
};

const FAL_REQUEST_TIMEOUT_MS = 120_000;

/** Errores transitorios en los que fal recomienda reintentar del lado cliente
 *  (las llamadas síncronas a fal.run no tienen retries del lado del server). */
const TRANSIENT_STATUSES = new Set([408, 502, 503, 504]);

type FalImageResponse = {
  images?: { url?: string; width?: number; height?: number }[];
  seed?: number;
};

export const isFalConfigured = () => !!env.FAL_KEY;

const requestFalImage = (
  falKey: string,
  input: { prompt: string; width: number; height: number },
) =>
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
      prompt: input.prompt,
      image_size: { width: input.width, height: input.height },
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(FAL_REQUEST_TIMEOUT_MS),
  });

/** Genera una imagen con Fal.ai. Lanza ApiError si FAL_KEY no está
 *  configurada o la generación falla; los callers deciden su fallback. */
export const generateFalImage = async (input: {
  prompt: string;
  width: number;
  height: number;
}): Promise<GeneratedImage> => {
  if (!env.FAL_KEY) {
    throw new ApiError(500, "FAL_KEY is not configured");
  }

  let response = await requestFalImage(env.FAL_KEY, input);

  if (TRANSIENT_STATUSES.has(response.status)) {
    response = await requestFalImage(env.FAL_KEY, input);
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
    width: image.width ?? input.width,
    height: image.height ?? input.height,
  };
};
