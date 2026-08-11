import {
  generateDemoCreative,
  generateStylePreview,
} from "@/api/services/demo-creatives";
import { generateEditorialPlan } from "@/api/services/editorial";
import {
  researchTopic,
  rewriteTopic,
} from "@/api/services/topic-research";
import {
  regenerateSlide,
} from "@/api/services/slide-regenerate";
import {
  generateCopy,
} from "@/api/services/copy-generator";
import {
  discoverTrends,
  generateShortVideoScript,
} from "@/api/services/short-video";
import {
  findKoboyoIconsFor,
  getKoboyoIconSvg,
  searchKoboyoIcons,
} from "@/api/services/koboyo";
import {
  OPENAI_TRANSCRIPTION_MODEL,
  TRANSCRIPTION_LANGUAGE,
  transcribeAudioFile,
} from "@/api/services/transcription";
import { ApiError } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

/** Rutas públicas (sin auth) para el voice-demo estático. Se montan fuera de
 *  /api/* para que no pasen por requireAuth. */

const demoCreativeSchema = z.object({
  concept: z.enum(["launch", "leads", "proof"]).default("launch"),
  brandName: z.string().trim().max(200).optional(),
  brief: z.string().trim().max(2000).optional(),
  audience: z.string().trim().max(120).optional(),
  audienceLabel: z.string().trim().max(200).optional(),
  goal: z.string().trim().max(120).optional(),
  goalLabel: z.string().trim().max(200).optional(),
  style: z.string().trim().max(120).optional(),
  styleLabel: z.string().trim().max(200).optional(),
  audienceNotes: z.string().trim().max(2000).optional(),
  socialLink: z.string().trim().max(500).optional(),
  proposalNotes: z.string().trim().max(2000).optional(),
  memory: z.array(z.string().trim().max(500)).max(20).optional(),
});

const stylePreviewSchema = z.object({
  styleKey: z.string().trim().min(1).max(120),
  brandName: z.string().trim().max(200).optional(),
  audience: z.string().trim().max(120).optional(),
  goal: z.string().trim().max(120).optional(),
});

const editorialPlanSchema = z.object({
  brand: z
    .object({
      name: z.string().trim().min(1),
      description: z.string().trim().optional(),
      voice: z
        .object({
          tone: z.string().trim(),
          register: z.enum(["formal", "casual", "mixto"]),
          humorStyle: z.string().trim(),
          bilingualNote: z.string().trim().optional(),
        })
        .optional(),
      pillars: z.array(z.enum(["news", "problem-solved", "ranking", "field-notes"])).max(8).optional(),
      antiPatterns: z.array(z.string().trim().max(200)).max(20).optional(),
      references: z.array(z.string().trim().max(200)).max(20).optional(),
    })
    .default({ name: "arbe.blog" }),
  sourceText: z.string().trim().min(1),
  draft: z
    .object({
      title: z.string().trim().max(200),
      category: z.string().trim().max(40).optional(),
      keyTakeaways: z.array(z.string().trim().max(300)).max(10).optional(),
      sources: z.array(z.string().trim().max(200)).max(10).optional(),
    })
    .optional(),
  preferences: z
    .object({
      channel: z.string().trim().optional(),
      format: z.enum(["auto", "single", "carousel"]).optional(),
      slideCount: z.union([z.literal("auto"), z.number().int().min(1).max(10)]).optional(),
      goal: z.enum(["teach", "save", "discuss", "act"]).optional(),
      audience: z.string().trim().max(120).optional(),
    })
    .optional(),
  availableAssets: z
    .array(z.object({ id: z.string(), name: z.string(), tags: z.array(z.string()).optional() }))
    .max(80)
    .optional(),
  availableTemplates: z
    .array(z.object({
      id: z.string().trim().min(1).max(120),
      name: z.string().trim().min(1).max(120),
      role: z.enum(["cover", "intro", "step", "comparison", "summary", "cta"]),
      style: z.string().trim().max(40),
      density: z.string().trim().max(40),
      contentTypes: z.array(z.string().trim().max(40)).max(10),
      intent: z.string().trim().max(240).optional(),
      keywords: z.array(z.string().trim().max(80)).max(16).optional(),
      avoidWhen: z.array(z.string().trim().max(120)).max(10).optional(),
      assetRequirement: z.string().trim().max(40).optional(),
    }))
    .max(40)
    .optional(),
});

const publicRoutes = new Hono();

publicRoutes.post("/demo/creatives", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = demoCreativeSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid demo creative input", parsed.error.flatten());
  }

  const { concept, ...input } = parsed.data;
  const creative = await generateDemoCreative(input, concept);

  return c.json({ creative });
});

publicRoutes.post("/demo/style-preview", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = stylePreviewSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid style preview input", parsed.error.flatten());
  }

  const { styleKey, ...input } = parsed.data;
  const preview = await generateStylePreview(styleKey, input);

  return c.json({ preview });
});

publicRoutes.post("/demo/transcriptions", async (c) => {
  const formData = await c.req.raw.formData().catch(() => null);
  const audio = formData?.get("audio");
  const text = await transcribeAudioFile(audio);

  return c.json({
    text,
    language: TRANSCRIPTION_LANGUAGE,
    model: OPENAI_TRANSCRIPTION_MODEL,
    provider: "openai",
  });
});

/** Generación del guion editorial (EditorialPlan) usando DeepSeek vía el server.
 *  Ruta pública: la usa el Angular app local (brand preset, sin fila en DB) y
 *  el cliente nunca ve las API keys. Sin DeepSeek configurado devuelve un plan
 *  local de marca (provider="local"). */
publicRoutes.post("/editorial/plan", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = editorialPlanSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid editorial plan input", parsed.error.flatten());
  }

  const plan = await generateEditorialPlan(parsed.data);

  return c.json({ plan });
});

const topicInputSchema = z.object({
  mode: z.enum(["research", "rewrite"]).default("research"),
  topic: z.string().trim().min(1).max(30_000),
  category: z.enum(["news", "problem-solved", "ranking", "field-notes"]).optional(),
  audience: z.string().trim().max(120).optional(),
  keepAsIs: z.boolean().optional(),
});

/** Fase 1 del flujo editorial: investiga (Tavily web search) y redacta un
 *  TopicDraft — post largo estructurado listo para revisión humana. */
publicRoutes.post("/topic/research", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = topicInputSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid topic research input", parsed.error.flatten());
  }

  const draft = await researchTopic({ ...parsed.data, mode: "research" });

  return c.json({ draft });
});

/** Fase 1b: reorganiza/limpia un texto pegado. Si keepAsIs=true devuelve el
 *  texto del usuario tal cual como draft (solo extrae título y takeaways). */
publicRoutes.post("/topic/rewrite", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = topicInputSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid topic rewrite input", parsed.error.flatten());
  }

  const draft = await rewriteTopic({ ...parsed.data, mode: "rewrite" });

  return c.json({ draft });
});

const slideRegenerateSchema = z.object({
  slide: z.object({
    headline: z.string().trim().min(1).max(200),
    body: z.string().trim().max(2000),
    role: z.string().trim().max(40),
  }),
  brand: z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
  }).optional(),
  planContext: z.object({
    topic: z.string().trim().max(200).optional(),
    caption: z.string().trim().max(2000).optional(),
    cta: z.string().trim().max(200).optional(),
    contentType: z.string().trim().max(40).optional(),
  }).optional(),
  goal: z.string().trim().max(40).optional(),
  audience: z.string().trim().max(120).optional(),
});

/** Reescribe el copy (headline + body) de una lámina con Smart Brevity,
 *  manteniendo la idea y el rol. Para el botón "Regenerar contenido" del
 *  editor cuando un slide queda muy escueto o fuera de contexto. */
publicRoutes.post("/slide/regenerate", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = slideRegenerateSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid slide regenerate input", parsed.error.flatten());
  }

  const result = await regenerateSlide(parsed.data);

  return c.json({ slide: result });
});

const copyGenerateSchema = z.object({
  mode: z.enum(["short", "long"]).default("short"),
  topic: z.string().trim().min(1).max(300),
  contentType: z.string().trim().max(40).optional(),
  goal: z.string().trim().max(40).optional(),
  audience: z.string().trim().max(120).optional(),
  caption: z.string().trim().max(4000).optional(),
  hook: z.string().trim().max(300).optional(),
  channel: z.string().trim().max(40).optional(),
  slides: z.array(z.object({
    role: z.string().trim().max(40).optional(),
    headline: z.string().trim().max(300),
    body: z.string().trim().max(1000).optional(),
  })).max(12).optional(),
  brand: z.object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
  }).optional(),
});

/** Genera el copy para publicar en redes (Instagram/LinkedIn): caption corto
 *  o post largo completo, usando el contexto real del proyecto. */
publicRoutes.post("/copy/generate", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = copyGenerateSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid copy generate input", parsed.error.flatten());
  }

  const result = await generateCopy(parsed.data);

  return c.json({ copy: result });
});

const trendDiscoverSchema = z.object({
  window: z.enum(["day", "week"]).default("day"),
  focus: z.string().trim().max(120).optional(),
});

/** Tendencias verificables. Requiere Tavily y conserva la URL de cada fuente;
 *  si la búsqueda no está configurada, responde con error en vez de inventar. */
publicRoutes.post("/short-video/trends", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = trendDiscoverSchema.safeParse(body ?? {});
  if (!parsed.success) throw new ApiError(400, "Invalid trend discovery input", parsed.error.flatten());
  const trends = await discoverTrends(parsed.data.window, parsed.data.focus);
  return c.json({ trends, window: parsed.data.window, researchedAt: new Date().toISOString() });
});

const shortVideoScriptSchema = z.object({
  sourceMode: z.enum(["topic", "trend"]),
  topic: z.string().trim().min(3).max(500),
  platform: z.enum(["reels", "tiktok", "both"]).default("both"),
  durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).default(30),
  audience: z.string().trim().max(160).optional(),
  tone: z.enum(["direct", "curious", "contrarian", "story"]).optional(),
  goal: z.enum(["teach", "save", "discuss", "act"]).optional(),
  sources: z.array(z.object({
    title: z.string().trim().min(1).max(300),
    url: z.url().max(2000),
    snippet: z.string().trim().max(1200).optional(),
  })).max(8).optional(),
});

publicRoutes.post("/short-video/script", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = shortVideoScriptSchema.safeParse(body ?? {});
  if (!parsed.success) throw new ApiError(400, "Invalid short video script input", parsed.error.flatten());
  const script = await generateShortVideoScript(parsed.data);
  return c.json({ script });
});

const koboyoSearchSchema = z.object({
  query: z.string().trim().min(1).max(80),
  limit: z.number().int().min(1).max(100).optional(),
});

const koboyoFindSchema = z.object({
  concepts: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  perConcept: z.number().int().min(1).max(5).optional(),
});

const koboyoSvgSchema = z.object({
  slugs: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
});

/** Búsqueda de iconos hand-drawn de Koboyo por concepto (devuelve slugs). */
publicRoutes.post("/koboyo/search", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = koboyoSearchSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid koboyo search input", parsed.error.flatten());
  }

  const icons = await searchKoboyoIcons(parsed.data.query, parsed.data.limit ?? 6);

  return c.json({ icons });
});

/** Empareja varios conceptos a iconos de Koboyo en una llamada. Ideal para
 *  resolver los iconos contextuales de todas las slides de un carrusel. */
publicRoutes.post("/koboyo/find", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = koboyoFindSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid koboyo find input", parsed.error.flatten());
  }

  const icons = await findKoboyoIconsFor(parsed.data.concepts, parsed.data.perConcept ?? 2);

  return c.json({ icons });
});

/** Devuelve el markup SVG inline de los slugs pedidos. */
publicRoutes.post("/koboyo/svg", async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const parsed = koboyoSvgSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw new ApiError(400, "Invalid koboyo svg input", parsed.error.flatten());
  }

  const icons = await getKoboyoIconSvg(parsed.data.slugs);

  return c.json({ icons });
});

export { publicRoutes };
