import { ApiError } from "@/api/shared";
import { deepSeekJson, isDeepSeekConfigured } from "@/api/services/deepseek";
import { env } from "@Polyedro-abs/env/server";

// ---------------------------------------------------------------------------
// Topic Research — fase 1 del flujo editorial (arbe.blog)
//
// Convierte una idea corta (o un texto pegado) en un TopicDraft: un post
// largo estructurado listo para revisión humana. Si hay TAVILY_API_KEY y el
// input es una idea, investiga la web primero (noticias actuales, problemas,
// rankings) y DeepSeek redacta el post citando las fuentes. Si el input es
// texto pegado con modo rewrite, solo se reorganiza/limpia el texto.
// ---------------------------------------------------------------------------

export const TOPIC_CATEGORIES = ["news", "problem-solved", "ranking", "field-notes"] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export type TopicSource = {
  title: string;
  url: string;
  snippet: string;
};

export type TopicDraft = {
  id: string;
  title: string;
  category: TopicCategory;
  /** Post largo estructurado en markdown-lite (## secciones, bullets). */
  body: string;
  /** Fuentes consultadas durante la investigación (vacías en rewrite). */
  sources: TopicSource[];
  /** 3-5 takeaways clave que alimentarán el plan editorial. */
  keyTakeaways: string[];
  createdAt: string;
  provider: "deepseek";
  model?: string;
};

export type TopicInput = {
  mode: "research" | "rewrite";
  /** Idea corta (research) o texto largo pegado (rewrite). */
  topic: string;
  category?: TopicCategory;
  audience?: string;
  /** En rewrite: true si el texto ya está estructurado y no debe reescribirse. */
  keepAsIs?: boolean;
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const strings = (value: unknown) => Array.isArray(value) ? [...new Set(value.map((item) => text(item)).filter(Boolean))].slice(0, 8) : [];

// ---------------------------------------------------------------------------
// Tavily — búsqueda web real
// ---------------------------------------------------------------------------

type TavilyResult = {
  results?: Array<{ title?: string; url?: string; content?: string }>;
  answer?: string;
};

export const isTavilyConfigured = () => !!env.TAVILY_API_KEY;

/** Búsqueda web vía Tavily. Devuelve resultados frescos (título, url, snippet
 *  del contenido). Sin key configurada lanza ApiError 500; el caller decide
 *  caer a redacción sin fuentes. */
export async function tavilySearch(query: string, maxResults = 6): Promise<TopicSource[]> {
  const key = env.TAVILY_API_KEY;
  if (!key) throw new ApiError(500, "TAVILY_API_KEY_MISSING");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: false,
    }),
  });

  if (!response.ok) throw new ApiError(502, `TAVILY_${response.status}:${(await response.text()).slice(0, 400)}`);
  const payload = await response.json() as TavilyResult;
  const results = (payload.results ?? [])
    .map((item) => ({ title: text(item.title, "Fuente"), url: text(item.url), snippet: text(item.content, "").slice(0, 300) }))
    .filter((item) => item.url);
  if (!results.length) throw new ApiError(502, "EMPTY_TAVILY_RESULTS");
  return results.slice(0, maxResults);
}

/** Arma la query de Tavily según categoría para que la búsqueda sea precisa
 *  (noticias frescas, comparativas, casos, etc.). */
function buildSearchQuery(topic: string, category?: TopicCategory): string {
  switch (category) {
    case "news":
      return `${topic} latest news 2026 analysis`;
    case "problem-solved":
      return `${topic} common problem solved how to fix`;
    case "ranking":
      return `${topic} comparison ranking best options`;
    case "field-notes":
      return `${topic} experience review lessons learned`;
    default:
      return `${topic} explainer analysis`;
  }
}

// ---------------------------------------------------------------------------
// Prompt de redacción — post largo con voz arbe.blog (estructura blog-publisher)
// ---------------------------------------------------------------------------

const example = {
  title: "Título del post, específico y con postura",
  body: "> TL;DR: 3-6 bullets con lo esencial (qué, por qué importa, qué cambiaría).\n\n## El problema real\n\nPor qué importa hoy, para quién y qué promesa cumple el post.\n\n## Lo que encontré al probarlo\n\n- Punto con evidencia o fuente.\n- Punto con dato concreto (número, caso, tradeoff).\n\n## Decisiones que tomé\n\nQué elegí, qué descarté y por qué. Tradeoffs explícitos.\n\n## Errores comunes\n\nTrampas que otros cometen (y yo también).\n\n## Conclusión y siguiente paso\n\nPostura clara + acción concreta que el lector puede hacer hoy.",
  keyTakeaways: ["Takeaway 1 accionable", "Takeaway 2", "Takeaway 3"],
};

function buildRedactionPrompt(input: TopicInput, sources: TopicSource[]): string {
  const categoryLabel = input.category ? `Categoría editorial: ${input.category}` : "Categoría editorial: detectala del tema.";
  const audience = input.audience ? `Audiencia: ${input.audience}` : "Audiencia: devs y curiosos técnicos.";
  const sourcesBlock = sources.length
    ? `\nFUENTES DE INVESTIGACIÓN (usa sus datos como evidencia, cita por URL):\n${sources.map((item) => `- ${item.title} — ${item.url}\n  ${item.snippet}`).join("\n")}`
    : "\nFUENTES: no hay fuentes externas disponibles; redacta con conocimiento técnico general estable, sin inventar cifras, fechas ni citas.";
  return `Redacta un POST LARGO de blog (no un carrusel): es el material fuente que una persona revisará y después se convertirá en publicaciones. ${categoryLabel} ${audience}${sourcesBlock}

Estructura obligatoria (en este orden):
1. TL;DR al inicio: bloque con ">" y 3-6 bullets que resuman lo esencial (qué, por qué importa, qué cambiaría).
2. ## El problema real: contexto, para quién, qué promesa cumple el post.
3. ## Desarrollo con headers DESCRIPTIVOS (nunca "Introducción", "Desarrollo", "Contexto", "Lo que encontré"): cada H2 debe anunciar una idea específica (ej. "## Por qué los agentes fallan en producción", "## El tradeoff entre velocidad y mantenibilidad").
4. ## Errores comunes o tradeoffs: trampas reales con consecuencias.
5. ## Conclusión y siguiente paso: postura clara + acción concreta.

REGLAS DE FORMATO
- Entre 500 y 900 palabras. Oraciones de máx. 25 palabras. Párrafos de 2-4 líneas.
- Incluí números y resultados concretos cada vez que las fuentes los tengan.
- Cada H2 se lee como un índice accionable: si alguien lee solo los headers, entiende el post.
- Una ironía seca al cerrar (marca: humor es condimento, no plato).

REGLAS DE VOZ (arbe.blog)
- Técnico con humor seco. Serio con la evidencia, irónico con el hype.
- Evidencia > opinión: si decís "es mejor", mostrá el número o el caso.
- Postura sí: decí qué elegirías vos y por qué.
- Prohibido: growth-hacking slop, clickbait, "guías definitivas", "todo lo que necesitas saber", vender humo, headers genéricos.
- Si un dato no está en las fuentes ni en conocimiento estable, formula el punto como principio o recomendación, nunca como hecho medido.
- Los headers NO se convierten en slides: este post alimentará publicaciones, así que cada sección debe contener ideas únicas y específicas.

El json debe seguir exactamente esta forma: ${JSON.stringify(example)}`;
}

function normalizeDraft(value: unknown, fallbackTopic: string, category: TopicCategory, sources: TopicSource[]): TopicDraft {
  if (!isObject(value)) throw new ApiError(502, "INVALID_TOPIC_DRAFT");
  const title = text(value.title, fallbackTopic.slice(0, 80));
  const body = text(value.body);
  if (!body) throw new ApiError(502, "TOPIC_DRAFT_WITHOUT_BODY");
  const keyTakeaways = strings(value.keyTakeaways);
  return {
    id: crypto.randomUUID(),
    title: title.length > 120 ? `${title.slice(0, 117)}…` : title,
    category,
    body,
    sources,
    keyTakeaways: keyTakeaways.length ? keyTakeaways : ["Revisa el post aprobado para definir takeaways"],
    createdAt: new Date().toISOString(),
    provider: "deepseek",
  };
}

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------

/** Fase 1: investiga (Tavily) + redacta un post largo listo para revisión. */
export const researchTopic = async (input: TopicInput): Promise<TopicDraft> => {
  if (!isDeepSeekConfigured()) throw new ApiError(500, "DEEPSEEK_API_KEY_MISSING");
  const category = input.category ?? "news";
  let sources: TopicSource[] = [];
  if (isTavilyConfigured()) {
    try {
      sources = await tavilySearch(buildSearchQuery(input.topic, category));
    } catch (error) {
      // Sin investigación web seguimos: DeepSeek redacta con conocimiento general.
      console.warn("[TopicResearch] Tavily no disponible, redactando sin fuentes:", error instanceof Error ? error.message : String(error));
    }
  }

  const result = await deepSeekJson<unknown>(
    [
      { role: "system", content: buildRedactionPrompt(input, sources) },
      { role: "user", content: `Produce el TopicDraft json para:\nTEMA: ${input.topic}\nCATEGORÍA: ${input.category ?? "auto-detectada"}\nAUDIENCIA: ${input.audience ?? "no especificada"}` },
    ],
    7_000,
  );

  const draft = normalizeDraft(result.data, input.topic, category, sources);
  return { ...draft, model: result.model };
};

/** Fase 1b: reordena/limpia un texto pegado. Si keepAsIs, no reescribe: el
 *  texto del usuario ES el draft (solo se extrae título y takeaways). */
export const rewriteTopic = async (input: TopicInput): Promise<TopicDraft> => {
  const category = input.category ?? "news";
  if (input.keepAsIs || !isDeepSeekConfigured()) {
    const sentences = input.topic.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    return {
      id: crypto.randomUUID(),
      title: text(input.topic.split("\n")[0], "Tema").slice(0, 120),
      category,
      body: input.topic.trim(),
      sources: [],
      keyTakeaways: sentences.slice(0, 5).map((item) => item.length > 140 ? `${item.slice(0, 137)}…` : item),
      createdAt: new Date().toISOString(),
      provider: "deepseek",
    };
  }

  const system = `Eres el editor de arbe.blog. Reescribe el texto pegado por el usuario como un POST LARGO de blog bien estructurado (500-900 palabras). Conserva TODOS los datos y ejemplos del original (no inventes ni elimines evidencia), comprime repeticiones y mejora el flujo.

Estructura obligatoria (en este orden):
1. TL;DR al inicio: bloque con ">" y 3-6 bullets que resuman lo esencial.
2. ## El problema real: contexto, para quién, qué promesa cumple.
3. ## Desarrollo con headers DESCRIPTIVOS (nunca "Introducción", "Desarrollo", "Contexto", "Lo que encontré"): cada H2 anuncia una idea específica.
4. ## Errores comunes o tradeoffs: trampas reales con consecuencias.
5. ## Conclusión y siguiente paso: postura clara + acción concreta.

REGLAS DE FORMATO
- Oraciones de máx. 25 palabras. Párrafos de 2-4 líneas.
- Cada H2 se lee como un índice accionable.

REGLAS DE VOZ (arbe.blog)
- Técnico con humor seco. Serio con la evidencia, irónico con el hype.
- Prohibido: growth-hacking slop, clickbait, "guías definitivas", vender humo, headers genéricos.
- Una ironía seca al cerrar como máximo.

El json debe seguir exactamente esta forma: ${JSON.stringify(example)}`;

  const result = await deepSeekJson<unknown>(
    [
      { role: "system", content: system },
      { role: "user", content: `Texto original del usuario:\n\n${input.topic.slice(0, 30_000)}` },
    ],
    7_000,
  );

  const draft = normalizeDraft(result.data, input.topic.slice(0, 80), category, []);
  return { ...draft, model: result.model };
};
