import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    DIRECT_URL: z.url().optional(),
    SUPABASE_URL: z.url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    /** Fal.ai API key para el Creative Agent; sin ella se generan placeholders. */
    FAL_KEY: z.string().min(1).optional(),
    /** Endpoint de modelo en Fal.ai usado para creativos (texto → imagen). */
    FAL_IMAGE_MODEL: z.string().min(1).default("fal-ai/flux-2"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
