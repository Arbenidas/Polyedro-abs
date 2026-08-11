// Catálogo v3 — 8 recetas limpias. Cada una hace UNA cosa.
// Sin AI slop: cero metadata visible, cero duplicados, cero hardcodeo.
// Diseñadas para que el usuario agregue stickers/imágenes después.

export type EditorialContentType =
  | "tutorial" | "list" | "comparison" | "opinion"
  | "repo" | "case-study" | "release" | "resource";

export type EditorialRole =
  | "cover" | "intro" | "step" | "comparison" | "summary" | "cta";

export type EditorialStyle = "editorial" | "technical" | "notebook" | "minimal" | "bold" | "playful";
export type EditorialDensity = "low" | "medium" | "high";
export type EditorialAssetReq = "none" | "optional" | "image" | "screenshot" | "icons";

export type EditorialRecipeId =
  | "cover" | "typographic-poster" | "photo" | "card" | "split"
  | "quote" | "number" | "cta" | "body"
  // v4 — familias visuales nuevas (editorial, bold, data, demo)
  | "editorial-hero" | "editorial-step" | "editorial-quote" | "editorial-list"
  | "bold-headline" | "bold-stat" | "bold-contrast"
  | "demo-frame" | "code-block" | "micro-diagram" | "minimal-text" | "checklist"
  // Legacy v1/v2 — solo backward compat
  | "type-hero" | "screenshot-frame" | "editorial-spread"
  | "sticker-board" | "card-grid" | "clean-statement"
  | "grid-manifesto" | "article-hero" | "cutout-spotlight" | "technical-flow"
  | "code-window" | "numbered-lesson" | "split-comparison" | "evidence-frame"
  | "pull-quote" | "metric-board" | "editorial-collage" | "signature-cta";

export type RecipeIntent = {
  id: EditorialRecipeId;
  family: string;
  role: EditorialRole;
  roles: EditorialRole[];
  style: EditorialStyle;
  density: EditorialDensity;
  contentTypes: EditorialContentType[];
  asset: EditorialAssetReq;
  intent: string;
};

export const EDITORIAL_RECIPES: RecipeIntent[] = [
  {
    id: "cover", family: "Cover", role: "cover", roles: ["cover"],
    style: "bold", density: "low", contentTypes: ["tutorial", "opinion", "release", "resource", "list", "case-study"], asset: "none",
    intent: "Solo título grande en fondo de color. Nada más. Para portadas contundentes.",
  },
  {
    id: "typographic-poster", family: "Typographic Poster", role: "cover", roles: ["cover", "summary"],
    style: "bold", density: "medium", contentTypes: ["tutorial", "opinion", "release", "resource", "list", "case-study"], asset: "none",
    intent: "Póster tipográfico con eyebrow, titular multinivel, palabra de acento, subtítulo y micro-motivos. Para hooks cuya personalidad está en la jerarquía del texto.",
  },
  {
    id: "photo", family: "Photo", role: "intro", roles: ["intro", "cover", "step"],
    style: "editorial", density: "medium", contentTypes: ["case-study", "tutorial", "release", "opinion"], asset: "image",
    intent: "Área de foto + título abajo. Para cuando el usuario va a poner una imagen.",
  },
  {
    id: "card", family: "Card", role: "step", roles: ["step", "intro", "summary"],
    style: "minimal", density: "medium", contentTypes: ["tutorial", "list", "resource", "comparison", "opinion"], asset: "none",
    intent: "Una sola tarjeta con borde: título + texto. Limpia, sin adornos. Para pasos individuales.",
  },
  {
    id: "split", family: "Split", role: "comparison", roles: ["comparison", "step", "intro"],
    style: "technical", density: "medium", contentTypes: ["comparison", "opinion", "case-study"], asset: "none",
    intent: "Dos columnas: número de acento a la izquierda, título y texto a la derecha. Para comparativas y contraste.",
  },
  {
    id: "quote", family: "Quote", role: "summary", roles: ["summary", "cta", "cover"],
    style: "editorial", density: "low", contentTypes: ["opinion", "case-study", "resource", "tutorial", "list", "comparison", "release"], asset: "none",
    intent: "Frase grande centrada con línea de atribución. Para takeaways y citas.",
  },
  {
    id: "number", family: "Number", role: "step", roles: ["step", "summary"],
    style: "bold", density: "low", contentTypes: ["list", "tutorial", "resource"], asset: "none",
    intent: "Número gigante + título corto. Para posts numerados y listicles.",
  },
  {
    id: "cta", family: "CTA", role: "cta", roles: ["cta"],
    style: "minimal", density: "low", contentTypes: ["tutorial", "list", "comparison", "resource", "case-study", "release", "repo", "opinion"], asset: "none",
    intent: "Tarjeta de cierre con llamado a la acción. Solo título y CTA. Para el último slide.",
  },
  {
    id: "body", family: "Body", role: "step", roles: ["step", "intro", "summary"],
    style: "editorial", density: "medium", contentTypes: ["tutorial", "list", "resource", "opinion", "case-study"], asset: "none",
    intent: "Solo texto con márgenes generosos. Sin título. Para desarrollo o explicaciones largas.",
  },
  // ── v4: Familia Editorial/Magazine ──────────────────────────────────
  {
    id: "editorial-hero", family: "Editorial Hero", role: "cover", roles: ["cover", "summary"],
    style: "editorial", density: "low", contentTypes: ["list", "resource", "tutorial"], asset: "optional",
    intent: "Número gigante + subtítulo en itálica + zona de imagen abajo. Estilo revista. Para portadas de listas numeradas.",
  },
  {
    id: "editorial-step", family: "Editorial Step", role: "step", roles: ["step", "intro"],
    style: "editorial", density: "medium", contentTypes: ["tutorial", "case-study", "resource"], asset: "optional",
    intent: "Título + cuerpo con espacio generoso y zona de demo abajo. Estilo magazine. Para pasos de tutorial.",
  },
  {
    id: "editorial-quote", family: "Editorial Quote", role: "summary", roles: ["summary", "cover", "cta"],
    style: "editorial", density: "low", contentTypes: ["opinion", "case-study", "tutorial"], asset: "none",
    intent: "Cita grande en serif con atribución. Estilo artículo. Para takeaways y posturas.",
  },
  {
    id: "editorial-list", family: "Editorial List", role: "step", roles: ["step", "summary"],
    style: "editorial", density: "high", contentTypes: ["list", "resource"], asset: "none",
    intent: "Lista numerada con bullets grandes. Para rankings y colecciones de items.",
  },
  // ── v4: Familia Bold/Statement ──────────────────────────────────────
  {
    id: "bold-headline", family: "Bold Headline", role: "cover", roles: ["cover", "cta"],
    style: "bold", density: "low", contentTypes: ["opinion", "tutorial", "release"], asset: "none",
    intent: "Headline masivo a pantalla completa en fondo sólido. Para hooks fuertes y statements contundentes.",
  },
  {
    id: "bold-stat", family: "Bold Stat", role: "step", roles: ["step", "summary"],
    style: "bold", density: "low", contentTypes: ["case-study", "release", "opinion"], asset: "none",
    intent: "Número/dato gigante + contexto abajo. Para métricas impactantes y datos concretos.",
  },
  {
    id: "bold-contrast", family: "Bold Contrast", role: "comparison", roles: ["comparison", "step"],
    style: "bold", density: "medium", contentTypes: ["comparison", "opinion"], asset: "none",
    intent: "Dos columnas: SÍ vs NO o antes vs después. Para contrastes directos y posturas.",
  },
  // ── v4: Familia Demo/Technical ──────────────────────────────────────
  {
    id: "demo-frame", family: "Demo Frame", role: "step", roles: ["step", "intro"],
    style: "technical", density: "medium", contentTypes: ["repo", "release", "tutorial", "case-study"], asset: "image",
    intent: "Marco de screenshot/demo + título + caption. Para mostrar repos, features y demos.",
  },
  {
    id: "code-block", family: "Code Block", role: "step", roles: ["step", "intro"],
    style: "technical", density: "medium", contentTypes: ["tutorial", "repo", "release"], asset: "none",
    intent: "Bloque de código mono + título corto. Para snippets, comandos y ejemplos técnicos.",
  },
  {
    id: "micro-diagram", family: "Micro Diagram", role: "step", roles: ["step", "intro", "comparison", "summary"],
    style: "technical", density: "high", contentTypes: ["tutorial", "comparison", "repo", "case-study", "release", "resource"], asset: "icons",
    intent: "Diagrama editorial editable con 2–6 nodos. Para procesos, capas, timelines, ciclos, comparaciones y mapas de sistema donde la relación explica la idea.",
  },
  {
    id: "minimal-text", family: "Minimal Text", role: "cta", roles: ["cta", "summary", "cover"],
    style: "minimal", density: "low", contentTypes: ["tutorial", "list", "comparison", "resource", "case-study", "release", "repo", "opinion"], asset: "none",
    intent: "Texto minimal sobre fondo sólido. Para CTAs limpios y takeaways finales.",
  },
  {
    id: "checklist", family: "Checklist", role: "summary", roles: ["summary", "cta", "step"],
    style: "minimal", density: "high", contentTypes: ["tutorial", "resource", "list"], asset: "none",
    intent: "Checklist visual con items tachados/marcados. Para cierres tipo 'guarda esto'.",
  },
];

// ── Legacy aliases ────────────────────────────────────────────────────

const LEGACY_ALIASES: Record<string, EditorialRecipeId> = {
  // v2 → v3
  "type-hero": "cover",
  "screenshot-frame": "photo",
  "editorial-spread": "split",
  "sticker-board": "body",
  "card-grid": "card",
  "clean-statement": "quote",
  // v1 → v3
  "grid-manifesto": "cover",
  "article-hero": "photo",
  "cutout-spotlight": "photo",
  "technical-flow": "split",
  "code-window": "photo",
  "numbered-lesson": "number",
  "split-comparison": "split",
  "evidence-frame": "photo",
  "pull-quote": "quote",
  "metric-board": "number",
  "editorial-collage": "photo",
  "signature-cta": "cta",
  // Aliases muy viejos
  "sticker-stack": "cover", "annotated-headline": "cover", "giant-word": "cover",
  "folder-process": "split", "outlined-steps": "number", "floating-steps": "split",
  "repo-showcase": "photo", "technical-diagram": "split", "infographic": "number",
  "dark-collage": "photo", "riso-orbit": "photo", "type-cutout": "quote",
  "notebook-proof": "photo", "object-orbit": "photo",
  "type-pairing": "split", "system-symbol": "split", "editorial-cta": "cta",
  "numbered-point": "number", "contrast-split": "split", "reveal-block": "photo",
  "minimal-type": "quote", "editorial-list": "card", "tool-grid": "card",
  "image-hero": "photo", "minimal-stack": "quote",
};

const ALL_RECIPES = [...EDITORIAL_RECIPES];
const RECIPE_BY_ID = new Map<string, RecipeIntent>(ALL_RECIPES.map((r) => [r.id, r]));

export const CANONICAL_RECIPE_IDS: readonly EditorialRecipeId[] = EDITORIAL_RECIPES.map((r) => r.id);
export const isCanonicalRecipeId = (v: string): v is EditorialRecipeId => RECIPE_BY_ID.has(v);
export const recipeIntent = (id: EditorialRecipeId) => RECIPE_BY_ID.get(id);

const DEFAULT_BY_ROLE: Record<EditorialRole, EditorialRecipeId> = {
  cover: "cover", intro: "photo", step: "card",
  comparison: "split", summary: "quote", cta: "cta",
};

/** Aliases de las recetas v4 hacia las nuevas familias. Permite que
 *  pickRecipeForArc elija layouts más ricos según el arco narrativo. */
const V4_ENRICHED_BY_ROLE: Partial<Record<EditorialRole, EditorialRecipeId[]>> = {
  cover: ["editorial-hero", "bold-headline"],
  step: ["editorial-step", "editorial-list", "micro-diagram", "demo-frame", "code-block", "bold-stat"],
  comparison: ["micro-diagram", "bold-contrast"],
  summary: ["editorial-quote", "checklist", "minimal-text"],
  cta: ["minimal-text", "checklist"],
};

export const LEGACY_RECIPE_ALIASES = LEGACY_ALIASES;

export const resolveRecipeId = (id: string, role?: EditorialRole): EditorialRecipeId => {
  if (isCanonicalRecipeId(id)) return id;
  const alias = LEGACY_ALIASES[id];
  if (alias) return alias;
  return DEFAULT_BY_ROLE[role ?? "step"];
};

export const recipesByRole = (role: EditorialRole): EditorialRecipeId[] =>
  EDITORIAL_RECIPES.filter((r) => r.roles.includes(role)).map((r) => r.id);

export const recipesForContentType = (type: EditorialContentType): EditorialRecipeId[] =>
  EDITORIAL_RECIPES.filter((r) => r.contentTypes.includes(type)).map((r) => r.id);

/** Devuelve recetas v4 enriquecidas para un rol dado (o vacío si no hay). */
export const enrichedRecipesForRole = (role: EditorialRole): EditorialRecipeId[] =>
  V4_ENRICHED_BY_ROLE[role] ?? [];

export const pickRecipeForRole = (
  role: EditorialRole, contentType?: EditorialContentType, exclude?: string,
): EditorialRecipeId => {
  const preferred = recipesForContentType(contentType ?? "tutorial");
  const byRole = recipesByRole(role);
  const ordered = [...preferred, ...byRole, DEFAULT_BY_ROLE[role]];
  const resolvedExclude = exclude ? resolveRecipeId(exclude, role) : undefined;
  return ordered.find((id) => id !== resolvedExclude) ?? DEFAULT_BY_ROLE[role];
};
