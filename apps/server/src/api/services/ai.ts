import { createOpenAI } from "@ai-sdk/openai";
import { ApiError } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";
import { Output, generateText } from "ai";

import type { FlexibleSchema } from "ai";

/** Helper compartido para generación de texto estructurado vía Vercel AI SDK.
 *  Hoy el proveedor es OpenAI; cambiar de proveedor = cambiar este archivo. */

const LLM_REQUEST_TIMEOUT_MS = 60_000;

export const isLlmConfigured = () => !!env.OPENAI_API_KEY;

let provider: ReturnType<typeof createOpenAI> | undefined;

const getLlmModel = () => {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, "OPENAI_API_KEY is not configured");
  }
  provider ??= createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return provider(env.OPENAI_MODEL);
};

/** Genera un objeto validado contra el schema (structured output estricto:
 *  el schema no debe tener campos `.optional()`). Lanza si el LLM no está
 *  configurado o la generación falla; los callers deciden su fallback. */
export const generateStructuredObject = async <OBJECT>(input: {
  schema: FlexibleSchema<OBJECT>;
  schemaName: string;
  system: string;
  prompt: string;
}): Promise<OBJECT> => {
  const { output } = await generateText({
    model: getLlmModel(),
    output: Output.object({ schema: input.schema, name: input.schemaName }),
    system: input.system,
    prompt: input.prompt,
    abortSignal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS),
  });

  return output;
};
