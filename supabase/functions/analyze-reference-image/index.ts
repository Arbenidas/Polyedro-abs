import { json, preflight, requireAuthorization } from "../_shared/http.ts";
import { mimoJson, toDataUrl, type MimoMessage } from "../_shared/mimo.ts";

// Analiza una imagen de REFERENCIA con MiMo 2.5 (visión) y devuelve una
// especificación visual EDITABLE siguiendo el borrador/tema en desarrollo.
// La imagen pegada NO se inserta tal cual: es solo contexto para que MiMo
// extraiga la composición, paleta y elementos, que luego el editor convierte
// en capas SVG editables coherentes con el tema del carrusel.
//
// Output: un VisualIntent (mismo shape que generate-contextual-visual-spec)
// para que Angular lo normalice y construya el blueprint editable.

const COMPOSITIONS = ["hick-fitts", "measurement", "comparison", "flow", "architecture", "data", "icon", "git-merge", "editorial-diagram", "typographic-poster", "symbolic-poster", "editorial-grid", "object", "scene", "metaphor"] as const;
const OUTPUTS = ["diagram", "image"] as const;
const KINDS = ["connects", "compares", "contains", "measures"] as const;
const STYLE_FAMILIES = ["typographic-poster", "editorial-layout", "diagram", "collage", "image-led"] as const;
const ALIGNMENTS = ["left", "center", "right", "asymmetric"] as const;
const FONT_CATEGORIES = ["grotesk", "condensed", "serif", "mono"] as const;
const HEADLINE_SCALES = ["medium", "large", "massive"] as const;
const TEXT_CASES = ["sentence", "uppercase", "mixed"] as const;
const ACCENT_MODES = ["word", "block", "underline", "none"] as const;
const NEGATIVE_SPACE = ["compact", "balanced", "expansive"] as const;
const TEXTURES = ["clean", "paper", "grain", "halftone"] as const;
const MOTIF_PLACEMENTS = ["corners", "edges", "around-focal", "none"] as const;
const LAYOUT_ARCHETYPES = ["type-led", "symbol-led", "grid", "split", "framed", "collage", "diagrammatic"] as const;
const MOTIF_KINDS = ["punctuation", "number", "letter", "geometric", "frame", "abstract", "none"] as const;
const MOTIF_TREATMENTS = ["solid", "outline", "cutout", "repeated", "cropped"] as const;
const ICON_STYLES = ["outlined", "filled"] as const;
const CARD_TREATMENTS = ["open", "outlined", "soft"] as const;
const SLIDE_ROLES = ["cover", "intro", "step", "comparison", "summary", "cta"] as const;
const DIAGRAM_KINDS = ["flow", "timeline", "comparison", "layers", "cycle", "system"] as const;

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const strings = (value: unknown, max = 12) => Array.isArray(value) ? [...new Set(value.map((item) => text(item, 120)).filter(Boolean))].slice(0, max) : [];
const oneOf = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] => allowed.includes(value as T[number]) ? value as T[number] : fallback;
const number = (value: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number(value) || fallback));

function normalizeReferenceStyle(value: unknown, composition: typeof COMPOSITIONS[number], summary: string, palette: string[]) {
  const raw = isObject(value) ? value : {};
  const point = isObject(raw.focalPoint) ? raw.focalPoint : {};
  const colorRoles = isObject(raw.colorRoles) ? raw.colorRoles : {};
  const motif = isObject(raw.dominantMotif) ? raw.dominantMotif : {};
  const grid = isObject(raw.gridProfile) ? raw.gridProfile : {};
  const color = (candidate: unknown, fallback: string) => /^#[0-9a-f]{6}$/iu.test(text(candidate, 16)) ? text(candidate, 16).toLocaleUpperCase() : fallback;
  const typographic = composition === "typographic-poster";
  const symbolic = composition === "symbolic-poster";
  const editorialGrid = composition === "editorial-grid";
  const gridColumns = Number(grid.columns);
  const gridRows = Number(grid.rows);
  return {
    family: oneOf(raw.family, STYLE_FAMILIES, typographic ? "typographic-poster" : symbolic || editorialGrid ? "editorial-layout" : composition === "scene" ? "image-led" : "diagram"),
    layoutArchetype: oneOf(raw.layoutArchetype, LAYOUT_ARCHETYPES, editorialGrid ? "grid" : symbolic ? "symbol-led" : typographic ? "type-led" : "diagrammatic"),
    alignment: oneOf(raw.alignment, ALIGNMENTS, typographic ? "center" : "left"),
    focalPoint: {
      x: number(point.x, .5, 0, 1),
      y: number(point.y, typographic ? .52 : .45, 0, 1),
      width: number(point.width, typographic ? .78 : .82, .25, 1),
    },
    headlineScale: oneOf(raw.headlineScale, HEADLINE_SCALES, typographic ? "massive" : "large"),
    displayFont: oneOf(raw.displayFont, FONT_CATEGORIES, "grotesk"),
    supportingFont: oneOf(raw.supportingFont, FONT_CATEGORIES, "grotesk"),
    headlineWeight: number(raw.headlineWeight, 850, 300, 900),
    lineHeight: number(raw.lineHeight, .88, .72, 1.35),
    tracking: number(raw.tracking, -18, -60, 80),
    textCase: oneOf(raw.textCase, TEXT_CASES, "mixed"),
    accentMode: oneOf(raw.accentMode, ACCENT_MODES, typographic ? "word" : "none"),
    negativeSpace: oneOf(raw.negativeSpace, NEGATIVE_SPACE, "balanced"),
    texture: oneOf(raw.texture, TEXTURES, "clean"),
    motifPlacement: oneOf(raw.motifPlacement, MOTIF_PLACEMENTS, typographic ? "corners" : "edges"),
    dominantMotif: {
      kind: oneOf(motif.kind, MOTIF_KINDS, symbolic ? "punctuation" : "none"),
      value: text(motif.value, 12) || (symbolic ? "?" : ""),
      treatment: oneOf(motif.treatment, MOTIF_TREATMENTS, "solid"),
      x: number(motif.x, .5, -.25, 1.25),
      y: number(motif.y, symbolic ? .61 : .5, -.25, 1.25),
      width: number(motif.width, symbolic ? .42 : .3, .12, 1.3),
      rotation: number(motif.rotation, 0, -35, 35),
    },
    gridProfile: {
      columns: gridColumns === 2 ? 2 : 3,
      rows: gridRows === 1 || gridRows === 3 ? gridRows : 2,
      numbered: grid.numbered !== false,
      iconStyle: oneOf(grid.iconStyle, ICON_STYLES, "outlined"),
      cardTreatment: oneOf(grid.cardTreatment, CARD_TREATMENTS, "outlined"),
      footerBand: grid.footerBand !== false,
    },
    colorRoles: {
      paper: color(colorRoles.paper, palette[2] ?? "#F3F7F2"),
      ink: color(colorRoles.ink, palette[3] ?? "#10251E"),
      accent: color(colorRoles.accent, palette[1] ?? "#2F5DE5"),
      secondary: color(colorRoles.secondary, palette[0] ?? "#B8F34A"),
    },
    summary: text(raw.summary, 240) || summary,
  };
}

function normalizeTemplateUsage(value: unknown, input: JsonObject) {
  const raw = isObject(value) ? value : {};
  const roles = strings(raw.roles, 6).filter((role) => SLIDE_ROLES.includes(role as typeof SLIDE_ROLES[number]));
  return {
    intent: text(raw.intent, 240) || `Sistema visual para ${text(input.theme, 120) || "contenido editorial"}`,
    roles: roles.length ? roles : ["cover"],
    contentTypes: strings(raw.contentTypes, 8),
    keywords: strings(raw.keywords, 12),
    avoidWhen: strings(raw.avoidWhen, 8),
  };
}

function normalizeEditorialCopy(value: unknown, concept: string) {
  const raw = isObject(value) ? value : {};
  return {
    kicker: text(raw.kicker, 48),
    headline: text(raw.headline, 180) || concept,
    deck: text(raw.deck, 240),
    closingInsight: text(raw.closingInsight, 220),
  };
}

function normalizeDiagram(value: unknown, fallbackTitle: string) {
  if (!isObject(value)) return undefined;
  const nodes = (Array.isArray(value.nodes) ? value.nodes : [])
    .filter(isObject)
    .slice(0, 6)
    .map((node, index) => {
      const group = ["left", "right", "center"].includes(String(node.group)) ? node.group : undefined;
      return {
        id: text(node.id, 32) || `node-${index + 1}`,
        label: text(node.label, 32) || `Nodo ${index + 1}`,
        detail: text(node.detail, 90),
        icon: text(node.icon, 40) || "circle",
        ...(group ? { group } : {}),
      };
    });
  if (nodes.length < 2) return undefined;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(value.edges) ? value.edges : [])
    .filter(isObject)
    .map((edge) => ({ from: text(edge.from, 32), to: text(edge.to, 32), label: text(edge.label, 40) || undefined }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to)
    .slice(0, 10);
  const labels = Array.isArray(value.compareLabels) ? value.compareLabels : [];
  return {
    kind: oneOf(value.kind, DIAGRAM_KINDS, "flow"),
    title: text(value.title, 84) || fallbackTitle,
    caption: text(value.caption, 160),
    nodes,
    edges,
    ...(labels.length >= 2 ? { compareLabels: [text(labels[0], 24) || "A", text(labels[1], 24) || "B"] } : {}),
  };
}

function normalizeSpec(value: unknown, input: JsonObject): Record<string, unknown> {
  if (!isObject(value)) throw new Error("INVALID_REFERENCE_SPEC");
  const fallbackComposition = "scene";
  const rawReferenceStyle = isObject(value.referenceStyle) ? value.referenceStyle : {};
  const concept = text(value.concept, 180) || "Interpretación del estilo de la referencia";
  const diagramProfile = normalizeDiagram(value.diagramProfile, concept);
  const composition = rawReferenceStyle.family === "typographic-poster"
    ? "typographic-poster"
    : rawReferenceStyle.layoutArchetype === "grid"
      ? "editorial-grid"
      : rawReferenceStyle.layoutArchetype === "symbol-led" || (rawReferenceStyle.family === "editorial-layout" && ["object", "metaphor"].includes(String(value.composition)))
      ? "symbolic-poster"
      : diagramProfile
        ? "editorial-diagram"
      : oneOf(value.composition, COMPOSITIONS, fallbackComposition);
  const elements = strings(value.elements, 12);
  const relations = Array.isArray(value.relations) ? value.relations.slice(0, 12).flatMap((item) => {
    if (!isObject(item)) return [];
    const from = text(item.from, 120);
    const to = text(item.to, 120);
    if (!from || !to) return [];
    return [{ from, to, kind: oneOf(item.kind, KINDS, "connects"), label: text(item.label, 120) || undefined }];
  }) : [];
  const styleSummary = text(value.styleSummary, 200);
  const palette = strings(value.palette ?? input.palette, 4);
  return {
    version: 1,
    output: oneOf(value.output, OUTPUTS, "diagram"),
    concept,
    elements: elements.length ? elements : ["elemento principal", "detalle de apoyo"],
    relations,
    exactLabels: strings(value.exactLabels, 10),
    composition,
    ...(diagramProfile ? { diagramProfile } : {}),
    aspectRatio: Math.max(.5, Math.min(2, Number(value.aspectRatio) || 1.5)),
    prompt: text(value.prompt, 2_000) || "Interpretación editorial editable basada en la imagen de referencia.",
    rationale: text(value.rationale, 320) || "Se extrajo la estructura visual de la referencia y se adaptó al tema en desarrollo.",
    signature: `${composition}:${crypto.randomUUID()}`,
    // Datos auxiliares para la UI: paleta sugerida y resumen del estilo.
    palette,
    styleSummary,
    referenceStyle: normalizeReferenceStyle(value.referenceStyle, composition, styleSummary, palette),
    templateUsage: normalizeTemplateUsage(value.templateUsage, input),
    editorialCopy: normalizeEditorialCopy(value.editorialCopy, concept),
  };
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    requireAuthorization(request);
    const input = await request.json();
    const image = toDataUrl(input.imageBase64 ?? input.imageUrl ?? input.image);
    if (!image) return json({ error: "imageBase64 o imageUrl es obligatorio" }, 400);

    const draft = text(input.draftContext, 8_000);
    const theme = text(input.theme, 1_000);

    const system = `Eres el director de información visual y editor de copy de Polyedro. Recibes una imagen de REFERENCIA (solo inspiración) y el contexto de un borrador editorial en desarrollo. Tu trabajo: analizar la imagen de referencia y generar una especificación EDITABLE que conserve su gramática visual, PERO adaptada al tema del borrador — nunca reproduzcas el contenido literal, texto, logos o marcas de la imagen original. Devuelve solamente JSON válido y nunca SVG ni HTML. Puedes devolver posiciones RELATIVAS normalizadas (0-1), nunca coordenadas absolutas.

Antes de escribir el JSON, resuelve internamente cuatro cosas: para quién es la pieza, qué promesa concreta ofrece, qué tensión vuelve relevante el tema y qué debe comprender o poder hacer la persona al terminar. No expongas ese razonamiento; úsalo para escribir copy con criterio editorial.

Extrae de la referencia:
- composition: la estructura visual dominante (${COMPOSITIONS.join("|")}).
- elements: 2-6 conceptos visuales concretos y RELEVANTES al tema del borrador (no copias de lo que hay en la imagen). Si detectas una matriz editorial repetitiva, devuelve cada celda como "Título | descripción breve" y conserva la cantidad de celdas de la referencia hasta un máximo de 6.
- relations: conexiones/contrastes entre elementos cuando apliquen.
- palette: 2-4 colores dominantes de la referencia (hex #RRGGBB), sugeridos para la pieza.
- concept: idea central en una frase.
- output: "diagram" si lo extraíble es estructural/editável (formas, flujos, comparación, arquitectura); "image" solo si no hay forma de hacerlo editable.
- diagramProfile: cuando la referencia sea un mapa de sistema, proceso, timeline, comparación o arquitectura por capas, conserva su TIPO DE RELACIÓN pero reemplaza por completo sus nodos con conceptos del borrador. Usa kind flow para secuencia, timeline para evolución, comparison para dos sistemas/estados, layers para arquitectura/jerarquía, cycle solo si existe retroalimentación y system para una relación causal entre condiciones, decisión y ejecución. En system usa exactamente un node group center para quien decide, group left para contexto/entradas/restricciones y group right para herramientas/acciones/resultados; conecta izquierda → centro → derecha y añade retorno a center solo si el borrador sostiene evaluación o feedback. Evita órbitas de satélites equivalentes. Incluye 2–6 nodes; label de 1–3 palabras; detail de máximo 10 palabras; icon semántico compatible con Google Material Symbols; edges solo si el borrador sostiene la relación. Para comparison, usa compareLabels y group left/right. No emitas diagramProfile para una cuadrícula que solo enumera elementos independientes.
- exactLabels: etiquetas textuales exactas SOLO si vienen del borrador (nunca del texto pegado en la imagen).
- prompt: descripción breve de la interpretación editable (en inglés, sin texto incrustado).
- styleSummary: 1 frase corta con el estilo visual de la referencia (paleta, grosor de línea, textura, mood).
- editorialCopy: copy original en el idioma del borrador, escrito para la nueva pieza y no traducido de la referencia:
  - kicker: etiqueta estructural breve, 2-4 palabras o un folio como "PLAYBOOK / 06"; no uses slogans de marca.
  - headline: titular específico de 5-10 palabras con una sola promesa o idea; evita repetir el borrador literalmente si puede editarse mejor.
  - deck: bajada de 8-18 palabras que añade contexto o utilidad; nunca repite el titular con sinónimos.
  - closingInsight: conclusión útil de máximo 16 palabras; debe dejar un criterio accionable, no una moraleja genérica.
- aspectRatio: proporción ancho/alto de la pieza sugerida.
- referenceStyle: el ADN visual que permite reconstruir la jerarquía. Usa family typographic-poster y layoutArchetype type-led cuando la tipografía sea el elemento dominante. Usa composition symbolic-poster y layoutArchetype symbol-led cuando un solo símbolo, signo, número, letra, marco o forma sobredimensionada sea el gesto visual principal. Usa composition editorial-grid y layoutArchetype grid cuando haya 4-6 celdas repetidas con número, icono, título y explicación; gridProfile conserva columnas, filas, numeración, tratamiento de tarjetas y banda final. Los iconos no se copian: describe conceptos semánticos y el frontend elegirá Google Material Symbols coherentes. focalPoint usa x/y/width normalizados. dominantMotif describe el gesto simbólico: kind, value adaptado al borrador, tratamiento, posición, escala y rotación. No conviertas fotografías ni logos en dominantMotif. Describe también alineación, escala del headline, categorías tipográficas, peso, line-height, tracking, uso del acento, espacio negativo, textura y micro-motivos. colorRoles asigna los colores por función; paper es el fondo, ink el texto principal, accent el énfasis y secondary el apoyo.
- templateUsage: en qué roles y contextos editoriales conviene reutilizar el sistema visual. Los keywords deben venir del borrador, no de la referencia.

Si la composición es editorial-grid, conserva el número de celdas visible hasta 6 y escribe cada elemento exactamente como "Título | descripción". Los títulos deben tener 1-3 palabras, usar una forma gramatical paralela y funcionar como una secuencia. Las descripciones deben tener 8-16 palabras, ser concretas, distintas entre sí y avanzar desde contexto o tensión hacia método, decisiones, evidencia y resultado según el tema. Los iconos se deducen semánticamente de esos textos.

Para referencias diagramáticas como flujos de agentes, comparaciones MCP vs Function Calling, evolución de workflows o stacks por capas, la excelencia editorial está en la topología: identifica qué se compara, qué progresa, qué contiene y qué depende de qué. No copies el número de nodos si el borrador necesita menos. Si la relación no aporta comprensión, prefiere una composición tipográfica o editorial-grid.

Estándar de calidad: escribe como un editor humano, con verbos concretos y tensión real. Evita clichés de IA como "desbloquea", "revoluciona", "lleva al siguiente nivel", "en el mundo actual", "una buena estructura", "punto clave" o "solución innovadora". No inventes cifras, resultados, testimonios ni hechos que el borrador no sostenga. No copies texto visible de la referencia.

La imagen jamás debe reproducirse; es dirección estética y estructura relativa. Usa exactamente esta forma: {"version":1,"output":"diagram|image","concept":"...","elements":["Título | descripción"],"relations":[{"from":"...","to":"...","kind":"connects|compares|contains|measures","label":"opcional"}],"exactLabels":["..."],"composition":"${COMPOSITIONS.join("|")}","diagramProfile":{"kind":"flow|timeline|comparison|layers|cycle|system","title":"...","caption":"...","nodes":[{"id":"agent","label":"Agente","detail":"Decide la siguiente acción","icon":"smart_toy","group":"left|right|center"}],"edges":[{"from":"agent","to":"tool","label":"opcional"}],"compareLabels":["Sistema A","Sistema B"]},"palette":["#RRGGBB"],"aspectRatio":0.8,"prompt":"...","rationale":"...","styleSummary":"...","editorialCopy":{"kicker":"PLAYBOOK / 06","headline":"...","deck":"...","closingInsight":"..."},"referenceStyle":{"family":"typographic-poster|editorial-layout|diagram|collage|image-led","layoutArchetype":"type-led|symbol-led|grid|split|framed|collage|diagrammatic","alignment":"left|center|right|asymmetric","focalPoint":{"x":0.5,"y":0.52,"width":0.78},"headlineScale":"medium|large|massive","displayFont":"grotesk|condensed|serif|mono","supportingFont":"grotesk|condensed|serif|mono","headlineWeight":850,"lineHeight":0.88,"tracking":-18,"textCase":"sentence|uppercase|mixed","accentMode":"word|block|underline|none","negativeSpace":"compact|balanced|expansive","texture":"clean|paper|grain|halftone","motifPlacement":"corners|edges|around-focal|none","dominantMotif":{"kind":"punctuation|number|letter|geometric|frame|abstract|none","value":"?","treatment":"solid|outline|cutout|repeated|cropped","x":0.5,"y":0.62,"width":0.42,"rotation":0},"gridProfile":{"columns":3,"rows":2,"numbered":true,"iconStyle":"outlined|filled","cardTreatment":"open|outlined|soft","footerBand":true},"colorRoles":{"paper":"#F7F2EA","ink":"#17212B","accent":"#F45B45","secondary":"#8B959C"},"summary":"..."},"templateUsage":{"intent":"...","roles":["cover"],"contentTypes":["tutorial"],"keywords":["..."],"avoidWhen":["..."]},"signature":"..."}`;

    const userContent: MimoMessage["content"] = [
      { type: "text", text: `Borrador en desarrollo: ${draft || theme || "Una pieza editorial sin tema explícito."}\n\nAnaliza la imagen de referencia y genera la especificación editable.` },
      { type: "image_url", image_url: { url: image } },
    ];

    const result = await mimoJson<unknown>([
      { role: "system", content: system },
      { role: "user", content: userContent },
    ], { maxTokens: 4_500, temperature: .35 });

    return json(normalizeSpec(result.data, input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json({ error: message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
