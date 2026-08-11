import { json, preflight, requireAuthorization } from "../_shared/http.ts";
import { deepSeekJson } from "../_shared/deepseek.ts";
import { resolveStyle, styleDirectionFor, paletteDirective } from "../_shared/style-directions.ts";

// generate-editorial-asset ya NO genera imágenes raster (Alibaba eliminado).
// Ahora es un razonador que, dado un contexto editorial, devuelve la
// ESPECIFICACIÓN de un asset VECTORIAL editable (formas SVG + stickers del
// catálogo + paleta). El cliente la convierte en capas SVG editables dentro
// del canvas, reutilizando los recursos existentes y generando otros nuevos.
//
// Providers: solo DeepSeek (razonamiento de texto). MiMo puede usarse si se
// prefiere; el contrato es texto puro.

const SHAPE_TYPES = ["rect", "circle", "ellipse", "line", "arrow", "text"] as const;
const STICKERS = ["floppy", "folder", "bookmark", "star", "pencil", "cursor", "rocket", "clip", "code", "gear", "bulb", "underline", "cloud"] as const;

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const oneOf = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] => allowed.includes(value as T[number]) ? value as T[number] : fallback;
const numberIn = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

const example = {
  concept: "Flecha de proceso editorial",
  palette: ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"],
  shapes: [
    { type: "rect", x: 0.08, y: 0.3, width: 0.2, height: 0.16, fill: "paper", stroke: "ink", strokeWidth: 3, radius: 8, label: "Entrada" },
    { type: "arrow", x: 0.3, y: 0.37, width: 0.18, height: 0.05, fill: "brand", stroke: "brand", strokeWidth: 6 },
    { type: "rect", x: 0.5, y: 0.3, width: 0.2, height: 0.16, fill: "accent", stroke: "ink", strokeWidth: 3, radius: 8, label: "Proceso" },
  ],
  stickers: ["bookmark", "pencil"],
  motif: "proceso de aprendizaje",
  rationale: "Flujo de 3 pasos con acento de marca y stickers de guardado/anotación.",
};

function normalizeSpec(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error("INVALID_ASSET_SPEC");
  const shapes = Array.isArray(value.shapes) ? value.shapes.slice(0, 16).flatMap((item) => {
    if (!isObject(item)) return [];
    const type = oneOf(item.type, SHAPE_TYPES, "rect");
    const fill = oneOf(item.fill, ["brand", "accent", "paper", "ink", "marker", "transparent"], "ink");
    const stroke = item.stroke ? oneOf(item.stroke, ["brand", "accent", "paper", "ink", "marker"], "ink") : undefined;
    return [{
      type,
      x: numberIn(item.x, 0, 1, .1),
      y: numberIn(item.y, 0, 1, .1),
      width: numberIn(item.width, 0, 1, .2),
      height: numberIn(item.height, 0, 1, .2),
      fill,
      stroke,
      strokeWidth: numberIn(item.strokeWidth, 0, 20, 3),
      radius: type === "rect" ? numberIn(item.radius, 0, 60, 8) : undefined,
      rotation: numberIn(item.rotation, -180, 180, 0),
      label: text(item.label, 40) || undefined,
    }];
  }) : [];
  const stickers = Array.isArray(value.stickers) ? value.stickers.filter((s): s is string => STICKERS.includes(s as typeof STICKERS[number])).slice(0, 6) : [];
  return {
    concept: text(value.concept, 120) || "Asset editorial",
    palette: Array.isArray(value.palette) ? value.palette.filter((c): c is string => typeof c === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(c.trim())).slice(0, 4) : [],
    shapes,
    stickers,
    motif: text(value.motif, 160) || "",
    rationale: text(value.rationale, 320) || "",
  };
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    requireAuthorization(request);
    const input = await request.json();
    const basePrompt = text(input.prompt);
    if (!basePrompt) return json({ error: "prompt es obligatorio" }, 400);

    const style = resolveStyle(input.style ?? Deno.env.get("EDITORIAL_STYLE"));
    const { positive } = styleDirectionFor(style);
    const paletteText = paletteDirective(Array.isArray(input.palette) ? input.palette : undefined);
    const context = input.context && typeof input.context === "object" ? JSON.stringify(input.context).slice(0, 2_000) : "";

    const system = `Eres el razonador de assets vectoriales de Polyedro. Dado un contexto editorial, diseñas la ESPECIFICACIÓN de un asset SVG EDITABLE (no una imagen). Devuelve solo JSON válido.

REGLAS
- shapes: 1-6 formas vectoriales (rect, circle, ellipse, line, arrow, text) con coordenadas normalizadas 0-1. Usa tokens de color ("brand", "accent", "paper", "ink", "marker") para que el brand kit lo coloree.
- stickers: elige del catálogo existente (${STICKERS.join(", ")}) los que refuercen el concepto. Nunca inventes nombres de sticker.
- Cuando el contexto lo pida, diseña formas NUEVAS (no repitas plantillas) que representen el concepto con claridad.
- palette: 2-4 hex (#RRGGBB) coherentes con la dirección estética.
- concept: idea central en una frase. rationale: 1-2 frases explicando la decisión de diseño.
Dirección estética a respetar: ${positive}. ${paletteText ? ` ${paletteText}` : ""}${context ? `\nContexto adicional: ${context}` : ""}
El asset debe poder editarse forma por forma en un canvas: sin raster, sin texto incrustado salvo labels de nodo, sin logos de marcas reales.

El json debe seguir exactamente esta forma: ${JSON.stringify(example)}`;

    const result = await deepSeekJson<unknown>([
      { role: "system", content: system },
      { role: "user", content: `Concepto a representar: ${basePrompt}\nGenera la especificación del asset vectorial editable.` },
    ], 3_000);

    return json({ ...normalizeSpec(result.data), provider: "deepseek", model: result.model, style });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json({ error: message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
