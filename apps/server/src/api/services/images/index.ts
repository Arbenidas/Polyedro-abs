import { falProvider } from "@/api/services/images/fal";
import { buildPlaceholderImage, placeholderProvider } from "@/api/services/images/placeholder";
import { openaiProvider } from "@/api/services/images/openai";
import type { GeneratedImage, ImageProvider, ImageRequest } from "@/api/services/images/types";
import { env } from "@Polyedro-abs/env/server";

/** Punto de entrada de generación de imágenes. La selección de provider es
 *  configuración (IMAGE_PROVIDER), no código:
 *   - "auto": primer provider real configurado (fal → openai); sin keys,
 *     placeholder.
 *   - nombre explícito: ese provider; si no está configurado, placeholder.
 *  Errores de un provider real SÍ se propagan — cada caller decide su
 *  política de fallback (el Brand Agent cae a placeholder, el Creative Agent
 *  marca la variante como fallida). */

/** Orden de preferencia en "auto": fal era la elección original de producto;
 *  openai es el reemplazo activo mientras fal no se use. */
const REAL_PROVIDERS: ImageProvider[] = [falProvider, openaiProvider];

export const resolveImageProvider = (): ImageProvider => {
  if (env.IMAGE_PROVIDER === "placeholder") {
    return placeholderProvider;
  }

  if (env.IMAGE_PROVIDER === "auto") {
    return REAL_PROVIDERS.find((provider) => provider.isConfigured()) ?? placeholderProvider;
  }

  const named = REAL_PROVIDERS.find((provider) =>
    provider.name === (env.IMAGE_PROVIDER === "fal" ? "fal.ai" : env.IMAGE_PROVIDER),
  );

  return named?.isConfigured() ? named : placeholderProvider;
};

export const generateImage = async (request: ImageRequest): Promise<GeneratedImage> =>
  resolveImageProvider().generate(request);

export const generatePlaceholderImage = (request: ImageRequest): GeneratedImage =>
  buildPlaceholderImage(request);

export type { GeneratedImage, ImageRequest } from "@/api/services/images/types";
