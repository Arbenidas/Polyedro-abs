import { ApiError } from "@/api/shared";
import { deepSeekJson, isDeepSeekConfigured } from "@/api/services/deepseek";
import { isTavilyConfigured } from "@/api/services/topic-research";
import { env } from "@Polyedro-abs/env/server";

export type TrendWindow = "day" | "week";
export type ShortVideoPlatform = "reels" | "tiktok" | "both";

export type TrendCandidate = {
  id: string;
  title: string;
  summary: string;
  whyNow: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string;
  score: number;
};

export type ShortVideoBeat = {
  startSecond: number;
  endSecond: number;
  purpose: "hook" | "context" | "proof" | "payoff" | "cta";
  voiceover: string;
  onScreenText: string;
  visualDirection: string;
  editCue: string;
};

export type ShortVideoScript = {
  id: string;
  topic: string;
  angle: string;
  platform: ShortVideoPlatform;
  durationSeconds: number;
  hook: string;
  promise: string;
  beats: ShortVideoBeat[];
  patternInterrupt: string;
  caption: string;
  cta: string;
  hashtags: string[];
  sources: Array<{ title: string; url: string }>;
  verificationNotes: string[];
  retentionScore: number;
  createdAt: string;
  provider: "deepseek" | "local";
  model?: string;
};

export type ShortVideoInput = {
  sourceMode: "topic" | "trend";
  topic: string;
  platform: ShortVideoPlatform;
  durationSeconds: 15 | 30 | 45 | 60;
  audience?: string;
  tone?: "direct" | "curious" | "contrarian" | "story";
  goal?: "teach" | "save" | "discuss" | "act";
  sources?: Array<{ title: string; url: string; snippet?: string }>;
};

type TavilyNewsResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
    score?: number;
  }>;
};

const clean = (value: unknown, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function sourceName(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Fuente"; }
}

/** Consulta noticias recientes. Sin Tavily se rechaza explícitamente: nunca
 *  fabricamos una lista de tendencias usando conocimiento estático del modelo. */
export async function discoverTrends(window: TrendWindow, focus?: string): Promise<TrendCandidate[]> {
  if (!isTavilyConfigured()) throw new ApiError(500, "TAVILY_API_KEY_MISSING");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: focus?.trim() || "tecnología inteligencia artificial diseño software productos digitales noticias relevantes",
      topic: "news",
      time_range: window,
      search_depth: "advanced",
      chunks_per_source: 2,
      max_results: 10,
      include_answer: false,
    }),
  });
  if (!response.ok) throw new ApiError(502, `TAVILY_${response.status}:${(await response.text()).slice(0, 300)}`);
  const payload = await response.json() as TavilyNewsResponse;
  const seen = new Set<string>();
  const trends = (payload.results ?? []).flatMap((item, index) => {
    const url = clean(item.url);
    const title = clean(item.title);
    if (!url || !title) return [];
    const signature = title.toLocaleLowerCase().replace(/[^a-z0-9áéíóúñ]+/giu, " ").trim().slice(0, 64);
    if (seen.has(signature)) return [];
    seen.add(signature);
    const summary = clean(item.content).replace(/\s+/g, " ").slice(0, 260);
    return [{
      id: `trend-${index + 1}-${signature.slice(0, 18).replace(/\s+/g, "-")}`,
      title,
      summary,
      whyNow: window === "day" ? "Publicado o actualizado en las últimas 24 horas." : "Tuvo cobertura durante los últimos 7 días.",
      sourceName: sourceName(url),
      sourceUrl: url,
      publishedAt: clean(item.published_date) || undefined,
      score: clamp(Math.round((item.score ?? .55) * 100), 1, 100),
    } satisfies TrendCandidate];
  });
  if (!trends.length) throw new ApiError(502, "EMPTY_TREND_RESULTS");
  return trends.slice(0, 8);
}

function fallbackScript(input: ShortVideoInput): ShortVideoScript {
  const duration = input.durationSeconds;
  const source = input.sources?.[0];
  const topic = input.topic.trim();
  const hook = `Esto es lo que casi todos pasan por alto sobre ${topic}.`;
  const cuts = duration <= 15 ? [0, 3, 8, 12, 15] : [0, 4, Math.round(duration * .42), Math.round(duration * .76), duration];
  const beats: ShortVideoBeat[] = [
    { startSecond: cuts[0]!, endSecond: cuts[1]!, purpose: "hook", voiceover: hook, onScreenText: "NO ES EL HYPE", visualDirection: "Primer plano; titular entra como recorte editorial.", editCue: "Corte seco en la última palabra." },
    { startSecond: cuts[1]!, endSecond: cuts[2]!, purpose: "context", voiceover: `La idea importante no es repetir el titular: es entender qué cambia y para quién.`, onScreenText: "¿QUÉ CAMBIA?", visualDirection: "Dos columnas: ruido frente a consecuencia concreta.", editCue: "Punch-in suave." },
    { startSecond: cuts[2]!, endSecond: cuts[3]!, purpose: "proof", voiceover: source ? `La fuente principal es ${source.title}. Revisa el dato antes de publicarlo.` : "Aterrízalo con un ejemplo verificable y evita inventar una cifra.", onScreenText: source ? source.title.slice(0, 46) : "1 EJEMPLO REAL", visualDirection: "Captura o cita de la fuente, con URL legible.", editCue: "Mantener la evidencia dos segundos." },
    { startSecond: cuts[3]!, endSecond: cuts[4]!, purpose: "cta", voiceover: "Guárdalo y úsalo como criterio, no como una predicción.", onScreenText: "CRITERIO > PREDICCIÓN", visualDirection: "Cierre tipográfico con una sola frase.", editCue: "Silencio breve antes del cierre." },
  ];
  return {
    id: crypto.randomUUID(), topic, angle: "Explicación útil sin exagerar", platform: input.platform,
    durationSeconds: duration, hook, promise: "Entender la consecuencia práctica del tema en menos de un minuto.", beats,
    patternInterrupt: "Cambiar de primer plano a evidencia visual antes del segundo 5.",
    caption: `${topic}: qué cambia, qué no y qué conviene verificar antes de repetir el titular.`,
    cta: "Guárdalo para revisarlo con calma.", hashtags: ["#tecnologia", "#aprendizaje", "#reelseducativos"],
    sources: (input.sources ?? []).map(({ title, url }) => ({ title, url })),
    verificationNotes: source ? ["Confirma que la fuente siga disponible y que el titular coincida con el contenido."] : ["Añade una fuente antes de presentar datos actuales como hechos."],
    retentionScore: 72, createdAt: new Date().toISOString(), provider: "local",
  };
}

function normalizeScript(value: unknown, input: ShortVideoInput, model?: string): ShortVideoScript {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(502, "INVALID_SHORT_VIDEO_SCRIPT");
  const data = value as Record<string, unknown>;
  const rawBeats = Array.isArray(data.beats) ? data.beats : [];
  const beats = rawBeats.flatMap((item): ShortVideoBeat[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const beat = item as Record<string, unknown>;
    const purpose = clean(beat.purpose) as ShortVideoBeat["purpose"];
    if (!["hook", "context", "proof", "payoff", "cta"].includes(purpose)) return [];
    return [{
      startSecond: clamp(Number(beat.startSecond) || 0, 0, input.durationSeconds),
      endSecond: clamp(Number(beat.endSecond) || input.durationSeconds, 0, input.durationSeconds),
      purpose, voiceover: clean(beat.voiceover), onScreenText: clean(beat.onScreenText).slice(0, 70),
      visualDirection: clean(beat.visualDirection), editCue: clean(beat.editCue),
    }];
  }).sort((a, b) => a.startSecond - b.startSecond).slice(0, 8);
  if (beats.length < 3 || !beats.some((beat) => beat.purpose === "hook")) throw new ApiError(502, "SHORT_VIDEO_SCRIPT_WITHOUT_STRUCTURE");
  return {
    id: crypto.randomUUID(), topic: clean(data.topic, input.topic), angle: clean(data.angle), platform: input.platform,
    durationSeconds: input.durationSeconds, hook: clean(data.hook, beats[0]?.voiceover), promise: clean(data.promise), beats,
    patternInterrupt: clean(data.patternInterrupt), caption: clean(data.caption), cta: clean(data.cta),
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map((item) => clean(item)).filter(Boolean).slice(0, 6) : [],
    sources: (input.sources ?? []).map(({ title, url }) => ({ title, url })),
    verificationNotes: Array.isArray(data.verificationNotes) ? data.verificationNotes.map((item) => clean(item)).filter(Boolean).slice(0, 6) : [],
    retentionScore: clamp(Math.round(Number(data.retentionScore) || 70), 1, 100),
    createdAt: new Date().toISOString(), provider: "deepseek", model,
  };
}

export async function generateShortVideoScript(input: ShortVideoInput): Promise<ShortVideoScript> {
  if (!isDeepSeekConfigured()) return fallbackScript(input);
  const sourceBlock = input.sources?.length
    ? input.sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.url}\n${source.snippet ?? ""}`).join("\n\n")
    : "No hay fuentes externas. No inventes noticias, cifras, fechas ni citas.";
  const example = fallbackScript(input);
  const result = await deepSeekJson<unknown>([
    { role: "system", content: `Eres editor de video corto educativo. Escribe un guion filmable, concreto y verificable; optimiza RETENCIÓN, no clickbait.\n\nREGLAS:\n- Hook oral en los primeros 2 segundos: tensión específica, sin «no vas a creer», «esto cambiará todo» ni promesas absolutas.\n- Una sola tesis. Cada beat añade contexto, prueba o consecuencia; nada de repetir la misma idea.\n- Voz natural en español, frases pronunciables de máximo 16 palabras.\n- Texto en pantalla máximo 7 palabras. Indica visuales que una persona puede grabar o montar.\n- Incluye al menos un beat proof cuando existan fuentes. No conviertas inferencias en hechos.\n- CTA proporcional y sin mendigar engagement.\n- 3 a 6 hashtags relevantes; evita hashtags genéricos de spam.\n- retentionScore es una autoevaluación 1-100 basada en claridad del hook, progresión, evidencia y cierre; no es promesa de viralidad.\n- Los beats deben cubrir de 0 a ${input.durationSeconds} segundos, sin superponerse ni dejar huecos grandes.\n\nDevuelve exclusivamente JSON con la forma de este ejemplo: ${JSON.stringify(example)}` },
    { role: "user", content: `TEMA: ${input.topic}\nORIGEN: ${input.sourceMode}\nPLATAFORMA: ${input.platform}\nDURACIÓN: ${input.durationSeconds}s\nAUDIENCIA: ${input.audience || "personas interesadas en tecnología y producto"}\nTONO: ${input.tone || "direct"}\nOBJETIVO: ${input.goal || "teach"}\n\nFUENTES:\n${sourceBlock}` },
  ], 4_500);
  return normalizeScript(result.data, input, result.model);
}
