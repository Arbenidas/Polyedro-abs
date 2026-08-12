import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { SupabaseService } from "../../supabase.service";
import type { EditorialBrand } from "../../editorial.models";
import type { ContentPreferences, EditorialPlan } from "../content/content.models";
import type { VisualGenerationMode, VisualIntent } from "../editor/editor.models";
import type { TopicDraft, TopicInput } from "../topic/topic.models";
import type { ShortVideoScript, ShortVideoScriptRequest, TrendCandidate, TrendWindow } from "../short-video/short-video.models";

export type EditorialPlanRequest = {
  brand: EditorialBrand;
  sourceText: string;
  preferences: ContentPreferences;
  availableAssets: Array<{ id: string; name: string; technology?: string; tags: string[] }>;
  availableTemplates?: Array<{
    id: string;
    name: string;
    role: string;
    style: string;
    density: string;
    contentTypes: string[];
    intent?: string;
    keywords?: string[];
    avoidWhen?: string[];
    assetRequirement?: string;
  }>;
  /** Contexto del TopicDraft aprobado (Fase 2). La IA lo usa para extraer
   *  ideas específicas del texto en vez de headers/markdown genéricos. */
  draft?: {
    title: string;
    category?: string;
    keyTakeaways?: string[];
    sources?: string[];
  };
};

/** Especificación de asset VECTORIAL editable devuelta por generate-editorial-asset
 *  (razonamiento DeepSeek). El editor la convierte en capas SVG editables. */
export type VectorAssetSpec = {
  concept: string;
  palette: string[];
  shapes: Array<{
    type: "rect" | "circle" | "ellipse" | "line" | "arrow" | "text";
    x: number; y: number; width: number; height: number;
    fill: string; stroke?: string; strokeWidth: number;
    radius?: number; rotation?: number; label?: string;
  }>;
  stickers: string[];
  motif: string;
  rationale: string;
  provider?: string;
  model?: string;
  style?: string;
};

export type VisualIntentRequest = {
  selectedText?: string;
  slideContext: string;
  palette: string[];
  previousSignatures: string[];
  requestedMode: VisualGenerationMode;
  assetOnly?: boolean;
};

export type VectorAssetRequest = {
  prompt: string;
  palette?: string[];
  style?: string;
  context?: Record<string, unknown>;
};

@Injectable({ providedIn: "root" })
export class GenerationService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Genera el EditorialPlan llamando al Hono server (ruta pública local). Las
   *  API keys de DeepSeek/MiMo viven en el server — el navegador no las ve. */
  async generatePlan(request: EditorialPlanRequest) {
    const response = await fetch(`${environment.serverUrl}/public/editorial/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message ?? `La generación del plan falló (${response.status})`);
    }
    const body = await response.json() as { plan?: EditorialPlan };
    if (!body.plan) throw new Error("La función no devolvió un plan editorial");
    return body.plan;
  }

  /** Fase 1a: investiga (Tavily web search en el server) y redacta un post
   *  largo estructurado (TopicDraft) a partir de una idea corta. */
  async researchTopic(input: TopicInput) {
    return this.publicPost<{ draft: TopicDraft }>("/public/topic/research", { ...input, mode: "research" });
  }

  /** Fase 1b: reorganiza/limpia un texto pegado. Con keepAsIs=true devuelve
   *  el texto del usuario tal cual como draft. */
  async rewriteTopic(input: TopicInput) {
    return this.publicPost<{ draft: TopicDraft }>("/public/topic/rewrite", { ...input, mode: "rewrite" });
  }

  /** Reescribe el copy de una lámina (headline + body) con Smart Brevity. */
  async regenerateSlide(input: {
    slide: { headline: string; body: string; role: string };
    brand?: { name: string; description?: string };
    planContext?: { topic?: string; caption?: string; cta?: string; contentType?: string };
    goal?: string;
    audience?: string;
  }) {
    return this.publicPost<{ slide: { headline: string; body: string } }>("/public/slide/regenerate", input);
  }

  /** Genera el copy de redes sociales (Instagram/LinkedIn): caption corto o
   *  post largo completo, anclado al contexto real del proyecto. */
  async generateCopy(input: {
    mode: "short" | "long";
    topic: string;
    contentType?: string;
    goal?: string;
    audience?: string;
    caption?: string;
    hook?: string;
    channel?: string;
    slides?: Array<{ role?: string; headline: string; body?: string }>;
    brand?: { name: string; description?: string };
  }) {
    return this.publicPost<{ copy: { copy: string; hashtags: string[]; mode: "short" | "long" } }>("/public/copy/generate", input);
  }

  /** Descubre temas con fuentes publicadas en la ventana solicitada. El
   *  servidor falla explícitamente si Tavily no está configurado. */
  async discoverShortVideoTrends(window: TrendWindow, focus?: string) {
    return this.publicPost<{ trends: TrendCandidate[]; window: TrendWindow; researchedAt: string }>("/public/short-video/trends", { window, focus });
  }

  /** Genera un guion filmable por segundos. «retentionScore» es una rúbrica
   *  editorial, nunca una garantía de viralidad. */
  async generateShortVideoScript(input: ShortVideoScriptRequest) {
    return this.publicPost<{ script: ShortVideoScript }>("/public/short-video/script", input);
  }

  async inspectRepository(url: string) {
    const { data, error } = await this.supabase.client.functions.invoke("inspect-repository", { body: { url } });
    if (error) throw error;
    if (!data) throw new Error("La función no devolvió metadatos");
    return data;
  }

  async generateVisualIntent(request: VisualIntentRequest) {
    const { data, error } = await this.supabase.client.functions.invoke<VisualIntent>("generate-contextual-visual-spec", { body: request });
    if (error) throw await this.functionError(error);
    if (!data) throw new Error("La función no devolvió una intención visual");
    return data;
  }

  /** Analiza una imagen de REFERENCIA con MiMo 2.5 (visión) y devuelve una
   *  especificación editable siguiendo el borrador/tema en desarrollo. La
   *  imagen solo es referencia: el output es un VisualIntent que el editor
   *  convierte en capas SVG editables. */
  async analyzeReferenceImage(input: {
    imageBase64: string;
    draftContext: string;
    theme?: string;
    palette?: string[];
    autoDemo?: boolean;
  }) {
    const { data, error } = await this.supabase.client.functions.invoke<VisualIntent & { palette?: string[]; styleSummary?: string }>("analyze-reference-image", { body: input });
    if (error) throw await this.functionError(error);
    if (!data) throw new Error("La función no devolvió una especificación de referencia");
    return data;
  }

  /** Razona (DeepSeek) y devuelve la especificación de un asset VECTORIAL
   *  editable (formas SVG + stickers + paleta). No genera imágenes raster. */
  async generateAssetSpec(request: VectorAssetRequest | string) {
    const body: VectorAssetRequest = typeof request === "string" ? { prompt: request } : request;
    const { data, error } = await this.supabase.client.functions.invoke<VectorAssetSpec>("generate-editorial-asset", { body });
    if (error) throw await this.functionError(error);
    if (!data) throw new Error("La función no devolvió una especificación de asset");
    return data;
  }

  // ---------------------------------------------------------------------------
  // Koboyo icons (hand-drawn) — resuelven iconos contextuales para las slides.
  // Las llamadas pasan por el Hono server (ruta pública local); el browser no
  // toca el MCP directamente.
  // ---------------------------------------------------------------------------

  /** Empareja varios conceptos a iconos Koboyo en una llamada. */
  async findKoboyoIcons(concepts: string[], perConcept = 2) {
    return this.publicPost<{ icons: Record<string, KoboyoIcon[]> }>("/public/koboyo/find", { concepts, perConcept });
  }

  /** Devuelve el markup SVG inline de los slugs pedidos. */
  async getKoboyoIconsSvg(slugs: string[]) {
    return this.publicPost<{ icons: KoboyoIconWithSvg[] }>("/public/koboyo/svg", { slugs });
  }

  /** Búsqueda simple de iconos por concepto. */
  async searchKoboyoIcons(query: string, limit = 6) {
    return this.publicPost<{ icons: KoboyoIcon[] }>("/public/koboyo/search", { query, limit });
  }

  private async publicPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${environment.serverUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message ?? `La llamada falló (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private async functionError(error: unknown) {
    const context = (error as { context?: Response })?.context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) return new Error(payload.error);
      } catch {
        // Fall through to the SDK error when the response is not JSON.
      }
    }
    return error instanceof Error ? error : new Error("La función remota falló");
  }
}

export type KoboyoIcon = {
  slug: string;
  name: string;
  category: string;
  width: number;
  height: number;
};

export type KoboyoIconWithSvg = KoboyoIcon & { svg: string };
