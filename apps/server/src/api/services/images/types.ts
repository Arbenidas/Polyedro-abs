/** Contrato del adapter de generación de imágenes (patrón Strategy/Adapter):
 *  cada provider (fal, openai, placeholder) implementa ImageProvider y la
 *  selección se hace por env IMAGE_PROVIDER en images/index.ts. Cambiar de
 *  proveedor = configuración, no código. */

export type ImageRequest = {
  prompt: string;
  /** Dimensiones deseadas; cada provider las mapea a lo que soporta y
   *  devuelve las reales en GeneratedImage. */
  width: number;
  height: number;
  /** Hints para el provider placeholder (texto y color de marca). */
  placeholder: {
    label: string;
    background?: string;
  };
};

export type GeneratedImage = {
  url: string;
  provider: "fal.ai" | "openai" | "placeholder";
  model?: string;
  seed?: number;
  width: number;
  height: number;
};

export type ImageProvider = {
  name: GeneratedImage["provider"];
  isConfigured: () => boolean;
  generate: (request: ImageRequest) => Promise<GeneratedImage>;
};
