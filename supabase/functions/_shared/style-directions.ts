// Librería anti-slop de direcciones visuales. Guía la estética que los
// razonadores (DeepSeek/MiMo) deben respetar al componer assets vectoriales
// editables y al elegir layout/color.
//
// Filosofía: sin generación de imágenes raster, la dirección de estilo sirve
// para que el razonador no caiga en clichés: cada composición recibe
//   1. una dirección de estilo POSITIVA concreta (qué hacer),
//   2. una dirección NEGATIVA (qué evitar, anti-clichés),
//   3. la paleta real de la marca.
//
// Portado desde apps/server/.../demo-creatives.ts y enriquecido con un default
// alineado a la voz editorial de arbe.blog (técnica cálida, con carácter).

export type StyleKey =
  | "neobrutal" | "editorial" | "tech" | "minimal" | "premium" | "grunge"
  | "render3d" | "ilustrado" | "brutalist" | "pop-art" | "art-deco" | "botanico";

/** Dirección positiva por estilo. Cada entrada es concreta y termina con un
 *  "no es X" para alejar al modelo del cliché opuesto. */
export const STYLE_DIRECTIONS: Record<StyleKey, string> = {
  neobrutal:
    "Neo-brutalist editorial aesthetic: bold flat blocks of warm orange, deep teal and off-white, thick black outlines, hard offset shadows, oversized geometric shapes. Swiss typographic discipline. Confident and intentional, not cartoony or noisy.",
  editorial:
    "Refined editorial aesthetic: premium paper textures, generous negative space, elegant serif accents, muted warm palette, sophisticated and trustworthy. Magazine-quality composition, not templated.",
  tech:
    "Modern SaaS/tech aesthetic: clean modular grid, soft diffused gradients, data panels, electric blue and teal accents, crisp glassmorphism panels, futuristic but restrained.",
  minimal:
    "Ultra-minimalist: pure white backgrounds, microscopic sans-serif type, single focal element with surgical precision, Scandinavian restraint, abundant breathing room. Architectural, not empty.",
  premium:
    "Luxury fashion-ad aesthetic: deep blacks, gold leaf accents, marble or silk micro-textures, dramatic spotlight lighting, high-end product photography, exclusive feel. Rich and tactile.",
  grunge:
    "Deconstructed zine/collage aesthetic: photocopy grain, torn paper edges, ransom-note typography, raw black and acid yellow with unexpected red splashes, DIY punk energy. Hand-made, imperfect, urgent.",
  render3d:
    "Cinematic 3D product render: physically based materials, dramatic studio lighting, depth of field bokeh, floating in space on a dark reflective surface, premium CGI feel. Hyper-real textures.",
  ilustrado:
    "Hand-drawn illustration style: organic brush strokes, sketchbook paper texture, custom hand-lettering accents, warm ink and watercolor palette, artisanal and human feel. Not vector-clean, intentionally rough.",
  brutalist:
    "Raw concrete architecture aesthetic: declassified blueprint vibe, Swiss mono typography, exposed grid lines, industrial materials, analog degradation effects. Severe, honest, institutional but beautiful.",
  "pop-art":
    "Pop art comic panel: halftone dots, bold Ben-Day primary colors, thick black ink outlines, speech bubbles, Roy Lichtenstein energy. Graphic, punchy, loud but deliberate.",
  "art-deco":
    "Art Deco geometric elegance: symmetrical sunburst patterns, gold foil on black lacquer, stepped geometric borders, 1920s sophistication. Ornate but structured, not gaudy.",
  botanico:
    "Botanical herbarium aesthetic: vintage scientific illustrations, pressed flowers, warm terracotta and sage greens, deckled-edge paper, organic textures, earthy and calm. Natural history museum meets modern brand.",
};

/** Dirección negativa por estilo: los clichés visuales que el modelo tiende a
 *  generar y que arruinan la pieza. Se inyecta como "Avoid..." en el prompt. */
export const STYLE_NEGATIVE_DIRECTIONS: Partial<Record<StyleKey, string>> = {
  minimal:
    "Avoid neo-brutalist cues: no thick black outlines, no acid green blocks, no comic shadows, no collage, no loud poster typography. Keep it quiet, white, sparse and restrained.",
  editorial:
    "Avoid neon startup graphics, heavy outlines, comic effects, zine collage, and aggressive geometric blocks.",
  premium:
    "Avoid bright acid colors, playful poster shapes, cartoon outlines, and casual SaaS UI panels.",
  grunge:
    "Avoid clean corporate SaaS minimalism, luxury polish, perfect grids, and sterile white-space-only layouts.",
  render3d:
    "Avoid flat poster collage, illustrated line art, halftone comic effects, and paper editorial layouts.",
  ilustrado:
    "Avoid photoreal CGI, luxury product photography, flat SaaS dashboards, and neo-brutalist poster blocks.",
  brutalist:
    "Avoid playful pop colors, luxury gloss, botanical softness, and friendly rounded SaaS visuals.",
  "pop-art":
    "Avoid minimalist white editorial layouts, luxury black-and-gold product photography, and muted botanical palettes.",
  "art-deco":
    "Avoid neon brutalist colors, collage/zine textures, SaaS dashboard panels, and cartoonish comic treatment.",
  botanico:
    "Avoid acid green neo-brutalism, hard black poster shadows, tech dashboards, and luxury black-gold gloss.",
};

/** Estilo por defecto cuando ni el cliente ni la config lo fijan. Alineado con
 *  la voz técnica con carácter de arbe.blog y la paleta LOCAL_BRAND. */
export const DEFAULT_STYLE: StyleKey = "neobrutal";

/** Negative prompt base universal anti-slop (independiente del estilo). Cubre
 *  los defectos más comunes de los modelos de imagen al generar assets
 *  editoriales aislados. */
export const BASE_NEGATIVE_PROMPT =
  "blurry, low quality, AI generated look, oversaturated, generic stock photo, clip art, watermark, signature, text, letters, numbers, measurements, UI labels, logos, fake brands, distorted anatomy, extra limbs, deformed hands, cluttered composition, busy background, default AI lighting, plastic skin, hyper-smooth bokeh cliché, empty frame, blank card, torn paper edges (unless requested), heavy grunge (unless requested)";

export const isStyleKey = (value: unknown): value is StyleKey =>
  typeof value === "string" && value in STYLE_DIRECTIONS;

/** Resuelve un estilo desde un valor remoto (string del cliente/env); cae al
 *  DEFAULT_STYLE si no es válido. Nunca lanza. */
export const resolveStyle = (value: unknown): StyleKey =>
  isStyleKey(value) ? value : DEFAULT_STYLE;

/** Devuelve la dirección positiva + negativa + base de un estilo. Lo que
 *  necesita el caller para construir el prompt final. */
export const styleDirectionFor = (style: StyleKey) => {
  const positive = STYLE_DIRECTIONS[style];
  const specificNegative = STYLE_NEGATIVE_DIRECTIONS[style];
  const negative = specificNegative
    ? `${BASE_NEGATIVE_PROMPT}. ${specificNegative}`
    : BASE_NEGATIVE_PROMPT;
  return { positive, negative };
};

/** Construye la parte de paleta para el prompt. Acepta hex y los inyecta con
 *  nombres tokenizados para que el modelo los priorice sobre su default. */
export const paletteDirective = (palette: unknown): string => {
  if (!Array.isArray(palette) || palette.length === 0) return "";
  const colors = palette
    .filter((c): c is string => typeof c === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(c.trim()))
    .slice(0, 4)
    .map((c) => (c.startsWith("#") ? c : `#${c}`));
  if (!colors.length) return "";
  const roles = ["primary", "secondary", "accent/paper", "ink"];
  const pairs = colors.map((c, i) => `${roles[i] ?? "extra"} ${c}`).join(", ");
  return `Use ONLY this brand palette (${pairs}). Never introduce off-palette colors, gradients or neon defaults.`;
};

/** Compone el prompt editorial completo: prompt base + dirección de estilo
 *  positiva + paleta + cláusula anti-texto + negative prompt (vía retorno
 *  separado, porque openai no acepta negative_prompt nativo). */
export const buildEditorialPrompt = (input: {
  basePrompt: string;
  style?: StyleKey;
  palette?: unknown;
  /** true si el output debe ser un asset aislado (pegatina/elemento), false si
   *  es una composición/poster completo. */
  assetOnly?: boolean;
}): { prompt: string; negativePrompt: string } => {
  const style = resolveStyle(input.style);
  const { positive, negative } = styleDirectionFor(style);
  const palette = paletteDirective(input.palette);
  const isolation = input.assetOnly
    ? "Isolated single asset only, centered with generous clean margins and a transparent or solid-paper background. Do NOT compose a full poster or social-media layout."
    : "Compose a fresh editorial interpretation with one clear focal point and intentional negative space.";
  const antiText =
    "Do NOT draw words, letters, numbers, measurements, UI labels, logos, watermarks, posters or complete social-media layouts inside the image.";
  const parts = [
    input.basePrompt.trim(),
    positive,
    palette,
    isolation,
    antiText,
  ].filter(Boolean);
  return { prompt: parts.join(" "), negativePrompt: negative };
};
