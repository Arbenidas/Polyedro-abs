import { ApiError } from "@/api/shared";
import { deepSeekJson, isDeepSeekConfigured } from "@/api/services/deepseek";
import type { EditorialBrandInput } from "@/api/services/editorial";

/** Reescribe el copy (headline + body) de UNA lámina de un carrusel
 *  manteniendo la misma idea y el rol del slide, pero con texto nuevo y fresco
 *  escrito con Smart Brevity. Pensado para el botón "Regenerar contenido" del
 *  editor cuando un slide queda muy escueto o fuera de contexto. */

export type SlideRegenerateInput = {
  slide: { headline: string; body: string; role: string };
  brand?: EditorialBrandInput;
  planContext?: { topic?: string; caption?: string; cta?: string; contentType?: string };
  goal?: string;
  audience?: string;
};

export type SlideRegenerateResult = {
  headline: string;
  body: string;
};

const example: SlideRegenerateResult = {
  headline: "Headline nuevo, máximo 12 palabras.",
  body: "¿Por qué importa? Detalle concreto. Máx 2 oraciones.",
};

function buildPrompt(input: SlideRegenerateInput): string {
  const brand = input.brand?.description ? `\nVoz de marca: "${input.brand.description}"` : "";
  const context = input.planContext?.topic ? `\nContexto del plan: tema="${input.planContext.topic}", tipo=${input.planContext.contentType ?? "n/d"}` : "";
  const goal = input.goal ? `\nIntención: ${input.goal}` : "";
  const audience = input.audience ? `\nAudiencia: ${input.audience}` : "";
  return `Reescribe el copy de esta lámina de un carrusel de Instagram. Mantén la misma idea y el rol "${input.slide.role}", pero genera headline + body NUEVOS con Smart Brevity.${brand}${context}${goal}${audience}

REGLAS SMART BREVITY
- headline: LA idea en negrita. Máx 12 palabras (84 caracteres). Original, no extracto.
- body: "¿Por qué importa?" + detalle concreto. Máx 2 oraciones (260 caracteres).
- Sin relleno. Sin oraciones de más de 25 palabras. Lead con verbo.
- Prohibido: headers markdown (##), "El 2026 trae…", "En el mundo de…", "Es importante…".
- Cero hype words ("desbloquea", "potencia", "revoluciona"). Voz técnica con humor seco.
- Si el slide actual tiene datos concretos, reutilízalos pero reescritos.

El json debe seguir exactamente esta forma: ${JSON.stringify(example)}`;
}

export const regenerateSlide = async (input: SlideRegenerateInput): Promise<SlideRegenerateResult> => {
  if (!isDeepSeekConfigured()) throw new ApiError(500, "DEEPSEEK_API_KEY_MISSING");
  const result = await deepSeekJson<unknown>(
    [
      { role: "system", content: buildPrompt(input) },
      { role: "user", content: `Reescribe esta lámina:\n${JSON.stringify(input.slide)}` },
    ],
    1_500,
  );
  const data = result.data as Record<string, unknown>;
  const headline = typeof data?.headline === "string" && data.headline.trim() ? data.headline.trim() : input.slide.headline;
  const body = typeof data?.body === "string" && data.body.trim() ? data.body.trim() : input.slide.body;
  return { headline: headline.slice(0, 120), body: body.slice(0, 320) };
};
