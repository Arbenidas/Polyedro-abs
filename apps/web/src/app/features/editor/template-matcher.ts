import type { ContentChannel, EditorialSlide } from "../../editorial.models";
import type { VisualStyle } from "../content/content.models";
import type { EditorialTemplate, SceneDocument, TemplateUsageProfile } from "./editor.models";

export type TemplateSelectionContext = {
  channel: ContentChannel;
  role: EditorialTemplate["slideRole"];
  contentType?: string;
  headline: string;
  body?: string;
  keyPoint?: string;
  visualStyle?: VisualStyle;
  hasAssets?: boolean;
  excludeRecipeId?: string;
};

const STOP_WORDS = new Set([
  "para", "como", "pero", "porque", "desde", "hasta", "entre", "sobre", "este", "esta", "estos", "estas", "antes", "después",
  "that", "with", "from", "your", "this", "into", "cuando", "donde", "todo", "toda", "cada", "solo", "más", "menos", "que", "una", "uno",
]);

const normalized = (value: string) => value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function extractTemplateKeywords(value: string, limit = 12) {
  const words = normalized(value).match(/[a-z0-9][a-z0-9+#.-]{2,}/g) ?? [];
  return [...new Set(words.filter((word) => !STOP_WORDS.has(word)))].slice(0, limit);
}

export function inferContentTypesFromText(value: string) {
  const source = normalized(value);
  const types: string[] = [];
  if (/paso|tutorial|guia|como hacer|implementa|configura|aprende/.test(source)) types.push("tutorial");
  if (/lista|ranking|top |recursos|herramientas|\b\d+\s+(formas|ideas|tips|usos)/.test(source)) types.push("list", "resource");
  if (/versus|\bvs\b|compara|comparacion|antes\s*(?:\/|y|vs\.?|versus)\s*despues|mejor que|diferencia/.test(source)) types.push("comparison");
  if (/opinion|creo|postura|mito|realidad|deberiamos|no necesitas/.test(source)) types.push("opinion");
  if (/github|git\b|repositorio|commit|release|version|changelog/.test(source)) types.push("repo", "release");
  if (/caso de estudio|resultado|aprendimos|decidimos|problema resuelto|proyecto/.test(source)) types.push("case-study");
  return [...new Set(types.length ? types : ["tutorial", "opinion"])].slice(0, 4);
}

export function inferTemplateUsage(
  slide: EditorialSlide,
  scene: SceneDocument,
  role: EditorialTemplate["slideRole"],
  intent?: string,
): TemplateUsageProfile {
  const source = `${slide.headline} ${slide.body}`.trim();
  const contentTypes = inferContentTypesFromText(source);
  const keywords = extractTemplateKeywords(source);
  const largestText = Math.max(0, ...scene.elements.filter((element) => element.type === "text").map((element) => element.fontSize ?? 0));
  const headlineLayers = scene.elements.filter((element) => element.type === "text" && /titular|headline/i.test(element.name)).length;
  const visualCue = headlineLayers >= 2 || largestText >= scene.width * .075 ? "jerarquía tipográfica dominante" : scene.elements.some((element) => element.type === "image" || element.type === "svg") ? "protagonismo visual" : "composición editorial equilibrada";
  return {
    intent: intent?.trim().slice(0, 240) || `${visualCue} para ${role === "cover" ? "abrir con una promesa fuerte" : role === "comparison" ? "mostrar un contraste" : role === "cta" ? "cerrar con una acción" : "desarrollar una idea concreta"}`,
    roles: [role],
    contentTypes,
    keywords,
    avoidWhen: role === "cover" ? ["texto largo", "más de una idea principal"] : role === "comparison" ? ["contenido sin contraste"] : [],
  };
}

function visualStyleScore(template: EditorialTemplate, style: VisualStyle | undefined) {
  if (!style) return 0;
  let score = 0;
  if (style.typeMood === "serif" && template.style === "editorial") score += 8;
  if (style.typeMood === "mono" && template.style === "technical") score += 8;
  if (style.typeMood === "bold" && template.style === "bold") score += 8;
  if (style.ornamentation === "minimal" && template.density === "low") score += 4;
  if (style.ornamentation === "technical" && template.style === "technical") score += 4;
  return score;
}

export function scoreTemplateForContext(template: EditorialTemplate, context: TemplateSelectionContext) {
  if (template.channel !== context.channel) return Number.NEGATIVE_INFINITY;
  if (context.excludeRecipeId && [template.recipeId, template.id].includes(context.excludeRecipeId)) return Number.NEGATIVE_INFINITY;
  const source = normalized(`${context.headline} ${context.body ?? ""} ${context.keyPoint ?? ""}`);
  const selection = template.selection;
  let score = 0;
  if (template.slideRole === context.role) score += 38;
  else if (selection?.roles.includes(context.role)) score += 32;
  else score -= 18;
  if (context.contentType && (selection?.contentTypes.includes(context.contentType) || template.compatibleContentTypes.includes(context.contentType))) score += 24;
  const keywordMatches = (selection?.keywords ?? template.tags).filter((keyword) => source.includes(normalized(keyword))).length;
  score += Math.min(24, keywordMatches * 6);
  if (selection?.intent) score += Math.min(8, extractTemplateKeywords(selection.intent, 8).filter((keyword) => source.includes(keyword)).length * 2);
  if (selection?.avoidWhen.some((signal) => source.includes(normalized(signal)))) score -= 36;
  if (template.assetRequirement === "none" && !context.hasAssets) score += 4;
  if (["image", "screenshot", "icons"].includes(template.assetRequirement) && context.hasAssets) score += 8;
  score += visualStyleScore(template, context.visualStyle);
  score += Math.min(4, Math.log2(template.useCount + 1));
  return score;
}

export function rankTemplatesForContext(templates: EditorialTemplate[], context: TemplateSelectionContext) {
  return templates
    .map((template) => ({ template, score: scoreTemplateForContext(template, context) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score || b.template.useCount - a.template.useCount || a.template.name.localeCompare(b.template.name));
}

export function bestTemplateForContext(templates: EditorialTemplate[], context: TemplateSelectionContext) {
  return rankTemplatesForContext(templates, context)[0];
}
