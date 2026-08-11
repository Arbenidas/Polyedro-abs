import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

for (const envPath of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/server/.env"),
]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

export const env = createEnv({
  server: {
    /** Origen(es) permitidos por CORS. Acepta una lista separada por comas
     *  para soportar varios dominios (p. ej. ambos subdominios de Netlify). */
    CORS_ORIGIN: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    DIRECT_URL: z.url().optional(),
    SUPABASE_URL: z.url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    /** Provider de generación de imágenes (logo y creativos). "auto" usa el
     *  primero configurado (fal → openai) y cae a placeholder si no hay keys. */
    IMAGE_PROVIDER: z.enum(["auto", "fal", "openai", "placeholder"]).default("auto"),
    /** Calidad para providers que la soportan (gpt-image). "low" para
     *  dev/smoke; subir a "medium"/"high" para la demo. */
    IMAGE_QUALITY: z.enum(["low", "medium", "high", "auto"]).default("low"),
    /** Fal.ai API key; sin ella el provider fal queda no-configurado. */
    FAL_KEY: z.string().min(1).optional(),
    /** Endpoint de modelo en Fal.ai usado para imágenes (texto → imagen). */
    FAL_IMAGE_MODEL: z.string().min(1).default("fal-ai/flux-2"),
    /** Modelo de imágenes de OpenAI (requiere OPENAI_API_KEY y organización
     *  verificada en OpenAI para los modelos gpt-image). */
    OPENAI_IMAGE_MODEL: z.string().min(1).default("gpt-image-2"),
    /** OpenAI API key para el Brand Agent (vía Vercel AI SDK); sin ella el
     *  brand kit usa contenido template. */
    OPENAI_API_KEY: z.string().min(1).optional(),
    /** Modelo de OpenAI usado para generar el contenido del brand kit. */
    OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
    /** DeepSeek API key para el Editorial Agent (guiones editoriales); sin ella
     *  la generación de texto cae al planner local. */
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
    /** Modelo de DeepSeek usado para los guiones editoriales. */
    DEEPSEEK_MODEL: z.string().min(1).default("deepseek-chat"),
    /** MiMo API key (OpenAI-compatible) para visión y texto; sin ella el editor
     *  cae al planner local y a assets de catálogo. */
    MIMO_API_KEY: z.string().min(1).optional(),
    /** Base URL del cliente MiMo (OpenAI-compatible). */
    MIMO_BASE_URL: z.string().min(1).default("https://api.xiaomimimo.com/v1"),
    /** Modelo MiMo para tareas de visión (análisis de imágenes). */
    MIMO_VISION_MODEL: z.string().min(1).default("mimo-v2.5"),
    /** Modelo MiMo para tareas de texto (razonamiento y estructura). */
    MIMO_TEXT_MODEL: z.string().min(1).default("mimo-v2.5-pro"),
    /** URL del MCP de Koboyo para iconos hand-drawn; sin ella la búsqueda de
     *  iconos contextuales queda deshabilitada. */
    KOBOYO_MCP_URL: z.string().min(1).optional(),
    /** Tavily API key para la investigación web de temas (Fase de topic
     *  research). Sin ella el research cae a redacción sin fuentes. */
    TAVILY_API_KEY: z.string().min(1).optional(),
    /** Puerto HTTP del server; lo inyecta la plataforma (Railway/Netlify). */
    PORT: z.coerce.number().int().positive().optional(),
    /** ElevenLabs API key para el Voice Agent (text-to-speech); sin ella los
     *  voiceovers se crean en modo fallback (sin audio real, provider="fallback"). */
    ELEVENLABS_API_KEY: z.string().min(1).optional(),
    /** Voice id de ElevenLabs usado por defecto (premade "Sarah", disponible en
     *  todas las cuentas incluidas las free; el modelo multilingüe habla ES y EN
     *  con la misma voz). Sobreescribible por entorno. */
    ELEVENLABS_VOICE_ID: z.string().min(1).default("EXAVITQu4vr4xnSDxMaL"),
    /** Voice id opcional específico para el voiceover en inglés; si no se define
     *  se usa ELEVENLABS_VOICE_ID para ambos idiomas. */
    ELEVENLABS_VOICE_ID_EN: z.string().min(1).optional(),
    /** Modelo de ElevenLabs; el multilingüe soporta ES y EN en una sola voz. */
    ELEVENLABS_MODEL: z.string().min(1).default("eleven_multilingual_v2"),
    /** Webhook de n8n para el export de campañas a Meta Ads. Trae el default
     *  de producción para que el export real funcione sin config; se puede
     *  sobreescribir por entorno. Si queda vacío, el export cae a simulado. */
    N8N_EXPORT_WEBHOOK_URL: z
      .url()
      .optional()
      .default("https://ferodrigop.app.n8n.cloud/webhook/polyedro/export"),
    /** ID del workflow de export en n8n (solo para trazabilidad en la fila). */
    N8N_EXPORT_WORKFLOW_ID: z.string().min(1).default("jFDaLIM6iW32SykP"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
