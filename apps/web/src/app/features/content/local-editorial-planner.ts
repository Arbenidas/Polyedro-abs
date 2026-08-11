import type { ContentPreferences, EditorialPlan, EditorialSlidePlan, HookAngle, VisualStyle } from "./content.models";
import {
  type EditorialContentType,
  type EditorialRecipeId,
  type EditorialRole,
} from "../editor/recipe-catalog";
import {
  type NarrativeBlueprint,
  expandSequence,
  pickRecipeForArc,
  resolveBlueprint,
} from "../editor/narrative-blueprints";
import type { EditorialDiagramKind, EditorialDiagramProfile } from "../editor/editor.models";

/** Inferencia determinista de la dirección visual según el contentType y el
 *  objetivo. Coherente con lo que la edge function pide a DeepSeek: la pieza
 *  "habla" visualmente según su naturaleza, sin genéricos. */
function inferVisualStyle(contentType: EditorialContentType, goal?: string): VisualStyle {
  switch (contentType) {
    case "repo":
    case "case-study":
      return { background: "light", typeMood: "mono", ornamentation: "technical" };
    case "release":
      return { background: "dark", typeMood: "bold", ornamentation: "playful" };
    case "opinion":
      return { background: "paper", typeMood: "serif", ornamentation: "minimal" };
    case "comparison":
      return { background: "light", typeMood: "bold", ornamentation: "technical" };
    case "list":
    case "resource":
      return { background: "light", typeMood: "bold", ornamentation: "playful" };
    case "tutorial":
    default:
      return goal === "save" || goal === "act"
        ? { background: "light", typeMood: "bold", ornamentation: "playful" }
        : { background: "paper", typeMood: "serif", ornamentation: "minimal" };
  }
}

function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function shorten(value: string, max: number) {
  const compact = clean(value);
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).replace(/\s+\S*$/, "").replace(/[,:;.-]+$/, "")}…`;
}

function sentences(source: string) {
  return source.split(/\n+|[.!?]\s+/).map(clean).filter((item) => item.length > 24);
}

const detectContentType = (text: string): EditorialContentType => {
  const lower = text.toLowerCase();
  if (/github|repositorio|\brepo\b/.test(lower)) return "repo";
  if (/ vs |versus|compar/.test(lower)) return "comparison";
  if (/release|versi[oó]n|novedad/.test(lower)) return "release";
  if (/paso|c[oó]mo|tutorial|gu[ií]a/.test(lower)) return "tutorial";
  if (/herramienta|recurso|colecci[oó]n/.test(lower)) return "resource";
  if (/caso|constru[ií]|proyecto/.test(lower)) return "case-study";
  return "opinion";
}

function extractEntities(text: string) {
  const known = ["Angular", "Flutter", "Java", "Quarkus", "Spring", "GitHub", "HTTPS", "Google", "Figma", "Supabase"];
  return known.filter((entity) => new RegExp(`\\b${entity}\\b`, "i").test(text));
}

function hook(id: string, text: string, angle: HookAngle) { return { id, text: shorten(text, 92), angle }; }

function sentenceMatching(chunks: string[], pattern: RegExp) {
  return chunks.find((item) => pattern.test(item));
}

function stripLead(value: string) {
  return clean(value).replace(/^(el principal problema (era|es)|el problema (era|es)|primero|despu[eé]s|ahora|por eso|resultado:?)\s*/i, "").replace(/[.]$/, "");
}

function localDiagram(source: string, headline: string, body: string, role: EditorialRole): EditorialDiagramProfile | undefined {
  if (["cover", "cta"].includes(role)) return undefined;
  const lower = `${headline} ${body}`.toLocaleLowerCase();
  let kind: EditorialDiagramKind | undefined;
  if (role === "comparison" || /\bvs\b|versus|antes.+despu[eé]s|diferencia|compar/.test(lower)) kind = "comparison";
  else if (/capas?|layer|jerarqu[ií]a|stack|nivel/.test(lower)) kind = "layers";
  else if (/ciclo|loop|feedback|iteraci[oó]n|retroaliment/.test(lower)) kind = "cycle";
  else if (/timeline|evoluci[oó]n|de.+a |etapas?|fases?/.test(lower)) kind = "timeline";
  else if (/agentes?|harness|mcp|componentes?|servicios?|arquitectura|ecosistema|sistema/.test(lower)) kind = "system";
  else if (/flujo|proceso|pasos?|pipeline|primero|despu[eé]s|entrada|salida/.test(lower)) kind = "flow";
  if (!kind) return undefined;

  const known = ["Usuario", "Contexto", "Guardrails", "Memoria", "Reglas", "Agente", "Harness", "Modelo", "MCP", "Herramienta", "API", "Cliente", "Servidor", "Datos", "Interfaz", "Resultado", "Feedback"];
  let labels = known.filter((term) => new RegExp(`\\b${term}\\b`, "iu").test(`${source} ${body}`));
  if (labels.length < 2) labels = body.split(/→|\n|,|;|\sy\s/iu).map((item) => shorten(stripLead(item), 28)).filter((item) => item.length > 3).slice(0, 5);
  if (labels.length < 2) labels = kind === "comparison" ? ["Estado actual", "Estado propuesto"] : ["Entrada", "Decisión", "Resultado"];
  labels = [...new Set(labels)].slice(0, 6);
  const semanticDetails: Record<string, string> = {
    usuario: "Define el objetivo", contexto: "Conserva reglas y memoria", guardrails: "Limitan riesgo y alcance",
    memoria: "Conserva decisiones previas", reglas: "Fijan condiciones de operación", agente: "Decide la siguiente acción", harness: "Aporta contexto y control",
    modelo: "Interpreta y propone", mcp: "Conecta capacidades externas", herramienta: "Ejecuta trabajo verificable",
    api: "Intercambia datos", cliente: "Formula la petición", servidor: "Procesa la solicitud",
    datos: "Conservan el estado", interfaz: "Expone la interacción", resultado: "Entrega evidencia", feedback: "Evalúa y corrige",
  };
  const systemCenterIndex = kind === "system" ? Math.max(0, labels.findIndex((label) => /agente|harness|modelo|sistema/iu.test(label))) : -1;
  const nodes = labels.map((label, index) => ({
    id: `node-${index + 1}`,
    label,
    detail: semanticDetails[label.toLocaleLowerCase()] ?? (index === 0 ? shorten(body, 62) : index === labels.length - 1 ? "Cierra la secuencia" : "Transforma la entrada"),
    icon: label,
    group: kind === "comparison"
      ? (index < Math.ceil(labels.length / 2) ? "left" as const : "right" as const)
      : kind === "system" && index === systemCenterIndex ? "center" as const
        : kind === "system" && /usuario|contexto|guardrails|memoria|reglas|cliente|datos/iu.test(label) ? "left" as const
          : kind === "system" ? "right" as const : undefined,
  }));
  const systemCenter = kind === "system" ? nodes.find((node) => node.group === "center") ?? nodes[0] : undefined;
  const systemEdges = systemCenter ? (() => {
    const conditions = nodes.filter((node) => node.group === "left");
    const execution = nodes.filter((node) => node.group === "right");
    const feedback = execution.find((node) => /feedback|retroaliment/iu.test(node.label));
    const forward = execution.filter((node) => node.id !== feedback?.id);
    return [
      ...conditions.map((node) => ({ from: node.id, to: systemCenter.id })),
      ...(forward[0] ? [{ from: systemCenter.id, to: forward[0].id }] : []),
      ...forward.slice(0, -1).map((node, index) => ({ from: node.id, to: forward[index + 1]!.id })),
      ...(feedback && forward.length ? [{ from: forward[forward.length - 1]!.id, to: feedback.id }, { from: feedback.id, to: systemCenter.id, label: "ajusta" }] : []),
    ];
  })() : [];
  return {
    kind,
    title: headline,
    caption: shorten(body, 140),
    nodes,
    edges: ["comparison", "layers"].includes(kind)
      ? []
      : systemCenter
        ? systemEdges
        : nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1]!.id })),
    compareLabels: kind === "comparison" ? ["ACTUAL", "PROPUESTO"] : undefined,
  };
}

export function buildLocalEditorialPlan(sourceText: string, preferences: ContentPreferences): EditorialPlan {
  const source = clean(sourceText);
  const chunks = sentences(source);
  const first = chunks[0] ?? source;
  const topic = shorten(first.replace(/^(hoy|quiero|vamos a|en este (artículo|post))\s+/i, ""), 68);
  const contentType = detectContentType(source);
  const requested = preferences.slideCount === "auto" ? Math.max(1, Math.min(7, chunks.length + 2)) : preferences.slideCount;
  const count = preferences.format === "single" ? 1 : preferences.format === "carousel" ? Math.max(2, requested) : Math.max(5, requested);
  const entities = extractEntities(source);
  const problem = sentenceMatching(chunks, /problema|error|fall|fricci[oó]n|dif[ií]cil|carga|riesgo|evitar/i);
  const action = sentenceMatching(chunks, /primero|despu[eé]s|paso|mov|aisl|cambi|aplic|usamos|creamos|reduce/i);
  const outcome = sentenceMatching(chunks, /ahora|resultado|logr|mejor|reduj|baj[oó]|aument|permite|puede/i);
  const subject = entities[0] ? `${entities[0]} · ${shorten(stripLead(first), 58)}` : shorten(stripLead(first), 72);
  const resultText = outcome
    ? `${entities[0] ? `${entities[0]}: ` : ""}${shorten(stripLead(outcome), 78)}`
    : `Cómo aplicar ${shorten(stripLead(first).toLowerCase(), 58)} sin añadir complejidad`;
  const contrastText = problem
    ? `${shorten(stripLead(problem), 46)}. La decisión que lo resolvió`
    : `${subject}: más información no siempre significa más claridad`;
  const curiosityText = action
    ? `La decisión que cambió el resultado: ${shorten(stripLead(action), 54)}`
    : `Antes de aplicar ${shorten(stripLead(first).toLowerCase(), 54)}, revisa esto`;
  const hooks = [hook("hook-result", resultText, "resultado"), hook("hook-contrast", contrastText, "contraste"), hook("hook-curiosity", curiosityText, "curiosidad")];
  const selectedHookId = outcome ? "hook-result" : problem ? "hook-contrast" : "hook-curiosity";
  const blueprint: NarrativeBlueprint = resolveBlueprint(contentType);
  const sequence = expandSequence(blueprint, count);
  const goal = preferences.goal ?? "teach";
  let previousRecipe: string | undefined;
  let diagramCount = 0;
  const slides: EditorialSlidePlan[] = Array.from({ length: count }, (_, index) => {
    const role: EditorialRole = sequence[index] ?? "step";
    const bodySource = chunks[Math.max(0, index - 1)] ?? chunks[index % Math.max(1, chunks.length)] ?? source;
    const headline = index === 0 ? (hooks.find((item) => item.id === selectedHookId)?.text ?? hooks[0].text) : index === count - 1 ? blueprint.closingRule(goal).cta : shorten(bodySource, 62);
    const diagram = diagramCount < 2 && previousRecipe !== "micro-diagram" ? localDiagram(source, headline, bodySource, role) : undefined;
    if (diagram) diagramCount += 1;
    const recipeId: EditorialRecipeId = diagram ? "micro-diagram" : pickRecipeForArc(blueprint, role, contentType, previousRecipe);
    previousRecipe = recipeId;
    const defaultIcons: Record<EditorialRole, string> = { cover: "rocket", intro: "lightbulb", step: "gear", comparison: "arrow", summary: "bookmark", cta: "pencil" };
    return {
      id: crypto.randomUUID(), role, headline, body: shorten(bodySource, count === 1 ? 520 : 230), keyPoint: shorten(bodySource, 120),
      proof: /\d|%|caso|ejemplo|resultado|error/iu.test(bodySource) ? shorten(bodySource, 150) : undefined,
      transitionCue: index < count - 1 ? shorten(`Siguiente: ${chunks[index] ?? chunks[index + 1] ?? "aplicar el criterio"}`, 90) : undefined,
      recipeId, assetQueries: extractEntities(bodySource), iconConcept: defaultIcons[role] ?? "gear", diagram,
    };
  });
  const closing = blueprint.closingRule(goal);
  const visualStyle = inferVisualStyle(contentType, goal);
  return {
    topic, contentType, narrativeArc: blueprint.id, visualStyle, recommendedFormat: count === 1 ? "single" : "carousel", recommendedSlideCount: count,
    hookCandidates: hooks, selectedHookId,
    caption: shorten(`${source}\n\n${preferences.audience ? `Pensado para ${preferences.audience}. ` : ""}${closing.captionSuffix}`, 900),
    cta: closing.cta, entities,
    concepts: [contentType, blueprint.id, "aprendizaje"], visualMotifs: contentType === "repo" ? ["captura de repositorio", "stack", "arquitectura"] : ["anotación", "diagrama", "flecha"], slides,
  };
}
