import type {
  EditorialCopyProfile, ReferenceStyleProfile, SceneElement, TemplateUsageProfile, VisualBlueprint, VisualComposition, VisualGenerationMode, VisualIntent, VisualRole,
} from "./editor.models";
import { googleMaterialSymbolSvg, materialSymbolForConcept } from "./google-material-symbols";
import { createEditorialDiagramElements, normalizeEditorialDiagram } from "./editorial-diagram";

export type VisualIntentInput = {
  selectedText?: string;
  slideContext: string;
  palette: string[];
  previousSignatures?: string[];
  requestedMode?: VisualGenerationMode;
  variantSeed?: string;
  assetOnly?: boolean;
};

const COMPOSITIONS: VisualComposition[] = ["hick-fitts", "measurement", "comparison", "flow", "architecture", "data", "icon", "git-merge", "typographic-poster", "symbolic-poster", "editorial-grid", "editorial-diagram", "object", "scene", "metaphor"];
const EXACT_VALUE = /\b\d+(?:[.,]\d+)?(?:\s*[×x]\s*\d+(?:[.,]\d+)?)?\s*(?:dp|px|pt|rem|em|%|ms|s|kb|mb|gb|°|cm|mm|m)\b/giu;
const BARE_NUMBER = /\b\d+(?:[.,]\d+)?\b/gu;
const LAW = /\bLey\s+(?:de\s+)?(?:Hick|Fitts|Miller|Jakob|Tesler|Pareto)\b/giu;
const EXACT_RELATION = /\b(?:igual|equivale|mayor|menor|antes|despu[eé]s|versus|vs\.?|debe|m[ií]nimo|m[aá]ximo|por cada|entre)\b/iu;
const FLOW = /\b(?:flujo|proceso|pasos?|pipeline|request|response|api|endpoint|entrada|salida|ciclo|ruta)\b/iu;
const ARCHITECTURE = /\b(?:arquitectura|capas?|componentes?|servicios?|m[oó]dulos?|sistema|frontend|backend|base de datos|stack)\b/iu;
const COMPARISON = /\b(?:comparaci[oó]n|versus|vs\.?|antes|despu[eé]s|mejor|peor|menos|m[aá]s|diferencia)\b/iu;
const SCENE = /\b(?:persona|equipo|programando|trabajando|noche|oficina|escritorio|ciudad|paisaje|fotograf[ií]a|escena|retrato)\b/iu;
const METAPHOR = /\b(?:met[aá]fora|idea|creatividad|inspiraci[oó]n|crecimiento|bloqueo|viaje|transformaci[oó]n)\b/iu;
const DIRECTIONAL_ICON = /\b(?:flechas?|arrows?|direcci[oó]n|apunta(?:ndo|r)?|indicador(?:es)?)\b/iu;
const GIT_GRAPH = /\b(?:git|github|ramas?|branches?|commits?|merge|fusion(?:ar|ando)?|pull\s*request|fork)\b/iu;

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function unique(values: string[], limit = 12) {
  return [...new Set(values.map((value) => clean(value, 120)).filter(Boolean))].slice(0, limit);
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? value as T : fallback;
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function normalizeReferenceStyle(value: unknown, composition: VisualComposition): ReferenceStyleProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const point = raw["focalPoint"] && typeof raw["focalPoint"] === "object" ? raw["focalPoint"] as Record<string, unknown> : {};
  const colorRoles = raw["colorRoles"] && typeof raw["colorRoles"] === "object" ? raw["colorRoles"] as Record<string, unknown> : {};
  const motif = raw["dominantMotif"] && typeof raw["dominantMotif"] === "object" ? raw["dominantMotif"] as Record<string, unknown> : {};
  const grid = raw["gridProfile"] && typeof raw["gridProfile"] === "object" ? raw["gridProfile"] as Record<string, unknown> : {};
  const typographic = composition === "typographic-poster";
  const symbolic = composition === "symbolic-poster";
  const editorialGrid = composition === "editorial-grid";
  const gridColumns = Number(grid["columns"]);
  const gridRows = Number(grid["rows"]);
  return {
    family: oneOf(raw["family"], ["typographic-poster", "editorial-layout", "diagram", "collage", "image-led"] as const, typographic ? "typographic-poster" : symbolic || editorialGrid ? "editorial-layout" : "diagram"),
    layoutArchetype: oneOf(raw["layoutArchetype"], ["type-led", "symbol-led", "grid", "split", "framed", "collage", "diagrammatic"] as const, editorialGrid ? "grid" : symbolic ? "symbol-led" : typographic ? "type-led" : "diagrammatic"),
    alignment: oneOf(raw["alignment"], ["left", "center", "right", "asymmetric"] as const, typographic ? "center" : "left"),
    focalPoint: {
      x: bounded(point["x"], .5, 0, 1),
      y: bounded(point["y"], typographic ? .52 : .45, 0, 1),
      width: bounded(point["width"], typographic ? .78 : .82, .25, 1),
    },
    headlineScale: oneOf(raw["headlineScale"], ["medium", "large", "massive"] as const, typographic ? "massive" : "large"),
    displayFont: oneOf(raw["displayFont"], ["grotesk", "condensed", "serif", "mono"] as const, "grotesk"),
    supportingFont: oneOf(raw["supportingFont"], ["grotesk", "condensed", "serif", "mono"] as const, "grotesk"),
    headlineWeight: bounded(raw["headlineWeight"], 850, 300, 900),
    lineHeight: bounded(raw["lineHeight"], .88, .72, 1.35),
    tracking: bounded(raw["tracking"], -18, -60, 80),
    textCase: oneOf(raw["textCase"], ["sentence", "uppercase", "mixed"] as const, "mixed"),
    accentMode: oneOf(raw["accentMode"], ["word", "block", "underline", "none"] as const, typographic ? "word" : "none"),
    negativeSpace: oneOf(raw["negativeSpace"], ["compact", "balanced", "expansive"] as const, "balanced"),
    texture: oneOf(raw["texture"], ["clean", "paper", "grain", "halftone"] as const, "clean"),
    motifPlacement: oneOf(raw["motifPlacement"], ["corners", "edges", "around-focal", "none"] as const, typographic ? "corners" : "edges"),
    dominantMotif: {
      kind: oneOf(motif["kind"], ["punctuation", "number", "letter", "geometric", "frame", "abstract", "none"] as const, symbolic ? "punctuation" : "none"),
      value: clean(motif["value"], 12) || (symbolic ? "?" : ""),
      treatment: oneOf(motif["treatment"], ["solid", "outline", "cutout", "repeated", "cropped"] as const, "solid"),
      x: bounded(motif["x"], .5, -.25, 1.25),
      y: bounded(motif["y"], symbolic ? .62 : .5, -.25, 1.25),
      width: bounded(motif["width"], symbolic ? .42 : .3, .12, 1.3),
      rotation: bounded(motif["rotation"], 0, -35, 35),
    },
    gridProfile: {
      columns: gridColumns === 2 ? 2 : 3,
      rows: gridRows === 1 || gridRows === 3 ? gridRows : 2,
      numbered: grid["numbered"] !== false,
      iconStyle: oneOf(grid["iconStyle"], ["outlined", "filled"] as const, "outlined"),
      cardTreatment: oneOf(grid["cardTreatment"], ["open", "outlined", "soft"] as const, "outlined"),
      footerBand: grid["footerBand"] !== false,
    },
    colorRoles: {
      paper: clean(colorRoles["paper"], 16) || "#F3F7F2",
      ink: clean(colorRoles["ink"], 16) || "#10251E",
      accent: clean(colorRoles["accent"], 16) || "#2F5DE5",
      secondary: clean(colorRoles["secondary"], 16) || "#B8F34A",
    },
    summary: clean(raw["summary"], 240),
  };
}

function normalizeTemplateUsage(value: unknown): TemplateUsageProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const roles = Array.isArray(raw["roles"])
    ? unique(raw["roles"].map((item) => clean(item, 40)), 6).filter((role): role is TemplateUsageProfile["roles"][number] => ["cover", "intro", "step", "comparison", "summary", "cta"].includes(role))
    : [];
  return {
    intent: clean(raw["intent"], 240),
    roles,
    contentTypes: Array.isArray(raw["contentTypes"]) ? unique(raw["contentTypes"].map((item) => clean(item, 60)), 8) : [],
    keywords: Array.isArray(raw["keywords"]) ? unique(raw["keywords"].map((item) => clean(item, 80)), 12) : [],
    avoidWhen: Array.isArray(raw["avoidWhen"]) ? unique(raw["avoidWhen"].map((item) => clean(item, 100)), 8) : [],
  };
}

function normalizeEditorialCopy(value: unknown, fallbackHeadline: string): EditorialCopyProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const kicker = clean(raw["kicker"], 48);
  const headline = clean(raw["headline"], 180);
  const deck = clean(raw["deck"], 240);
  const closingInsight = clean(raw["closingInsight"], 220);
  if (!kicker && !headline && !deck && !closingInsight) return undefined;
  return {
    kicker,
    headline: headline || fallbackHeadline,
    deck,
    closingInsight,
  };
}

function stringHash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function visualSource(input: Pick<VisualIntentInput, "selectedText" | "slideContext">) {
  const selected = clean(input.selectedText, 4_000);
  const context = clean(input.slideContext, 8_000);
  if (!selected) return context;
  if (selected.length < 28 && context && !context.toLocaleLowerCase().includes(selected.toLocaleLowerCase())) return `${selected}. Contexto: ${context}`;
  return selected;
}

export function extractExactLabels(source: string) {
  const measured = source.match(EXACT_VALUE) ?? [];
  const numbers = measured.length ? [] : source.match(BARE_NUMBER) ?? [];
  return unique([...(source.match(LAW) ?? []), ...measured, ...numbers], 10);
}

export function requiresEditableDiagram(source: string) {
  return Boolean(extractExactLabels(source).length || EXACT_RELATION.test(source) || FLOW.test(source) || ARCHITECTURE.test(source) || DIRECTIONAL_ICON.test(source) || GIT_GRAPH.test(source));
}

function chooseComposition(source: string, exactLabels: string[]): VisualComposition {
  if (/\bhick\b/iu.test(source) && /\bfitts\b/iu.test(source)) return "hick-fitts";
  if (GIT_GRAPH.test(source) && /\b(?:ramas?|branches?|commits?|merge|fusion(?:ar|ando)?)\b/iu.test(source)) return "git-merge";
  if (DIRECTIONAL_ICON.test(source)) return "icon";
  if (FLOW.test(source)) return "flow";
  if (ARCHITECTURE.test(source)) return "architecture";
  if (COMPARISON.test(source)) return "comparison";
  if (exactLabels.length) return /%/.test(source) ? "data" : "measurement";
  if (SCENE.test(source)) return "scene";
  if (METAPHOR.test(source)) return "metaphor";
  return "object";
}

function conceptFrom(source: string, composition: VisualComposition) {
  if (composition === "hick-fitts") return "decisiones simples y objetivos táctiles accesibles";
  const firstSentence = source.split(/[.!?]/)[0]?.trim();
  return (firstSentence || composition).slice(0, 140);
}

export function buildLocalVisualIntent(input: VisualIntentInput): VisualIntent {
  const source = visualSource(input);
  const exactLabels = extractExactLabels(source);
  const composition = chooseComposition(source, exactLabels);
  const mustBeDiagram = requiresEditableDiagram(source);
  const requested = input.requestedMode ?? "auto";
  const output = requested === "image"
    ? "image"
    : requested === "diagram" || mustBeDiagram
      ? "diagram"
      : ["scene", "metaphor", "object"].includes(composition) ? "image" : "diagram";
  const concept = conceptFrom(source, composition);
  const elements = composition === "hick-fitts"
    ? ["muchas opciones pequeñas", "pocas opciones grandes", "objetivo táctil", "reglas de medición"]
    : composition === "git-merge" ? ["rama principal", "rama secundaria", "commit 1", "commit 2", "merge"]
      : composition === "icon" ? ["flecha vectorial", "dirección"]
    : composition === "flow" ? ["entrada", "transformación", "salida"]
      : composition === "architecture" ? ["interfaz", "servicio", "datos"]
        : composition === "comparison" ? ["estado inicial", "estado mejorado"]
          : unique(source.split(/[,;:]/).map((part) => part.trim()), 5);
  const relations = composition === "hick-fitts"
    ? [
        { from: "muchas opciones pequeñas", to: "pocas opciones grandes", kind: "compares" as const, label: "menos carga mental" },
        { from: "reglas de medición", to: "objetivo táctil", kind: "measures" as const, label: exactLabels.find((item) => /dp/i.test(item)) ?? "48×48dp" },
      ]
    : composition === "git-merge"
      ? [
          { from: "rama principal", to: "rama secundaria", kind: "connects" as const, label: "branch" },
          { from: "commit 1", to: "commit 2", kind: "connects" as const },
          { from: "rama secundaria", to: "merge", kind: "connects" as const, label: "merge" },
        ]
      : elements.slice(0, -1).map((from, index) => ({ from, to: elements[index + 1], kind: composition === "comparison" ? "compares" as const : "connects" as const }));
  const previousCount = input.previousSignatures?.filter((signature) => signature.startsWith(`${composition}:`)).length ?? 0;
  const signature = `${composition}:${stringHash(`${source}|${input.variantSeed ?? previousCount}|${previousCount}`)}`;
  const imagePrompt = [
    input.assetOnly ? `Create one isolated editorial asset representing: ${concept}.` : `Create one editorial image that communicates: ${concept}.`,
    `Use these concrete subjects when relevant: ${elements.join(", ")}.`,
    `Palette: ${input.palette.slice(0, 4).join(", ")}.`,
    "Compose a fresh interpretation with one clear focal point, intentional negative space, and a premium editorial finish.",
    input.assetOnly ? "Isolated asset only, centered with generous clean margins; do not create a poster or complete layout." : "",
    "Do not draw words, letters, numbers, measurements, UI labels, logos, watermarks, posters, or complete social-media layouts.",
  ].filter(Boolean).join(" ");
  return {
    version: 1,
    output,
    concept,
    elements,
    relations,
    exactLabels,
    composition,
    aspectRatio: composition === "scene" ? .8 : composition === "icon" ? 1.625 : 1.5,
    prompt: imagePrompt,
    rationale: requested === "image"
      ? "El usuario pidió una imagen contextual; los datos y textos exactos permanecen como capas del editor."
      : mustBeDiagram ? "Contiene datos, reglas o relaciones que deben conservarse como capas editables." : "El concepto se entiende mejor como una imagen contextual sin texto incrustado.",
    signature,
  };
}

export function normalizeVisualIntent(value: unknown, input: VisualIntentInput): VisualIntent {
  const fallback = buildLocalVisualIntent(input);
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const source = visualSource(input);
  const exactLabels = unique([...extractExactLabels(source), ...(Array.isArray(raw["exactLabels"]) ? raw["exactLabels"].map((item) => clean(item, 120)) : [])], 10);
  const rawReferenceStyle = raw["referenceStyle"] && typeof raw["referenceStyle"] === "object" ? raw["referenceStyle"] as Record<string, unknown> : {};
  const remoteComposition: VisualComposition = rawReferenceStyle["family"] === "typographic-poster"
    ? "typographic-poster"
    : rawReferenceStyle["layoutArchetype"] === "grid"
      ? "editorial-grid"
      : rawReferenceStyle["layoutArchetype"] === "symbol-led" || (rawReferenceStyle["family"] === "editorial-layout" && ["object", "metaphor"].includes(String(raw["composition"])))
      ? "symbolic-poster"
      : COMPOSITIONS.includes(raw["composition"] as VisualComposition) ? raw["composition"] as VisualComposition : fallback.composition;
  const composition = ["hick-fitts", "icon", "git-merge"].includes(fallback.composition) ? fallback.composition : remoteComposition;
  const remoteElements = Array.isArray(raw["elements"]) ? unique(raw["elements"].map((item) => clean(item, 120)), 12) : fallback.elements;
  const remoteRelations = Array.isArray(raw["relations"]) ? raw["relations"].slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const relation = item as Record<string, unknown>;
    const from = clean(relation["from"], 120);
    const to = clean(relation["to"], 120);
    if (!from || !to) return [];
    const kinds = ["connects", "compares", "contains", "measures"] as const;
    const kind = kinds.includes(relation["kind"] as typeof kinds[number]) ? relation["kind"] as typeof kinds[number] : "connects";
    return [{ from, to, kind, label: clean(relation["label"], 120) || undefined }];
  }) : fallback.relations;
  const forcedDiagram = ["typographic-poster", "symbolic-poster", "editorial-grid", "editorial-diagram"].includes(composition) || requiresEditableDiagram(source) || input.requestedMode === "diagram";
  const output = input.requestedMode === "image" ? "image" : forcedDiagram ? "diagram" : raw["output"] === "image" ? "image" : "diagram";
  const remoteConcept = clean(raw["concept"], 180) || fallback.concept;
  const editorialCopy = normalizeEditorialCopy(raw["editorialCopy"], remoteConcept);
  const diagramProfile = normalizeEditorialDiagram(raw["diagramProfile"], editorialCopy?.headline || remoteConcept);
  return {
    version: 1,
    output,
    concept: editorialCopy?.headline || remoteConcept,
    elements: remoteElements.length ? remoteElements : fallback.elements,
    relations: remoteRelations,
    exactLabels,
    composition,
    aspectRatio: Math.max(.5, Math.min(2, Number(raw["aspectRatio"]) || fallback.aspectRatio)),
    prompt: clean(raw["prompt"], 2_000) || fallback.prompt,
    rationale: clean(raw["rationale"], 320) || fallback.rationale,
    signature: clean(raw["signature"], 160) || fallback.signature,
    referenceStyle: normalizeReferenceStyle(raw["referenceStyle"], composition),
    templateUsage: normalizeTemplateUsage(raw["templateUsage"]),
    editorialCopy,
    diagramProfile,
  };
}

type ElementInput = Partial<SceneElement> & Pick<SceneElement, "type" | "name" | "x" | "y" | "width" | "height">;

function element(input: ElementInput, role: VisualRole, index: number): SceneElement {
  return {
    id: `blueprint-${index}`,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    zIndex: index,
    visible: true,
    locked: false,
    generatedVisualId: "blueprint",
    visualRole: role,
    ...input,
  };
}

function textElement(
  name: string, content: string, x: number, y: number, width: number, size: number, fill: string, index: number,
  role: VisualRole = "label", align: SceneElement["textAlign"] = "left",
  options: Partial<Pick<SceneElement, "fontFamily" | "fontWeight" | "lineHeight" | "charSpacing" | "opacity">> = {},
) {
  return element({
    type: "text", name, content, x, y, width, height: size * 1.55, fill,
    fontFamily: options.fontFamily ?? "Space Grotesk", fontSize: size, fontWeight: options.fontWeight ?? 800,
    textAlign: align, lineHeight: options.lineHeight ?? 1, charSpacing: options.charSpacing ?? -8, opacity: options.opacity ?? 1,
  }, role, index);
}

function fontFor(category: ReferenceStyleProfile["displayFont"] | undefined) {
  if (category === "serif") return "Merriweather";
  if (category === "mono") return "Share Tech Mono";
  if (category === "condensed") return "Arial Narrow";
  return "Space Grotesk";
}

function posterLines(value: string, maxLines = 3) {
  const words = clean(value, 180).split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words;
  const target = Math.max(7, Math.ceil(words.join(" ").length / Math.min(maxLines, Math.ceil(words.length / 2))));
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > target && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function supportingText(sourceText: string, concept: string) {
  const sourceWords = clean(sourceText, 500).split(/\s+/).filter(Boolean);
  const conceptWords = clean(concept, 180).split(/\s+/).filter(Boolean);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/giu, "").toLocaleLowerCase();
  const samePrefix = conceptWords.length > 0 && conceptWords.every((word, index) => normalize(word) === normalize(sourceWords[index] ?? ""));
  const rest = samePrefix ? sourceWords.slice(conceptWords.length) : sourceWords;
  return clean(rest.join(" ").replace(/^[.·—:;\s]+/, ""), 220);
}

function motifValue(style: ReferenceStyleProfile | undefined, intent: VisualIntent) {
  const motif = style?.dominantMotif;
  const raw = clean(motif?.value, 12);
  if (motif?.kind === "number") return raw.match(/\d+(?:[.,]\d+)?/)?.[0] ?? intent.exactLabels[0] ?? "01";
  if (motif?.kind === "letter") return [...(raw || intent.concept)][0]?.toLocaleUpperCase() ?? "A";
  if (motif?.kind === "punctuation") return /^[?!+×→←↗↘&]$/u.test(raw) ? raw : "?";
  return "";
}

function wrapEditorialText(value: string, maxChars: number, maxLines = 3) {
  const words = clean(value, 220).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).join("\n");
}

function editorialGridItems(intent: VisualIntent, count: number) {
  const defaults = [
    "Contexto | Define el escenario, la audiencia y la meta.",
    "Problema | Nombra la tensión concreta que debe resolverse.",
    "Proceso | Ordena decisiones, pruebas y aprendizajes.",
    "Solución | Explica qué cambió y por qué funciona.",
    "Contribución | Aclara tu criterio y las decisiones que tomaste.",
    "Resultado | Cierra con impacto, evidencia y próximos pasos.",
  ];
  return Array.from({ length: count }, (_, index) => {
    const source = intent.elements[index] || defaults[index % defaults.length];
    const parts = source.split(/\s*(?:\||—|:)\s*/, 2).map((part) => clean(part, 150)).filter(Boolean);
    if (parts.length > 1) return { title: parts[0].slice(0, 32), description: parts[1] };
    const words = source.split(/\s+/).filter(Boolean);
    return {
      title: words.slice(0, Math.min(3, words.length)).join(" ").slice(0, 32),
      description: words.length > 3 ? words.slice(3).join(" ") : `Punto clave dentro de ${intent.concept.toLocaleLowerCase()}.`,
    };
  });
}

function baseElements(intent: VisualIntent, colors: string[], dimensions: { width: number; height: number }, sourceText: string, variant = 0) {
  const [primary = "#B8F34A", accent = "#2F5DE5", paper = "#F3F7F2", ink = "#10251E"] = colors;
  const { width: canvasWidth, height: canvasHeight } = dimensions;
  const items: SceneElement[] = [];
  const add = (item: ElementInput, role: VisualRole) => items.push(element(item, role, items.length));
  const label = (name: string, content: string, x: number, y: number, width: number, size = 28, role: VisualRole = "label", align: SceneElement["textAlign"] = "left", fill = ink) => items.push(textElement(name, content, x, y, width, size, fill, items.length, role, align));

  if (intent.composition === "editorial-diagram" && intent.diagramProfile) {
    return createEditorialDiagramElements(intent.diagramProfile, colors, dimensions, {
      headline: intent.editorialCopy?.headline || intent.concept,
      deck: intent.editorialCopy?.deck || intent.diagramProfile.caption || supportingText(sourceText, intent.concept),
      folio: intent.editorialCopy?.kicker,
      compact: true,
    });
  }

  if (intent.composition === "editorial-grid") {
    const style = intent.referenceStyle;
    const editorialCopy = intent.editorialCopy;
    const grid = style?.gridProfile;
    const columns = grid?.columns ?? 3;
    const rows = grid?.rows ?? 2;
    const count = Math.min(6, columns * rows);
    const gridItems = editorialGridItems(intent, count);
    const headlineLines = posterLines(editorialCopy?.headline || intent.concept, 2);
    const supporting = clean(editorialCopy?.deck, 240) || supportingText(sourceText, intent.concept);
    const gridX = canvasWidth * .065;
    const gridY = canvasHeight * .285;
    const gridWidth = canvasWidth * .87;
    const gridHeight = canvasHeight * .47;
    const cellWidth = gridWidth / columns;
    const cellHeight = gridHeight / rows;
    const displayFont = fontFor(style?.displayFont);
    const supportingFont = fontFor(style?.supportingFont);

    label("Firma editorial", editorialCopy?.kicker || "POLYEDRO · PLAYBOOK", gridX, canvasHeight * .045, canvasWidth * .42, 12, "label", "left", ink);
    label("Índice", `${String(count).padStart(2, "0")} PARTES`, canvasWidth * .70, canvasHeight * .045, canvasWidth * .235, 12, "label", "right", accent);
    headlineLines.forEach((line, index) => items.push(textElement(`Titular ${index + 1}`, line, canvasWidth * .09, canvasHeight * (.085 + index * .061), canvasWidth * .82, canvasWidth * .071, index === headlineLines.length - 1 ? accent : ink, items.length, "label", "center", {
      fontFamily: displayFont, fontWeight: style?.headlineWeight ?? 850, lineHeight: .9, charSpacing: style?.tracking ?? -22,
    })));
    if (supporting) items.push(textElement("Cuerpo", supporting, canvasWidth * .14, canvasHeight * .225, canvasWidth * .72, 16, ink, items.length, "label", "center", { fontFamily: supportingFont, fontWeight: 450, lineHeight: 1.2, charSpacing: 0, opacity: .66 }));

    add({ type: "rect", name: "Marco de la matriz", x: gridX, y: gridY, width: gridWidth, height: gridHeight, fill: paper, stroke: ink, strokeWidth: 1.4, radius: 15 }, "shape");
    for (let column = 1; column < columns; column++) add({ type: "line", name: `Divisor vertical ${column}`, x: gridX + cellWidth * column, y: gridY, width: 0, height: gridHeight, stroke: ink, strokeWidth: 1, opacity: .2 }, "connector");
    for (let row = 1; row < rows; row++) add({ type: "line", name: `Divisor horizontal ${row}`, x: gridX, y: gridY + cellHeight * row, width: gridWidth, height: 0, stroke: ink, strokeWidth: 1, opacity: .2 }, "connector");

    gridItems.forEach((gridItem, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = gridX + column * cellWidth;
      const y = gridY + row * cellHeight;
      const badgeSize = Math.min(30, cellWidth * .145);
      const iconSize = Math.min(48, cellWidth * .24);
      const iconName = materialSymbolForConcept(`${gridItem.title} ${gridItem.description}`, index);
      if (grid?.numbered !== false) {
        add({ type: "rect", name: `Número ${index + 1}`, x: x + cellWidth * .055, y: y + cellHeight * .055, width: badgeSize, height: badgeSize, fill: accent, radius: 7 }, "shape");
        label(`Valor ${index + 1}`, String(index + 1).padStart(2, "0"), x + cellWidth * .055, y + cellHeight * .064, badgeSize, 12, "label", "center", paper);
      }
      add({ type: "circle", name: `Halo de icono ${index + 1}`, x: x + (cellWidth - iconSize * 1.36) / 2, y: y + cellHeight * .075, width: iconSize * 1.36, height: iconSize * 1.36, fill: accent, opacity: .09 }, "shape");
      add({ type: "svg", name: `Google Material · ${iconName}`, x: x + (cellWidth - iconSize) / 2, y: y + cellHeight * .105, width: iconSize, height: iconSize, svg: googleMaterialSymbolSvg(iconName, accent) }, "illustration");
      label(`Sección ${index + 1}`, gridItem.title.toLocaleUpperCase(), x + cellWidth * .08, y + cellHeight * .41, cellWidth * .84, 14, "label", "center", ink);
      add({ type: "line", name: `Acento ${index + 1}`, x: x + cellWidth * .43, y: y + cellHeight * .515, width: cellWidth * .14, height: 0, stroke: accent, strokeWidth: 2.5 }, "shape");
      label(`Detalle ${index + 1}`, wrapEditorialText(gridItem.description, columns === 3 ? 25 : 34, 3), x + cellWidth * .075, y + cellHeight * .585, cellWidth * .85, columns === 3 ? 11.5 : 13, "label", "left", ink);
    });

    if (grid?.footerBand !== false) {
      add({ type: "rect", name: "Banda de conclusión", x: gridX, y: canvasHeight * .79, width: gridWidth, height: canvasHeight * .095, fill: primary, opacity: .16, stroke: accent, strokeWidth: 1, radius: 12 }, "shape");
      add({ type: "circle", name: "Idea final", x: gridX + 22, y: canvasHeight * .812, width: 36, height: 36, fill: accent }, "shape");
      label("Síntesis", "→", gridX + 22, canvasHeight * .819, 36, 18, "label", "center", paper);
      const closingInsight = clean(editorialCopy?.closingInsight, 220) || "Una buena estructura convierte una idea compleja en una historia fácil de seguir.";
      label("Conclusión", wrapEditorialText(closingInsight, 58, 2), gridX + 74, canvasHeight * .808, gridWidth - 96, 15, "label", "left", ink);
    }
    label("Pie izquierdo", "ORDENA · EXPLICA · DEMUESTRA", gridX, canvasHeight * .925, canvasWidth * .5, 10, "label", "left", ink);
    label("Pie derecho", "GUÁRDALO  ↘", canvasWidth * .69, canvasHeight * .925, canvasWidth * .245, 10, "label", "right", accent);
    return items;
  }

  if (intent.composition === "symbolic-poster") {
    const style = intent.referenceStyle;
    const editorialCopy = intent.editorialCopy;
    const motif = style?.dominantMotif;
    const displayFont = fontFor(style?.displayFont);
    const supportingFont = fontFor(style?.supportingFont);
    const titleAlign: SceneElement["textAlign"] = variant === 1 ? "left" : style?.alignment === "right" ? "right" : style?.alignment === "left" ? "left" : "center";
    const titleWidth = canvasWidth * (variant === 1 ? .58 : .82);
    const titleX = canvasWidth * (variant === 1 ? .075 : .09);
    const titleY = canvasHeight * (variant === 2 ? .66 : .13);
    const titleLines = posterLines(editorialCopy?.headline || intent.concept, 3).map((line) => style?.textCase === "uppercase" ? line.toLocaleUpperCase() : line);
    const longest = Math.max(1, ...titleLines.map((line) => line.length));
    const titleSize = Math.max(34, Math.min(canvasWidth * .092, titleWidth / Math.max(5.4, longest * .54)));
    const leading = titleSize * Math.max(.9, style?.lineHeight ?? .94);
    const supporting = clean(editorialCopy?.deck, 240) || supportingText(sourceText, intent.concept);

    if (["paper", "grain", "halftone"].includes(style?.texture ?? "")) {
      Array.from({ length: 12 }, (_, index) => add({
        type: "line", name: `Textura editorial ${index + 1}`, x: canvasWidth * .035, y: canvasHeight * (.045 + index * .082),
        width: canvasWidth * .93, height: index % 3 === 0 ? 2 : 0, stroke: ink, strokeWidth: 1, opacity: index % 2 ? .018 : .035,
      }, "shape"));
    }

    add({ type: "line", name: "Regla de cabecera", x: canvasWidth * .07, y: canvasHeight * .064, width: canvasWidth * .22, height: 0, stroke: ink, strokeWidth: 7 }, "shape");
    label("Kicker", editorialCopy?.kicker || `FIELD NOTE / ${String((variant % 3) + 1).padStart(2, "0")}`, canvasWidth * .07, canvasHeight * .077, canvasWidth * .32, 12, "label", "left", ink);
    label("Dirección", "SIGUE  →", canvasWidth * .72, canvasHeight * .077, canvasWidth * .21, 12, "label", "right", ink);

    titleLines.forEach((line, index) => {
      const last = index === titleLines.length - 1;
      const fill = last && style?.accentMode === "word" ? accent : ink;
      items.push(textElement(`Titular ${index + 1}`, line, titleX, titleY + index * leading, titleWidth, titleSize, fill, items.length, "label", titleAlign, {
        fontFamily: displayFont,
        fontWeight: style?.headlineWeight ?? 850,
        lineHeight: style?.lineHeight ?? .94,
        charSpacing: style?.tracking ?? -18,
      }));
    });

    const motifKind = motif?.kind ?? "punctuation";
    const motifWidth = canvasWidth * (motif?.width ?? (variant === 1 ? .62 : .42));
    const motifCenterX = canvasWidth * (variant === 1 ? .78 : motif?.x ?? .5);
    const motifCenterY = canvasHeight * (variant === 2 ? .42 : motif?.y ?? .61);
    const motifColor = variant === 2 ? accent : ink;
    const treatment = motif?.treatment ?? "solid";
    const rotation = motif?.rotation ?? (variant === 1 ? -6 : 0);
    const textMotif = motifValue(style, intent);

    if (textMotif) {
      const size = Math.max(170, motifWidth * (textMotif.length > 1 ? .92 : 1.36));
      const motifX = motifCenterX - motifWidth / 2;
      const motifY = motifCenterY - size * .54;
      const copies = treatment === "repeated" ? 3 : 1;
      for (let index = copies - 1; index >= 0; index--) {
        const offset = copies > 1 ? index * canvasWidth * .035 : 0;
        const mark = textElement(index ? `Eco del motivo ${index}` : "Motivo dominante", textMotif, motifX + offset, motifY - offset, motifWidth, size, treatment === "outline" ? paper : motifColor, items.length, "illustration", "center", {
          fontFamily: displayFont, fontWeight: 900, lineHeight: .75, charSpacing: -35, opacity: index ? .16 + index * .12 : variant === 2 ? .18 : 1,
        });
        if (treatment === "outline") {
          mark.stroke = motifColor;
          mark.strokeWidth = Math.max(2, canvasWidth * .008);
        }
        mark.rotation = rotation;
        items.push(mark);
      }
      if (treatment === "cutout") {
        add({ type: "circle", name: "Contrapunto recortado", x: motifCenterX - motifWidth * .08, y: motifCenterY - motifWidth * .02, width: motifWidth * .22, height: motifWidth * .22, fill: paper, rotation: -8 }, "shape");
        add({ type: "circle", name: "Punto de acento", x: motifCenterX + motifWidth * .08, y: motifCenterY + motifWidth * .23, width: motifWidth * .10, height: motifWidth * .10, fill: accent }, "shape");
      }
    } else if (motifKind === "frame") {
      add({ type: "rect", name: "Marco dominante", x: motifCenterX - motifWidth / 2, y: motifCenterY - motifWidth * .58, width: motifWidth, height: motifWidth * 1.16, fill: "transparent", stroke: motifColor, strokeWidth: Math.max(8, canvasWidth * .026), rotation }, "illustration");
      add({ type: "rect", name: "Interrupción del marco", x: motifCenterX + motifWidth * .25, y: motifCenterY - motifWidth * .62, width: motifWidth * .28, height: motifWidth * .12, fill: accent, rotation }, "shape");
    } else {
      add({ type: "ellipse", name: "Masa dominante", x: motifCenterX - motifWidth / 2, y: motifCenterY - motifWidth * .42, width: motifWidth, height: motifWidth * .78, fill: treatment === "outline" ? "transparent" : motifColor, stroke: motifColor, strokeWidth: treatment === "outline" ? 12 : 0, rotation }, "illustration");
      add({ type: "line", name: "Corte diagonal", x: motifCenterX - motifWidth * .54, y: motifCenterY + motifWidth * .04, width: motifWidth * 1.08, height: -motifWidth * .38, stroke: accent, strokeWidth: Math.max(8, motifWidth * .055), rotation }, "connector");
      add({ type: "circle", name: "Contrapunto", x: motifCenterX + motifWidth * .24, y: motifCenterY + motifWidth * .18, width: motifWidth * .18, height: motifWidth * .18, fill: primary, stroke: ink, strokeWidth: 4 }, "shape");
    }

    if (supporting) {
      const bodyX = canvasWidth * (variant === 1 ? .075 : variant === 2 ? .12 : .15);
      const bodyY = canvasHeight * (variant === 1 ? .405 : variant === 2 ? .17 : .375);
      const bodyWidth = canvasWidth * (variant === 1 ? .34 : variant === 2 ? .76 : .70);
      const bodyAlign: SceneElement["textAlign"] = variant === 1 ? "left" : "center";
      items.push(textElement("Cuerpo", supporting, bodyX, bodyY, bodyWidth, 17, ink, items.length, "label", bodyAlign, { fontFamily: supportingFont, fontWeight: 450, lineHeight: 1.28, charSpacing: 0, opacity: .68 }));
    }
    add({ type: "circle", name: "Folio", x: canvasWidth * .08, y: canvasHeight * .932, width: 18, height: 18, fill: accent }, "shape");
    label("Acción editorial", "GUÁRDALO PARA DESPUÉS", canvasWidth * .12, canvasHeight * .93, canvasWidth * .34, 11, "label", "left", ink);
    add({ type: "line", name: "Firma final", x: canvasWidth * .79, y: canvasHeight * .94, width: canvasWidth * .14, height: 0, stroke: ink, strokeWidth: 6 }, "shape");
    return items;
  }

  if (intent.composition === "typographic-poster") {
    const style = intent.referenceStyle;
    const editorialCopy = intent.editorialCopy;
    const align = style?.alignment === "right" ? "right" : style?.alignment === "center" ? "center" : "left";
    const displayFont = fontFor(style?.displayFont);
    const supportingFont = fontFor(style?.supportingFont);
    const focalWidth = canvasWidth * (style?.focalPoint.width ?? .78);
    const focalX = Math.max(canvasWidth * .07, Math.min(canvasWidth - focalWidth - canvasWidth * .07, canvasWidth * (style?.focalPoint.x ?? .5) - focalWidth / 2));
    const lines = posterLines(editorialCopy?.headline || intent.concept, 3).map((line) => style?.textCase === "uppercase" ? line.toLocaleUpperCase() : line);
    const baseSize = style?.headlineScale === "massive" ? canvasWidth * .125 : style?.headlineScale === "medium" ? canvasWidth * .075 : canvasWidth * .1;
    const lineHeight = baseSize * Math.max(.9, style?.lineHeight ?? .9);
    const blockHeight = Math.max(1, lines.length) * lineHeight;
    const focalY = canvasHeight * (style?.focalPoint.y ?? .52) - blockHeight / 2;
    const supporting = clean(editorialCopy?.deck, 240) || supportingText(sourceText, intent.concept);

    if (["paper", "grain", "halftone"].includes(style?.texture ?? "")) {
      Array.from({ length: 9 }, (_, index) => add({
        type: "line", name: `Fibra de papel ${index + 1}`, x: canvasWidth * .04, y: canvasHeight * (.08 + index * .105),
        width: canvasWidth * .92, height: 0, stroke: ink, strokeWidth: 1, opacity: index % 2 ? .025 : .04,
      }, "shape"));
    }
    add({ type: "circle", name: "Marca superior", x: canvasWidth * .08, y: canvasHeight * .055, width: 12, height: 12, fill: accent }, "shape");
    items.push(textElement("Kicker", editorialCopy?.kicker || "SISTEMA / 01", canvasWidth * .105, canvasHeight * .048, canvasWidth * .24, 13, ink, items.length, "label", "left", { fontFamily: "Share Tech Mono", fontWeight: 700, charSpacing: 34, opacity: .7 }));
    items.push(textElement("Firma", "POLYEDRO", canvasWidth * .68, canvasHeight * .048, canvasWidth * .24, 13, ink, items.length, "label", "right", { fontFamily: "Share Tech Mono", fontWeight: 700, charSpacing: 28, opacity: .55 }));
    items.push(textElement("Eyebrow", "idea central", focalX, Math.max(canvasHeight * .17, focalY - baseSize * .58), focalWidth, Math.max(16, baseSize * .24), ink, items.length, "label", align, { fontFamily: supportingFont, fontWeight: 400, charSpacing: 2, opacity: .55 }));

    lines.forEach((line, index) => {
      const isAccent = index === lines.length - 1 && style?.accentMode !== "none";
      const size = Math.max(34, Math.min(baseSize, focalWidth / Math.max(4.8, line.length * .56)));
      const y = focalY + index * lineHeight;
      if (isAccent && style?.accentMode === "block") {
        add({ type: "rect", name: "Bloque de énfasis", x: focalX - 8, y: y - 4, width: focalWidth + 16, height: size * .9, fill: accent, radius: 4 }, "shape");
      }
      items.push(textElement(`Titular ${index + 1}`, line, focalX, y, focalWidth, size, isAccent && style?.accentMode !== "block" ? accent : ink, items.length, "label", align, {
        fontFamily: displayFont, fontWeight: style?.headlineWeight ?? 850, lineHeight: style?.lineHeight ?? .88, charSpacing: style?.tracking ?? -18,
      }));
      if (isAccent && style?.accentMode === "underline") {
        add({ type: "line", name: "Subrayado de énfasis", x: focalX, y: y + size * 1.02, width: focalWidth * .72, height: 0, stroke: accent, strokeWidth: 7 }, "connector");
      }
    });

    if (supporting) items.push(textElement("Cuerpo", supporting, focalX, Math.min(canvasHeight * .78, focalY + blockHeight + baseSize * .46), focalWidth, 19, ink, items.length, "label", align, { fontFamily: supportingFont, fontWeight: 400, lineHeight: 1.25, charSpacing: 0, opacity: .66 }));
    add({ type: "rect", name: "Acción inferior", x: canvasWidth * .08, y: canvasHeight * .905, width: canvasWidth * .18, height: 28, fill: accent, radius: 14 }, "shape");
    add({ type: "rect", name: "Avance", x: canvasWidth * .84, y: canvasHeight * .90, width: 28, height: 28, fill: ink, radius: 2 }, "shape");
    return items;
  }

  if (intent.composition === "hick-fitts") {
    label("Ley de Hick", "LEY DE HICK", 34, 24, 270, 24, "label", "left", accent);
    label("Explicación de Hick", "MENOS OPCIONES", 34, 58, 300, 34);
    [0, 1, 2, 3, 4, 5].forEach((value) => add({ type: "rect", name: `Opción pequeña ${value + 1}`, x: 42 + (value % 3) * 68, y: 126 + Math.floor(value / 3) * 58, width: 48, height: 36, fill: paper, stroke: ink, strokeWidth: 3, radius: 8 }, "shape"));
    add({ type: "arrow", name: "Reducción de opciones", x: 258, y: 158, width: 88, height: 28, fill: accent, stroke: accent, strokeWidth: 6 }, "connector");
    [0, 1].forEach((value) => add({ type: "rect", name: `Opción prioritaria ${value + 1}`, x: 372, y: 126 + value * 82, width: 118, height: 58, fill: value ? accent : primary, stroke: ink, strokeWidth: 4, radius: 12 }, "shape"));
    label("Resultado de Hick", "MENOS CARGA MENTAL", 34, 260, 456, 22);
    add({ type: "line", name: "Divisor", x: 524, y: 24, width: 0, height: 392, stroke: ink, strokeWidth: 2 }, "connector");
    label("Ley de Fitts", "LEY DE FITTS", 558, 24, 132, 24, "label", "left", accent);
    label("Objetivo táctil", "OBJETIVO TÁCTIL", 558, 58, 132, 26);
    add({ type: "rect", name: "Área mínima", x: 574, y: 146, width: 96, height: 96, fill: primary, stroke: ink, strokeWidth: 5, radius: 18 }, "shape");
    add({ type: "circle", name: "Punto de toque", x: 600, y: 172, width: 44, height: 44, fill: accent, stroke: ink, strokeWidth: 4 }, "shape");
    add({ type: "line", name: "Medida horizontal", x: 574, y: 270, width: 96, height: 0, stroke: accent, strokeWidth: 3 }, "measurement");
    add({ type: "line", name: "Marca izquierda", x: 574, y: 260, width: 0, height: 20, stroke: accent, strokeWidth: 3 }, "measurement");
    add({ type: "line", name: "Marca derecha", x: 670, y: 260, width: 0, height: 20, stroke: accent, strokeWidth: 3 }, "measurement");
    label("Medida exacta", intent.exactLabels.find((value) => /dp/i.test(value)) ?? "48×48dp", 558, 294, 132, 26, "measurement", "center");
    label("Principio", "GRANDE · CERCA · CLARO", 546, 354, 160, 17, "label", "center");
    return items;
  }

  if (intent.composition === "icon") {
    add({ type: "arrow", name: "Contorno de flecha", x: 78, y: 116, width: 366, height: 88, fill: ink, stroke: ink, strokeWidth: 30 }, "shape");
    add({ type: "arrow", name: "Flecha de color", x: 68, y: 104, width: 366, height: 88, fill: primary, stroke: primary, strokeWidth: 21 }, "illustration");
    add({ type: "circle", name: "Punto de origen", x: 38, y: 129, width: 42, height: 42, fill: accent, stroke: ink, strokeWidth: 5 }, "shape");
    return items;
  }

  if (intent.composition === "git-merge") {
    add({ type: "line", name: "Rama principal", x: 54, y: 256, width: 612, height: 0, stroke: ink, strokeWidth: 9 }, "connector");
    add({ type: "line", name: "Apertura de rama", x: 158, y: 256, width: 104, height: -112, stroke: accent, strokeWidth: 8 }, "connector");
    add({ type: "line", name: "Rama secundaria", x: 262, y: 144, width: 186, height: 0, stroke: accent, strokeWidth: 8 }, "connector");
    add({ type: "line", name: "Retorno al merge", x: 448, y: 144, width: 108, height: 112, stroke: accent, strokeWidth: 8 }, "connector");
    [
      ["Commit inicial", 132, 230, paper],
      ["Commit 1", 278, 118, primary],
      ["Commit 2", 390, 118, primary],
      ["Merge", 530, 230, accent],
      ["Commit final", 620, 230, paper],
    ].forEach(([name, x, y, fill]) => add({ type: "circle", name: String(name), x: Number(x), y: Number(y), width: 52, height: 52, fill: String(fill), stroke: ink, strokeWidth: 5 }, "shape"));
    label("Rama principal", "MAIN", 54, 302, 140, 20, "label", "left", ink);
    label("Rama secundaria", "FEATURE", 262, 82, 186, 20, "label", "center", accent);
    label("Acción merge", "MERGE", 506, 302, 102, 20, "label", "center", accent);
    if (intent.exactLabels.length) label("Cantidad de commits", `${intent.exactLabels[0]} COMMITS`, 274, 196, 180, 18, "measurement", "center", ink);
    return items;
  }

  label("Concepto", intent.concept.toLocaleUpperCase(), 36, 30, 648, 30);
  add({ type: "line", name: "Regla editorial", x: 36, y: 86, width: 648, height: 0, stroke: accent, strokeWidth: 4 }, "connector");
  if (intent.composition === "flow") {
    const names = intent.elements.slice(0, 3).length >= 3 ? intent.elements.slice(0, 3) : ["Entrada", "Proceso", "Salida"];
    names.forEach((name, index) => {
      add({ type: "rect", name, x: 42 + index * 226, y: 176, width: 176, height: 108, fill: index === 1 ? primary : paper, stroke: ink, strokeWidth: 4, radius: 16 }, "shape");
      label(`Etiqueta ${index + 1}`, name.toLocaleUpperCase(), 58 + index * 226, 211, 144, 20, "label", "center");
      if (index < names.length - 1) add({ type: "arrow", name: `Conector ${index + 1}`, x: 188 + index * 226, y: 213, width: 82, height: 28, fill: accent, stroke: accent, strokeWidth: 6 }, "connector");
    });
  } else if (intent.composition === "architecture") {
    const names = intent.elements.slice(0, 4).length ? intent.elements.slice(0, 4) : ["Interfaz", "Servicio", "Datos"];
    names.slice(0, 4).forEach((name, index) => {
      const width = 520 - index * 64;
      add({ type: "rect", name, x: 100 + index * 32, y: 132 + index * 70, width, height: 58, fill: index % 2 ? primary : paper, stroke: ink, strokeWidth: 4, radius: 12 }, "shape");
      label(`Capa ${index + 1}`, name.toLocaleUpperCase(), 118 + index * 32, 149 + index * 70, width - 36, 19, "label", "center");
    });
  } else if (intent.composition === "comparison") {
    [["ANTES", 42, paper], ["DESPUÉS", 378, primary]].forEach(([title, x, fill]) => {
      add({ type: "rect", name: String(title), x: Number(x), y: 132, width: 300, height: 226, fill: String(fill), stroke: ink, strokeWidth: 4, radius: 14 }, "shape");
      label(`Etiqueta ${title}`, String(title), Number(x) + 24, 158, 252, 24, "label", "left", title === "DESPUÉS" ? accent : ink);
    });
    label("Comparación inicial", intent.elements[0] ?? "ESTADO INICIAL", 66, 230, 252, 22, "label", "center");
    label("Comparación final", intent.elements[1] ?? "ESTADO MEJORADO", 402, 230, 252, 22, "label", "center");
  } else if (intent.composition === "data") {
    [150, 238, 326, 414].forEach((x, index) => add({ type: "rect", name: `Dato ${index + 1}`, x, y: 330 - index * 52, width: 54, height: 56 + index * 52, fill: index === 3 ? primary : accent, stroke: ink, strokeWidth: 3, radius: 8 }, "shape"));
    label("Dato exacto", intent.exactLabels.join(" · ") || "DATO", 112, 376, 496, 24, "measurement", "center");
  } else {
    add({ type: "rect", name: "Área medida", x: 254, y: 148, width: 212, height: 172, fill: primary, stroke: ink, strokeWidth: 5, radius: 20 }, "shape");
    add({ type: "line", name: "Medida superior", x: 254, y: 124, width: 212, height: 0, stroke: accent, strokeWidth: 4 }, "measurement");
    add({ type: "line", name: "Medida lateral", x: 490, y: 148, width: 0, height: 172, stroke: accent, strokeWidth: 4 }, "measurement");
    label("Medida", intent.exactLabels.join(" · ") || intent.elements[0] || "MEDIDA", 170, 360, 380, 26, "measurement", "center");
  }
  return items;
}

export function createVisualBlueprint(intent: VisualIntent, palette: string[], sourceText: string): VisualBlueprint {
  const dimensions = intent.composition === "icon"
    ? { width: 520, height: 320 }
    : intent.composition === "editorial-diagram"
      ? { width: 720, height: 560 }
    : ["typographic-poster", "symbolic-poster", "editorial-grid"].includes(intent.composition)
      ? { width: 720, height: Math.round(Math.max(560, Math.min(1_000, 720 / intent.aspectRatio))) }
      : { width: 720, height: 440 };
  const encodedVariant = Number(intent.signature.split(":")[1]);
  const variant = Number.isFinite(encodedVariant) ? Math.abs(encodedVariant) % 3 : Number.parseInt(stringHash(intent.signature), 36) % 3;
  const sourceElements = baseElements(intent, palette, dimensions, sourceText, variant).slice(0, 80);
  const elements = ["symbolic-poster", "editorial-grid", "editorial-diagram"].includes(intent.composition)
    ? sourceElements
    : variant === 1
    ? sourceElements.map((item) => ({
        ...item,
        x: dimensions.width - item.x - item.width,
        rotation: item.type === "arrow" ? (item.rotation + 180) % 360 : item.rotation,
        textAlign: item.type === "text" && item.textAlign === "left" ? "right" as const : item.type === "text" && item.textAlign === "right" ? "left" as const : item.textAlign,
      }))
    : variant === 2
      ? sourceElements.map((item, index) => ({ ...item, y: Math.max(18, Math.min(dimensions.height - 20 - item.height, item.y + (index % 2 ? 8 : -8))), rotation: item.type === "rect" && item.visualRole === "shape" ? (index % 2 ? 1.5 : -1.5) : item.rotation }))
      : sourceElements;
  return { version: 1, kind: "diagram", ...dimensions, sourceText: clean(sourceText, 8_000), palette: palette.slice(0, 4), intent, elements };
}

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function svgText(element: SceneElement) {
  const anchor = element.textAlign === "center" ? "middle" : element.textAlign === "right" ? "end" : "start";
  const x = element.textAlign === "center" ? element.x + element.width / 2 : element.textAlign === "right" ? element.x + element.width : element.x;
  const lines = (element.content ?? "").split("\n").slice(0, 4);
  const transform = element.rotation ? ` transform="rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})"` : "";
  const stroke = element.stroke ? ` stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth ?? 0}" paint-order="stroke"` : "";
  return `<text x="${x}" y="${element.y + (element.fontSize ?? 24)}" fill="${escapeXml(element.fill)}"${stroke} opacity="${Math.max(0, Math.min(1, element.opacity))}" font-family="${escapeXml(element.fontFamily ?? "Arial")}" font-size="${element.fontSize ?? 24}" font-weight="${escapeXml(element.fontWeight ?? 700)}" text-anchor="${anchor}"${transform}>${lines.map((line, index) => `<tspan x="${x}" dy="${index ? (element.fontSize ?? 24) * (element.lineHeight ?? 1.1) : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function embeddedSvg(element: SceneElement, common: string) {
  if (!element.svg) return "";
  const viewBox = element.svg.match(/viewBox=["']([^"']+)["']/iu)?.[1] ?? "0 0 24 24";
  const inner = element.svg.replace(/^.*?<svg[^>]*>/isu, "").replace(/<\/svg>\s*$/iu, "");
  return `<g${common}><svg x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">${inner}</svg></g>`;
}

export function compileBlueprintSvg(blueprint: VisualBlueprint) {
  const body = blueprint.elements.map((item) => {
    const transform = item.rotation ? ` transform="rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})"` : "";
    const common = ` opacity="${Math.max(0, Math.min(1, item.opacity))}" data-role="${item.visualRole ?? "shape"}"${transform}`;
    if (item.type === "text") return svgText(item);
    if (item.type === "rect") return `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="${item.radius ?? 0}" fill="${escapeXml(item.fill ?? "none")}" stroke="${escapeXml(item.stroke ?? "none")}" stroke-width="${item.strokeWidth ?? 0}"${common}/>`;
    if (item.type === "circle") return `<circle cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" r="${item.width / 2}" fill="${escapeXml(item.fill ?? "none")}" stroke="${escapeXml(item.stroke ?? "none")}" stroke-width="${item.strokeWidth ?? 0}"${common}/>`;
    if (item.type === "ellipse") return `<ellipse cx="${item.x + item.width / 2}" cy="${item.y + item.height / 2}" rx="${item.width / 2}" ry="${item.height / 2}" fill="${escapeXml(item.fill ?? "none")}" stroke="${escapeXml(item.stroke ?? "none")}" stroke-width="${item.strokeWidth ?? 0}"${common}/>`;
    if (item.type === "line") return `<line x1="${item.x}" y1="${item.y}" x2="${item.x + item.width}" y2="${item.y + item.height}" stroke="${escapeXml(item.stroke)}" stroke-width="${item.strokeWidth ?? 3}" stroke-linecap="round"${common}/>`;
    if (item.type === "svg") return embeddedSvg(item, common);
    if (item.type === "arrow") {
      const center = item.y + item.height / 2;
      const end = item.x + item.width;
      return `<g${common}><line x1="${item.x}" y1="${center}" x2="${end - 20}" y2="${center}" stroke="${escapeXml(item.stroke)}" stroke-width="${item.strokeWidth ?? 5}" stroke-linecap="round"/><path d="M${end - 24} ${center - 14}L${end} ${center}L${end - 24} ${center + 14}Z" fill="${escapeXml(item.fill ?? item.stroke)}"/></g>`;
    }
    return "";
  }).join("");
  const background = ["icon", "git-merge"].includes(blueprint.intent.composition) ? "" : `<rect width="100%" height="100%" fill="${escapeXml(blueprint.palette[2] ?? "#F3F7F2")}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${blueprint.width} ${blueprint.height}" data-visual-signature="${escapeXml(blueprint.intent.signature)}">${background}${body}</svg>`;
}

function remapColor(value: string | undefined, from: string[], to: string[]) {
  if (!value) return value;
  const normalized = value.toUpperCase();
  for (let index = 0; index < Math.min(4, from.length, to.length); index++) {
    const source = from[index].toUpperCase();
    if (normalized === source) return to[index];
    if (source.length === 7 && normalized.startsWith(source) && normalized.length === 9) return `${to[index]}${value.slice(7)}`;
  }
  return value;
}

function remapSvgColors(value: string | undefined, from: string[], to: string[]) {
  if (!value) return value;
  return from.slice(0, 4).reduce((svg, source, index) => {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return to[index] ? svg.replace(new RegExp(escaped, "giu"), to[index]) : svg;
  }, value);
}

export function recolorVisualBlueprint(blueprint: VisualBlueprint, palette: string[]): VisualBlueprint {
  const colors = palette.slice(0, 4);
  return {
    ...structuredClone(blueprint),
    palette: colors,
    elements: blueprint.elements.map((item) => ({
      ...structuredClone(item),
      fill: remapColor(item.fill, blueprint.palette, colors),
      stroke: remapColor(item.stroke, blueprint.palette, colors),
      shadowColor: remapColor(item.shadowColor, blueprint.palette, colors),
      svg: remapSvgColors(item.svg, blueprint.palette, colors),
    })),
  };
}
