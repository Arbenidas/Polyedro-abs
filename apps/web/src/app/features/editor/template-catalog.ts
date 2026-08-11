import type { ContentChannel } from "../../editorial.models";
import { CHANNEL_SIZES, type EditorialTemplate, type RecipeDecoration, type TemplateSlot } from "./editor.models";
import { resolveRecipeId, type EditorialRecipeId } from "./recipe-catalog";

export const TEMPLATE_CATALOG_VERSION = 12;

type RecipeDef = {
  id: string; family: string; role: EditorialTemplate["slideRole"];
  style: EditorialTemplate["style"]; density: EditorialTemplate["density"];
  contentTypes: string[]; asset: EditorialTemplate["assetRequirement"];
  slots: Array<{ role: TemplateSlot["role"]; frame: NonNullable<TemplateSlot["frame"]> }>;
  decorations: RecipeDecoration[];
};

const F = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });
const line = (x: number, y: number, w: number, h = 0, o = 0.22): RecipeDecoration =>
  ({ type: "line", frame: F(x, y, w, h), token: "ink", strokeToken: "ink", strokeWidth: 1, opacity: o });

export const VISUAL_RECIPES: RecipeDef[] = [
  // 1. COVER — solo título grande
  {
    id: "cover", family: "Cover", role: "cover", style: "bold", density: "low",
    contentTypes: ["tutorial", "opinion", "release", "resource", "list", "case-study"], asset: "none",
    slots: [{ role: "headline", frame: F(.08, .20, .84, .55) }],
    decorations: Array.from({ length: 4 }, (_, i) => line(.08 + i * .22, .10, 0, .40, .08)),
  },
  // 1B. TYPOGRAPHIC POSTER — jerarquía editorial de varios niveles
  {
    id: "typographic-poster", family: "Typographic Poster", role: "cover", style: "bold", density: "medium",
    contentTypes: ["tutorial", "opinion", "release", "resource", "list", "case-study"], asset: "none",
    slots: [
      { role: "headline", frame: F(.12, .30, .76, .34) },
      { role: "body", frame: F(.12, .68, .76, .08) },
      { role: "cta", frame: F(.10, .90, .22, .04) },
    ],
    decorations: [
      { type: "circle", frame: F(.10, .055, .014, .011), token: "accent" },
      { type: "rect", frame: F(.84, .052, .08, .014), token: "ink", opacity: .28 },
      { type: "rect", frame: F(.10, .90, .18, .024), token: "accent", radius: 999 },
      { type: "rect", frame: F(.86, .90, .035, .028), token: "ink" },
    ],
  },
  // 2. PHOTO — foto + título debajo
  {
    id: "photo", family: "Photo", role: "intro", style: "editorial", density: "medium",
    contentTypes: ["case-study", "tutorial", "release", "opinion"], asset: "image",
    slots: [
      { role: "hero-image", frame: F(.08, .08, .84, .52) },
      { role: "headline", frame: F(.08, .66, .84, .14) },
      { role: "body", frame: F(.08, .82, .64, .08) },
    ],
    decorations: [
      { type: "rect", frame: F(.08, .08, .84, .52), token: "transparent", strokeToken: "ink", strokeWidth: 2 },
    ],
  },
  // 3. CARD — una sola tarjeta con borde
  {
    id: "card", family: "Card", role: "step", style: "minimal", density: "medium",
    contentTypes: ["tutorial", "list", "resource", "comparison", "opinion"], asset: "none",
    slots: [
      { role: "headline", frame: F(.12, .14, .76, .22) },
      { role: "body", frame: F(.12, .40, .76, .42) },
    ],
    decorations: [
      { type: "rect", frame: F(.10, .12, .80, .72), token: "transparent", strokeToken: "ink", strokeWidth: 3, radius: 18 },
    ],
  },
  // 4. SPLIT — dos columnas: número | título + texto
  {
    id: "split", family: "Split", role: "comparison", style: "technical", density: "medium",
    contentTypes: ["comparison", "opinion", "case-study"], asset: "none",
    slots: [
      { role: "headline", frame: F(.40, .16, .52, .28) },
      { role: "body", frame: F(.40, .50, .52, .32) },
    ],
    decorations: [
      line(.34, .10, 0, .80, .55),
    ],
  },
  // 4B. MICRO DIAGRAM — la relación entre nodos es el contenido
  {
    id: "micro-diagram", family: "Micro Diagram", role: "step", style: "technical", density: "high",
    contentTypes: ["tutorial", "comparison", "repo", "case-study", "release", "resource"], asset: "icons",
    slots: [
      { role: "headline", frame: F(.08, .08, .84, .13) },
      { role: "body", frame: F(.08, .20, .84, .07) },
    ],
    decorations: [
      line(.08, .28, .84, 0, .18),
      line(.08, .91, .84, 0, .18),
    ],
  },
  // 5. QUOTE — frase grande centrada
  {
    id: "quote", family: "Quote", role: "summary", style: "editorial", density: "low",
    contentTypes: ["opinion", "case-study", "resource", "tutorial", "list", "comparison", "release"], asset: "none",
    slots: [
      { role: "headline", frame: F(.12, .26, .76, .44) },
      { role: "body", frame: F(.15, .74, .70, .08) },
    ],
    decorations: [line(.25, .70, .50, 0, .5)],
  },
  // 6. NUMBER — número gigante + título corto
  {
    id: "number", family: "Number", role: "step", style: "bold", density: "low",
    contentTypes: ["list", "tutorial", "resource"], asset: "none",
    slots: [
      { role: "headline", frame: F(.44, .22, .48, .52) },
    ],
    decorations: [
      { type: "rect", frame: F(.08, .18, .12, .018), token: "accent" },
    ],
  },
  // 7. CTA — cierre con llamado a la acción
  {
    id: "cta", family: "CTA", role: "cta", style: "minimal", density: "low",
    contentTypes: ["tutorial", "list", "comparison", "resource", "case-study", "release", "repo", "opinion"], asset: "none",
    slots: [
      { role: "headline", frame: F(.10, .20, .80, .36) },
      { role: "cta", frame: F(.10, .62, .80, .12) },
    ],
    decorations: [line(.10, .58, .26, 0, .6)],
  },
  // 8. BODY — solo texto con márgenes generosos
  {
    id: "body", family: "Body", role: "step", style: "editorial", density: "medium",
    contentTypes: ["tutorial", "list", "resource", "opinion", "case-study"], asset: "none",
    slots: [
      { role: "body", frame: F(.10, .10, .80, .72) },
    ],
    decorations: [],
  },
  // ── v4: Familia Editorial/Magazine ──────────────────────────────────
  // 9. EDITORIAL-HERO — número gigante + subtítulo + imagen
  {
    id: "editorial-hero", family: "Editorial Hero", role: "cover", style: "editorial", density: "low",
    contentTypes: ["list", "resource", "tutorial"], asset: "optional",
    slots: [
      { role: "headline", frame: F(.10, .14, .80, .18) },
      { role: "body", frame: F(.10, .36, .60, .10) },
      { role: "hero-image", frame: F(.10, .52, .80, .36) },
    ],
    decorations: [
      { type: "rect", frame: F(.10, .10, .10, .015), token: "accent" },
    ],
  },
  // 10. EDITORIAL-STEP — título + cuerpo + demo
  {
    id: "editorial-step", family: "Editorial Step", role: "step", style: "editorial", density: "medium",
    contentTypes: ["tutorial", "case-study", "resource"], asset: "optional",
    slots: [
      { role: "headline", frame: F(.10, .10, .80, .16) },
      { role: "body", frame: F(.10, .30, .80, .22) },
      { role: "hero-image", frame: F(.10, .56, .80, .34) },
    ],
    decorations: [],
  },
  // 11. EDITORIAL-QUOTE — cita serif grande
  {
    id: "editorial-quote", family: "Editorial Quote", role: "summary", style: "editorial", density: "low",
    contentTypes: ["opinion", "case-study", "tutorial"], asset: "none",
    slots: [
      { role: "headline", frame: F(.14, .24, .72, .40) },
      { role: "body", frame: F(.14, .68, .50, .08) },
    ],
    decorations: [
      line(.14, .18, .12, 0, .6),
    ],
  },
  // 12. EDITORIAL-LIST — lista numerada con bullets
  {
    id: "editorial-list", family: "Editorial List", role: "step", style: "editorial", density: "high",
    contentTypes: ["list", "resource"], asset: "none",
    slots: [
      { role: "headline", frame: F(.10, .08, .80, .12) },
      { role: "body", frame: F(.10, .24, .80, .64) },
    ],
    decorations: [],
  },
  // ── v4: Familia Bold/Statement ──────────────────────────────────────
  // 13. BOLD-HEADLINE — headline masivo full-bleed
  {
    id: "bold-headline", family: "Bold Headline", role: "cover", style: "bold", density: "low",
    contentTypes: ["opinion", "tutorial", "release"], asset: "none",
    slots: [
      { role: "headline", frame: F(.06, .22, .88, .56) },
    ],
    decorations: [],
  },
  // 14. BOLD-STAT — número/dato gigante + contexto
  {
    id: "bold-stat", family: "Bold Stat", role: "step", style: "bold", density: "low",
    contentTypes: ["case-study", "release", "opinion"], asset: "none",
    slots: [
      { role: "headline", frame: F(.08, .10, .84, .50) },
      { role: "body", frame: F(.08, .66, .76, .16) },
    ],
    decorations: [
      line(.08, .62, .30, 0, .5),
    ],
  },
  // 15. BOLD-CONTRAST — SÍ vs NO / antes vs después
  {
    id: "bold-contrast", family: "Bold Contrast", role: "comparison", style: "bold", density: "medium",
    contentTypes: ["comparison", "opinion"], asset: "none",
    slots: [
      { role: "headline", frame: F(.10, .10, .80, .12) },
      { role: "body", frame: F(.10, .30, .34, .56) },
    ],
    decorations: [
      line(.50, .24, 0, .60, .4),
    ],
  },
  // ── v4: Familia Demo/Technical ──────────────────────────────────────
  // 16. DEMO-FRAME — marco de screenshot + título + caption
  {
    id: "demo-frame", family: "Demo Frame", role: "step", style: "technical", density: "medium",
    contentTypes: ["repo", "release", "tutorial", "case-study"], asset: "image",
    slots: [
      { role: "hero-image", frame: F(.08, .14, .84, .54) },
      { role: "headline", frame: F(.08, .72, .84, .12) },
      { role: "body", frame: F(.08, .86, .60, .06) },
    ],
    decorations: [
      { type: "rect", frame: F(.08, .14, .84, .54), token: "transparent", strokeToken: "ink", strokeWidth: 2, radius: 8 },
    ],
  },
  // 17. CODE-BLOCK — bloque de código mono
  {
    id: "code-block", family: "Code Block", role: "step", style: "technical", density: "medium",
    contentTypes: ["tutorial", "repo", "release"], asset: "none",
    slots: [
      { role: "headline", frame: F(.10, .10, .80, .10) },
      { role: "body", frame: F(.10, .24, .80, .64) },
    ],
    decorations: [
      { type: "rect", frame: F(.08, .22, .84, .68), token: "ink", strokeToken: "ink", strokeWidth: 1, radius: 8 },
    ],
  },
  // 18. MINIMAL-TEXT — texto minimal sobre fondo sólido
  {
    id: "minimal-text", family: "Minimal Text", role: "cta", style: "minimal", density: "low",
    contentTypes: ["tutorial", "list", "comparison", "resource", "case-study", "release", "repo", "opinion"], asset: "none",
    slots: [
      { role: "headline", frame: F(.14, .30, .72, .30) },
      { role: "body", frame: F(.14, .64, .60, .08) },
    ],
    decorations: [],
  },
  // 19. CHECKLIST — items de checklist visual
  {
    id: "checklist", family: "Checklist", role: "summary", style: "minimal", density: "high",
    contentTypes: ["tutorial", "resource", "list"], asset: "none",
    slots: [
      { role: "headline", frame: F(.10, .08, .80, .10) },
      { role: "body", frame: F(.10, .22, .80, .68) },
    ],
    decorations: [],
  },
];

function slot(def: RecipeDef["slots"][number], i: number): TemplateSlot {
  return {
    id: `${def.role}-${i}`,
    role: def.role,
    accepts: ["headline", "body", "cta"].includes(def.role) ? ["text"] : ["svg", "image"],
    required: def.role === "headline",
    fit: def.role === "hero-image" ? "cover" : "contain",
    constraints: { maxLines: def.role === "headline" ? 4 : 14 },
    frame: def.frame,
  };
}

export function templateCatalog(channel: ContentChannel): EditorialTemplate[] {
  const s = CHANNEL_SIZES[channel];
  return VISUAL_RECIPES.map((r) => ({
    id: `${r.id}-${channel}`, recipeId: r.id, family: r.family, name: r.family,
    channel, width: s.width, height: s.height, slideRole: r.role,
    density: r.density, style: r.style, tags: [r.id, r.role, r.style, ...r.contentTypes],
    slots: r.slots.map(slot), decorations: r.decorations,
    favorite: ["cover", "card", "quote", "cta"].includes(r.id),
    useCount: 0, version: 5, catalogVersion: TEMPLATE_CATALOG_VERSION, source: "builtin",
    compatibleContentTypes: r.contentTypes, assetRequirement: r.asset,
    safeArea: { top: .06, right: .06, bottom: .06, left: .06 },
    previewColors: r.style === "bold" ? ["#C8D5B9", "#D94E1E", "#1A1A1A"] : ["#F2F0E4", "#1A1A1A", "#D94E1E"],
    selection: {
      intent: `${r.family}: sistema ${r.style} de densidad ${r.density} para ${r.role}`,
      roles: [r.role], contentTypes: r.contentTypes, keywords: [r.id, r.family.toLocaleLowerCase(), r.style], avoidWhen: [],
    },
  }));
}

export function templateByRecipe(channel: ContentChannel, recipeId: string, role?: EditorialTemplate["slideRole"]) {
  const templates = templateCatalog(channel);
  const resolved = resolveRecipeId(recipeId, role) as EditorialRecipeId;
  const exact = templates.find((t) => t.recipeId === resolved);
  if (exact) return exact;
  if (role) {
    const byRole = templates.find((t) => t.slideRole === role);
    if (byRole) return byRole;
  }
  return templates[0]!;
}
