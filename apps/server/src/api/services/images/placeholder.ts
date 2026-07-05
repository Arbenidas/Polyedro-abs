import type { GeneratedImage, ImageProvider, ImageRequest } from "@/api/services/images/types";

/** Provider placeholder: URLs de placehold.co con el color de marca. Siempre
 *  disponible; es el fallback cuando ningún provider real está configurado. */

const DEFAULT_BACKGROUND = "#B7FF1A";

export const buildPlaceholderImage = (request: ImageRequest): GeneratedImage => {
  const background = (request.placeholder.background ?? DEFAULT_BACKGROUND).replace("#", "");
  const text = encodeURIComponent(request.placeholder.label);

  return {
    url: `https://placehold.co/${request.width}x${request.height}/${background}/111111/png?text=${text}`,
    provider: "placeholder",
    width: request.width,
    height: request.height,
  };
};

export const placeholderProvider: ImageProvider = {
  name: "placeholder",
  isConfigured: () => true,
  generate: async (request) => buildPlaceholderImage(request),
};
