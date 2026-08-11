import { deepSeekJson } from "../_shared/deepseek.ts";
import { json, preflight, requireAuthorization } from "../_shared/http.ts";

const COMPOSITIONS = ["hick-fitts", "measurement", "comparison", "flow", "architecture", "data", "icon", "git-merge", "editorial-diagram", "object", "scene", "metaphor"] as const;
const MODES = ["auto", "diagram", "image"] as const;
const RELATIONS = ["connects", "compares", "contains", "measures"] as const;
const DIAGRAM_KINDS = ["flow", "timeline", "comparison", "layers", "cycle", "system"] as const;
type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const strings = (value: unknown, max = 12) => Array.isArray(value) ? [...new Set(value.map((item) => text(item, 120)).filter(Boolean))].slice(0, max) : [];
const exactValue = /\b\d+(?:[.,]\d+)?(?:\s*[×x]\s*\d+(?:[.,]\d+)?)?\s*(?:dp|px|pt|rem|em|%|ms|s|kb|mb|gb|°|cm|mm|m)\b/giu;
const bareNumber = /\b\d+(?:[.,]\d+)?\b/gu;
const law = /\bLey\s+(?:de\s+)?(?:Hick|Fitts|Miller|Jakob|Tesler|Pareto)\b/giu;
const exactRelation = /\b(?:igual|equivale|mayor|menor|antes|despu[eé]s|versus|vs\.?|debe|m[ií]nimo|m[aá]ximo|por cada|entre)\b/iu;
const structuredTopic = /\b(?:flujo|proceso|pasos?|pipeline|api|endpoint|arquitectura|capas?|componentes?|servicios?|m[oó]dulos?|base de datos|flechas?|arrows?|git|github|ramas?|branches?|commits?|merge|pull\s*request|fork)\b/iu;
const gitGraph = /\b(?:git|github|ramas?|branches?|commits?|merge|pull\s*request|fork)\b/iu;
const directionalIcon = /\b(?:flechas?|arrows?|direcci[oó]n|apunta(?:ndo|r)?|indicador(?:es)?)\b/iu;

function exactLabels(source: string) {
  const measured = source.match(exactValue) ?? [];
  return [...new Set([...(source.match(law) ?? []), ...measured, ...(measured.length ? [] : source.match(bareNumber) ?? [])])].slice(0, 10);
}

function sourceText(input: JsonObject) {
  const selected = text(input["selectedText"], 4_000);
  const context = text(input["slideContext"], 8_000);
  if (!selected) return context;
  return selected.length < 28 && context && !context.toLocaleLowerCase().includes(selected.toLocaleLowerCase()) ? `${selected}. Contexto: ${context}` : selected;
}

function normalizeDiagram(value: unknown, fallbackTitle: string) {
  if (!isObject(value)) return undefined;
  const nodes = (Array.isArray(value["nodes"]) ? value["nodes"] : [])
    .filter(isObject)
    .slice(0, 6)
    .map((node, index) => {
      const group = ["left", "right", "center"].includes(String(node["group"])) ? node["group"] : undefined;
      return {
        id: text(node["id"], 32) || `node-${index + 1}`,
        label: text(node["label"], 32) || `Nodo ${index + 1}`,
        detail: text(node["detail"], 90),
        icon: text(node["icon"], 40) || "circle",
        ...(group ? { group } : {}),
      };
    });
  if (nodes.length < 2) return undefined;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(value["edges"]) ? value["edges"] : [])
    .filter(isObject)
    .map((edge) => ({ from: text(edge["from"], 32), to: text(edge["to"], 32), label: text(edge["label"], 40) || undefined }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to)
    .slice(0, 10);
  const labels = Array.isArray(value["compareLabels"]) ? value["compareLabels"] : [];
  return {
    kind: DIAGRAM_KINDS.includes(value["kind"] as typeof DIAGRAM_KINDS[number]) ? value["kind"] : "flow",
    title: text(value["title"], 84) || fallbackTitle,
    caption: text(value["caption"], 160),
    nodes,
    edges,
    ...(labels.length >= 2 ? { compareLabels: [text(labels[0], 24) || "A", text(labels[1], 24) || "B"] } : {}),
  };
}

function normalize(value: unknown, input: JsonObject) {
  if (!isObject(value)) throw new Error("INVALID_VISUAL_INTENT");
  const source = sourceText(input);
  const labels = [...new Set([...exactLabels(source), ...strings(value["exactLabels"], 10)])].slice(0, 10);
  const mode = MODES.includes(input["requestedMode"] as typeof MODES[number]) ? input["requestedMode"] as typeof MODES[number] : "auto";
  const mustBeDiagram = Boolean(labels.length || exactRelation.test(source) || structuredTopic.test(source));
  const output = mode === "image" ? "image" : mustBeDiagram || mode === "diagram" ? "diagram" : value["output"] === "image" ? "image" : "diagram";
  const diagramProfile = normalizeDiagram(value["diagramProfile"], text(value["concept"], 84) || source.slice(0, 84));
  const remoteComposition = COMPOSITIONS.includes(value["composition"] as typeof COMPOSITIONS[number]) ? value["composition"] as typeof COMPOSITIONS[number] : output === "image" ? "object" : "comparison";
  const composition = /\bhick\b/iu.test(source) && /\bfitts\b/iu.test(source) ? "hick-fitts" : gitGraph.test(source) && /\b(?:ramas?|branches?|commits?|merge)\b/iu.test(source) ? "git-merge" : directionalIcon.test(source) ? "icon" : diagramProfile ? "editorial-diagram" : remoteComposition;
  const elements = strings(value["elements"], 12);
  const relations = Array.isArray(value["relations"]) ? value["relations"].slice(0, 12).flatMap((item) => {
    if (!isObject(item)) return [];
    const from = text(item["from"], 120);
    const to = text(item["to"], 120);
    if (!from || !to) return [];
    return [{ from, to, kind: RELATIONS.includes(item["kind"] as typeof RELATIONS[number]) ? item["kind"] : "connects", label: text(item["label"], 120) || undefined }];
  }) : [];
  return {
    version: 1,
    output,
    concept: text(value["concept"], 180) || source.slice(0, 180),
    elements,
    relations,
    exactLabels: labels,
    composition,
    ...(diagramProfile ? { diagramProfile } : {}),
    aspectRatio: Math.max(.5, Math.min(2, Number(value["aspectRatio"]) || 1.5)),
    prompt: text(value["prompt"], 2_000),
    rationale: text(value["rationale"], 320) || (mustBeDiagram ? "La precisión exige capas vectoriales." : "La intención admite una imagen contextual."),
    signature: `${composition}:${crypto.randomUUID()}`,
  };
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    requireAuthorization(request);
    const input = await request.json() as JsonObject;
    if (!text(input["slideContext"]) && !text(input["selectedText"])) return json({ error: "selectedText o slideContext es obligatorio" }, 400);
    const source = sourceText(input);
    const result = await deepSeekJson<unknown>([
      {
        role: "system",
        content: `Eres un director de información visual. Decide si un texto necesita un SVG editable o una imagen contextual. Devuelve solamente JSON válido y nunca SVG, HTML, coordenadas ni estilos. En modo auto: cifras, unidades, porcentajes, leyes, etiquetas literales, comparaciones, flujos, arquitectura, flechas, símbolos direccionales y grafos Git son diagram; escenas, objetos y metáforas sin datos exactos pueden ser image. Usa composition icon para flechas o indicadores aislados y git-merge para ramas, commits y merges. Usa editorial-diagram cuando el contenido se entienda mejor como una relación editorial de 2–6 nodos: flow para secuencia, timeline para evolución, comparison para dos sistemas o estados, layers para arquitectura o jerarquía, cycle solo si existe retroalimentación y system para una relación causal entre condiciones, decisión y ejecución. Para system usa exactamente un node group center para quien decide, group left para contexto/entradas/restricciones y group right para herramientas/acciones/resultados; conecta izquierda → centro → derecha y agrega retorno hacia center solo si el texto contiene evaluación o feedback. Evita satélites equivalentes. En ese caso emite diagramProfile con label de 1–3 palabras, detail de máximo 10 palabras, un icon semántico compatible con Google Material Symbols y edges únicamente sostenidos por la fuente; no inventes pasos para llenar el layout. Si requestedMode es diagram o image, respeta esa elección explícita. Si assetOnly es true, genera un recurso aislado y nunca un póster completo. La imagen jamás debe contener palabras, cifras, logos o marcas de agua: los datos exactos permanecerán como capas del editor. Usa exactamente esta forma: {"version":1,"output":"diagram|image","concept":"...","elements":["..."],"relations":[{"from":"...","to":"...","kind":"connects|compares|contains|measures","label":"opcional"}],"exactLabels":["..."],"composition":"hick-fitts|measurement|comparison|flow|architecture|data|icon|git-merge|editorial-diagram|object|scene|metaphor","diagramProfile":{"kind":"flow|timeline|comparison|layers|cycle|system","title":"...","caption":"...","nodes":[{"id":"client","label":"Cliente","detail":"Formula la petición","icon":"devices","group":"left|right|center"}],"edges":[{"from":"client","to":"api","label":"opcional"}],"compareLabels":["Antes","Después"]},"aspectRatio":1.5,"prompt":"prompt en inglés sin texto dentro de la imagen","rationale":"...","signature":"..."}. Conserva literalmente cualquier etiqueta exacta del texto. El prompt debe pedir una interpretación fresca, un foco claro, espacio negativo y usar la paleta, además de prohibir texto, letras, cifras, medidas, UI labels, logos y watermarks.`,
      },
      {
        role: "user",
        content: JSON.stringify({ source, assetOnly: input["assetOnly"] === true, requestedMode: input["requestedMode"], palette: Array.isArray(input["palette"]) ? input["palette"].slice(0, 4) : [], previousSignatures: strings(input["previousSignatures"], 20) }),
      },
    ], 2_500);
    return json(normalize(result.data, input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json({ error: message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
