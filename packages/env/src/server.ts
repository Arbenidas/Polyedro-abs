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
    CORS_ORIGIN: z.url(),
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
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
