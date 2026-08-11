import { json, preflight, requireAuthorization } from "../_shared/http.ts";
import { deepSeekJson } from "../_shared/deepseek.ts";

// FUENTE DE VERDAD CANÓNICA DE RECETAS:
// apps/web/src/app/features/editor/recipe-catalog.ts
// Mantén esta lista espejo sincronizada con EDITORIAL_RECIPES.
// Cualquier recipeId emitido por este prompt debe existir aquí; el planner del
// navegador (local-editorial-planner.ts) y template-catalog.ts usan los mismos.
const CONTENT_TYPES = ["tutorial", "list", "comparison", "opinion", "repo", "case-study", "release", "resource"] as const;
const SLIDE_ROLES = ["cover", "intro", "step", "comparison", "summary", "cta"] as const;
const RECIPES = [
  "grid-manifesto", "article-hero", "cutout-spotlight", "technical-flow", "code-window",
  "numbered-lesson", "split-comparison", "evidence-frame", "pull-quote", "metric-board",
  "editorial-collage", "signature-cta", "micro-diagram",
] as const;
const ANGLES = ["resultado", "contraste", "curiosidad"] as const;
const DIAGRAM_KINDS = ["flow", "timeline", "comparison", "layers", "cycle", "system"] as const;

// Arcos narrativos (espejo de apps/web/.../narrative-blueprints.ts).
// Cada arco fija la secuencia de roles y la intención de cada slide; el LLM
// debe elegir uno explícitamente y respetar su estructura slide a slide.
const NARRATIVE_ARCS = ["how-to", "listicle", "case-study", "myth-bust", "comparison", "release-log"] as const;
type NarrativeArc = typeof NARRATIVE_ARCS[number];

// Mapa determinista contentType → arco (fallback del normalizer si el LLM no
// emite narrativeArc o emite uno inválido). Debe coincidir con resolveBlueprint.
const ARC_BY_CONTENT_TYPE: Record<string, NarrativeArc> = {
  tutorial: "how-to",
  list: "listicle",
  resource: "listicle",
  "case-study": "case-study",
  opinion: "myth-bust",
  comparison: "comparison",
  release: "release-log",
  repo: "release-log",
};

// Mapas deterministas contentType → visualStyle (fallback si el LLM no emite
// visualStyle o viene incompleto). Deben coincidir con inferVisualStyle del
// planner local (apps/web/.../local-editorial-planner.ts).
const VISUAL_BG_BY_CONTENT_TYPE: Record<string, "light" | "dark" | "paper"> = {
  tutorial: "light",
  list: "light",
  resource: "light",
  "case-study": "light",
  opinion: "paper",
  comparison: "light",
  release: "dark",
  repo: "light",
};
const VISUAL_TYPE_BY_CONTENT_TYPE: Record<string, "bold" | "serif" | "mono"> = {
  tutorial: "bold",
  list: "bold",
  resource: "bold",
  "case-study": "mono",
  opinion: "serif",
  comparison: "bold",
  release: "bold",
  repo: "mono",
};
const VISUAL_ORN_BY_CONTENT_TYPE: Record<string, "minimal" | "playful" | "technical"> = {
  tutorial: "playful",
  list: "playful",
  resource: "playful",
  "case-study": "technical",
  opinion: "minimal",
  comparison: "technical",
  release: "playful",
  repo: "technical",
};

type JsonObject = Record<string, unknown>;

const example = {
  topic: "Tema específico",
  contentType: "tutorial",
  narrativeArc: "how-to",
  visualStyle: { background: "light", typeMood: "bold", ornamentation: "playful" },
  recommendedFormat: "carousel",
  recommendedSlideCount: 3,
  hookCandidates: [
    { id: "hook-1", text: "Resultado concreto y verificable", angle: "resultado" },
    { id: "hook-2", text: "Contraste relevante", angle: "contraste" },
    { id: "hook-3", text: "Curiosidad útil", angle: "curiosidad" },
  ],
  selectedHookId: "hook-2",
  caption: "Caption fundamentado en la fuente",
  cta: "Guárdalo para consultarlo después.",
  entities: ["Angular"],
  concepts: ["arquitectura"],
  visualMotifs: ["diagrama de componentes"],
  slides: [
    { id: "slide-1", role: "cover", headline: "Hook", body: "", keyPoint: "Idea central", recipeId: "grid-manifesto", assetQueries: ["Angular official logo"] },
    {
      id: "slide-2",
      role: "step",
      headline: "El sistema en tres movimientos",
      body: "Los conectores expresan relaciones verificables, no decoración.",
      keyPoint: "Cada nodo tiene una responsabilidad.",
      recipeId: "micro-diagram",
      assetQueries: [],
      diagram: {
        kind: "flow",
        title: "De la entrada al resultado",
        caption: "Lectura de izquierda a derecha.",
        nodes: [
          { id: "input", label: "Entrada", detail: "Define el objetivo", icon: "input" },
          { id: "agent", label: "Agente", detail: "Decide la acción", icon: "smart_toy" },
          { id: "output", label: "Resultado", detail: "Entrega y evalúa", icon: "task_alt" },
        ],
        edges: [{ from: "input", to: "agent" }, { from: "agent", to: "output" }],
      },
    },
  ],
};

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const strings = (value: unknown) => Array.isArray(value) ? [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, 16) : [];
const oneOf = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] => allowed.includes(value as T[number]) ? value as T[number] : fallback;

function normalizeDiagram(value: unknown, fallbackTitle: string) {
  if (!isObject(value)) return undefined;
  const nodes = (Array.isArray(value.nodes) ? value.nodes : [])
    .filter(isObject)
    .slice(0, 6)
    .map((node, index) => {
      const group = ["left", "right", "center"].includes(String(node.group)) ? node.group : undefined;
      return {
        id: text(node.id, `node-${index + 1}`).slice(0, 32),
        label: text(node.label, `Nodo ${index + 1}`).slice(0, 32),
        detail: text(node.detail).slice(0, 90),
        icon: text(node.icon, "circle").slice(0, 40),
        ...(group ? { group } : {}),
      };
    });
  if (nodes.length < 2) return undefined;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(value.edges) ? value.edges : [])
    .filter(isObject)
    .map((edge) => ({ from: text(edge.from), to: text(edge.to), label: text(edge.label).slice(0, 40) || undefined }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to)
    .slice(0, 10);
  const labels = Array.isArray(value.compareLabels) ? value.compareLabels : [];
  const compareLabels = labels.length >= 2
    ? [text(labels[0], "A").slice(0, 24), text(labels[1], "B").slice(0, 24)]
    : undefined;
  return {
    kind: oneOf(value.kind, DIAGRAM_KINDS, "flow"),
    title: text(value.title, fallbackTitle).slice(0, 84),
    caption: text(value.caption).slice(0, 160),
    nodes,
    edges,
    ...(compareLabels ? { compareLabels } : {}),
  };
}

function normalizePlan(value: unknown) {
  if (!isObject(value)) throw new Error("INVALID_EDITORIAL_PLAN");
  const rawHooks = Array.isArray(value.hookCandidates) ? value.hookCandidates : [];
  const hooks = ANGLES.map((angle, index) => {
    const candidate = isObject(rawHooks[index]) ? rawHooks[index] : {};
    return { id: text(candidate.id, `hook-${index + 1}`), text: text(candidate.text, `Hook ${index + 1}`), angle };
  });
  const rawSlides = Array.isArray(value.slides) ? value.slides.slice(0, 10) : [];
  if (!rawSlides.length) throw new Error("EDITORIAL_PLAN_WITHOUT_SLIDES");
  let previousRecipe = "";
  const slides = rawSlides.map((item, index) => {
    const slide = isObject(item) ? item : {};
    const headline = text(slide.headline, index === 0 ? hooks[0].text : `Punto ${index + 1}`);
    const diagram = normalizeDiagram(slide.diagram, headline);
    let recipeId = diagram ? "micro-diagram" : oneOf(slide.recipeId, RECIPES, RECIPES[index % RECIPES.length]);
    if (!diagram && recipeId === previousRecipe) recipeId = RECIPES[(RECIPES.indexOf(recipeId) + 1) % RECIPES.length];
    previousRecipe = recipeId;
    return {
      id: text(slide.id, crypto.randomUUID()),
      role: oneOf(slide.role, SLIDE_ROLES, index === 0 ? "cover" : index === rawSlides.length - 1 ? "cta" : "step"),
      headline,
      body: text(slide.body),
      keyPoint: text(slide.keyPoint, text(slide.headline, `Punto ${index + 1}`)),
      recipeId,
      assetQueries: strings(slide.assetQueries).slice(0, 6),
      ...(diagram ? { diagram } : {}),
    };
  });
  const selectedHookId = hooks.some((hook) => hook.id === value.selectedHookId) ? String(value.selectedHookId) : hooks[0].id;
  const contentType = oneOf(value.contentType, CONTENT_TYPES, "tutorial");
  // narrativeArc: acepta el valor del LLM si es válido; si no, cae al arco
  // canónico del contentType. Así el plan siempre lleva un arco coherente.
  const remoteArc = typeof value.narrativeArc === "string" && (NARRATIVE_ARCS as readonly string[]).includes(value.narrativeArc) ? value.narrativeArc as NarrativeArc : ARC_BY_CONTENT_TYPE[contentType] ?? "how-to";
  // visualStyle: normaliza el objeto del LLM a valores canónicos; si viene
  // incompleto o inválido, inferencia determinista desde el contentType.
  const rawStyle = isObject(value.visualStyle) ? value.visualStyle : {};
  const visualStyle = {
    background: oneOf(rawStyle.background, ["light", "dark", "paper"], VISUAL_BG_BY_CONTENT_TYPE[contentType] ?? "light"),
    typeMood: oneOf(rawStyle.typeMood, ["bold", "serif", "mono"], VISUAL_TYPE_BY_CONTENT_TYPE[contentType] ?? "bold"),
    ornamentation: oneOf(rawStyle.ornamentation, ["minimal", "playful", "technical"], VISUAL_ORN_BY_CONTENT_TYPE[contentType] ?? "playful"),
  };
  return {
    topic: text(value.topic, slides[0].headline),
    contentType,
    narrativeArc: remoteArc,
    visualStyle,
    recommendedFormat: slides.length === 1 ? "single" as const : "carousel" as const,
    recommendedSlideCount: slides.length,
    hookCandidates: hooks,
    selectedHookId,
    caption: text(value.caption, slides.map((slide) => slide.keyPoint).join("\n\n")),
    cta: text(value.cta, "Guárdalo para consultarlo después."),
    entities: strings(value.entities),
    concepts: strings(value.concepts),
    visualMotifs: strings(value.visualMotifs),
    slides,
  };
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    requireAuthorization(request);
    const input = await request.json();
    if (!input.sourceText || !input.brand || !input.preferences) return json({ error: "brand, sourceText y preferences son obligatorios" }, 400);
    const result = await deepSeekJson<unknown>([
      {
        role: "system",
        content: `Eres el director editorial de Polyedro. Convierte un tema o una fuente en contenido que una persona quiera leer, guardar y usar. Devuelve solamente json válido; no devuelvas coordenadas ni imágenes.

VOZ DE MARCA
La marca tiene un nombre, una descripción y (opcionalmente) pilares inferidos de esa descripción. Aterriza el copy a esa voz: si la marca es "Bitácora de tecnología en vivo. Lo que pasó esta semana, el problema que acabo de resolver y el ranking que te ahorra probar cinco cosas. Técnico con punchline", escribe desde esa bitácora —no como un copywriter genérico de startup. Nunca uses frases hechas de growth-hacking ("desbloquea", "potencia", "revoluciona"). Si la descripción de marca falta, escribe con voz técnica, honesta y con trazo de cuaderno.

ARCOS NARRATIVOS
Elige uno de estos seis arcos y rellénalo con la secuencia indicada. El arco estructura el orden de las láminas —no es decorativo. Si el formato es individual (1 lámina), colapsa todo en role "summary".
- how-to (tutoriales): cover → intro → step × N → summary → cta. Promesa, contexto, pasos numerados, trampa común, aplicación.
- listicle (listas/recursos): cover → step × N → summary → cta. Cada step es un item discreto accionable.
- case-study (casos): cover → intro → step → comparison → step → summary → cta. Contexto, problema, decisión, acción, resultado medible, lección.
- myth-bust (opinión): cover → comparison → step → step → summary → cta. Hook polémico, el mito, la evidencia, el matiz, postura honesta.
- comparison (comparativas): cover → intro → comparison × N → summary → cta. Contexto, criterios, versus por criterio, veredicto matizado.
- release-log (releases/repos): cover → intro → step × N → summary → cta. Qué es, qué cambia, highlights, cómo migrar, disponibilidad.

PRIORIDAD EDITORIAL
1. Identifica para quién es, qué problema resuelve y qué cambio concreto promete. Si preferences.audience está vacío, infiere una audiencia estrecha y plausible a partir del tema.
2. Extrae primero la información de mayor utilidad: mecanismo, decisión, ejemplo, error, comparación o pasos. Elimina introducciones obvias, definiciones de diccionario, repetición y relleno motivacional.
3. Cada lámina debe aportar una idea nueva y poder entenderse sin leer un párrafo largo. Headline máximo 84 caracteres; body máximo 260. Usa lenguaje concreto y verbos activos. No repitas el mismo tipo de idea en láminas consecutivas —avanza la historia.

HOOKS
Genera exactamente tres hooks, en este orden: resultado concreto, tensión/contraste y curiosidad útil. Un buen hook combina especificidad, relevancia para la audiencia, una tensión real y una vista previa honesta del valor. Selecciona el más fuerte, no el primero por defecto. Evita clickbait y fórmulas gastadas como "nadie te cuenta", "todo lo que necesitas saber", "guía definitiva", "esto cambiará tu vida" o "el secreto de". No empieces los tres hooks igual. No uses signos de exclamación.

RIGOR
Si sourceText es una fuente extensa, no agregues afirmaciones, cifras, citas o resultados que no estén en ella. Si sourceText es solo un tema breve, puedes usar conocimiento general estable para construir una explicación práctica, pero nunca inventes estadísticas, fechas, benchmarks, citas, noticias ni resultados precisos. Si falta evidencia, formula la idea como principio o recomendación, no como hecho medido.

INTENCIÓN
preferences.goal controla el cierre: teach = comprensión aplicable; save = referencia/checklist; discuss = contraste con pregunta específica; act = siguiente paso concreto. El CTA y la caption deben modularse por goal y por arco (p.ej. release-log + act → "actualiza y prueba en staging"; case-study + discuss → "¿habrías decidido igual?"). Respeta exactamente preferences.slideCount cuando sea un número y usa entre 1 y 10 láminas cuando sea auto.

DISEÑO
Solo puedes emitir recipeId de esta lista de recetas canónicas. Elige por intención del slide, nunca repitas la misma receta consecutiva, y pide assets de catálogo para marcas conocidas (nunca inventes logos):
- grid-manifesto: portada con grid técnico y titular contundente (manifiestos, opinión, releases).
- article-hero: portada editorial con imagen protagonista borde a borde (requiere imagen; casos, narrativas, releases).
- cutout-spotlight: intro que aisla un sujeto con cinta y acento orbital (requiere imagen; feature o protagonista).
- technical-flow: paso con cajas conectadas por flechas (procesos, pipelines, secuencias).
- code-window: paso con marco de terminal sobre una captura (requiere captura; código, salida, snippet de repo).
- numbered-lesson: paso con número grande y lección al lado (tips numerados, listicles, lecciones).
- split-comparison: comparación en dos columnas antes/después o versus (trade-offs, comparativas).
- evidence-frame: paso con crop-marks alrededor de evidencia (requiere captura; resultados, pruebas, evidencia de repo).
- pull-quote: cierre con frase sobredimensionada bajo acento de marca (insights, takeaways, afirmaciones).
- metric-board: cierre con grid de métricas y números (KPIs, benchmarks, resultados medibles).
- editorial-collage: intro tipo collage con cinta y papel (requiere imagen; colecciones de recursos, toolkits, releases).
- signature-cta: cierre con barra de marca y flecha (último slide accionable de cualquier carrusel).
- micro-diagram: diagrama editorial nativo con nodos, conectores e iconos (procesos, capas, timelines, ciclos, comparaciones y sistemas).

MICRODIAGRAMAS EDITORIALES
Usa entre 1 y 3 por carrusel, nunca en cover ni CTA, y solo cuando la relación espacial explica la idea mejor que una lista. Selecciona kind por la semántica: flow para secuencia; timeline para evolución; comparison para dos sistemas o estados; layers para arquitectura o jerarquía; cycle solo si existe retroalimentación; system para una relación causal entre condiciones, decisión y ejecución. En system usa exactamente un node group center para quien decide, group left para contexto/entradas/restricciones y group right para herramientas/acciones/resultados; conecta izquierda → centro → derecha y vuelve al centro solo si sourceText contiene evaluación o feedback. Evita satélites equivalentes alrededor del centro. Cada diagram debe tener 2–6 nodes. label usa 1–3 palabras; detail un máximo de 10 palabras; icon es un concepto compatible con Google Material Symbols. Incluye edges únicamente cuando sourceText sostiene esa relación. No inventes pasos para llenar el diseño. Si emites diagram, recipeId debe ser "micro-diagram". Alterna diagramas con slides tipográficos, evidencia o ejemplos.

DIRECCIÓN VISUAL
Emite visualStyle con tres campos para darle a la pieza un look coherente (no genérico):
- background: "light" | "dark" | "paper". Claro editorial para guías/listas/casos; oscuro para releases y tech; papel cálido para opinión y reflexiones.
- typeMood: "bold" | "serif" | "mono". Bold para contenido accionable y tutoriales; serif para opinión y narrativa; mono para código/repos.
- ornamentation: "minimal" | "playful" | "technical". Playful cuando hay stickers/tips que destacar; technical para diagramas y arquitectura; minimal para piezas sobrias.
Elige según el contenido real, no por defecto. La dirección visual debe reforzar el arco narrativo y el goal.

El json debe seguir exactamente esta forma: ${JSON.stringify(example)}`,
      },
      {
        role: "user",
        content: `Produce el EditorialPlan en json para esta entrada:\n${JSON.stringify({ brand: input.brand, preferences: input.preferences, availableAssets: input.availableAssets ?? [], sourceText: String(input.sourceText).slice(0, 32_000) })}`,
      },
    ]);
    return json(normalizePlan(result.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json({ error: message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
