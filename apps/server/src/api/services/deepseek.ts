import { env } from "@Polyedro-abs/env/server";
import { ApiError } from "@/api/shared";

type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export type DeepSeekJsonResult<T> = {
  data: T;
  model: string;
  usage?: DeepSeekResponse["usage"];
};

export const isDeepSeekConfigured = () => !!env.DEEPSEEK_API_KEY;

function cleanJson(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** Cliente de DeepSeek (OpenAI-compatible) para el server. Sin key configurada
 *  lanza ApiError 500 con DEEPSEEK_API_KEY_MISSING (los callers deciden fallback). */
export async function deepSeekJson<T>(
  messages: DeepSeekMessage[],
  maxTokens = 6_000,
): Promise<DeepSeekJsonResult<T>> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) throw new ApiError(500, "DEEPSEEK_API_KEY_MISSING");

  const model = env.DEEPSEEK_MODEL;
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) throw new ApiError(502, `DEEPSEEK_${response.status}:${await response.text()}`);
  const payload = await response.json() as DeepSeekResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new ApiError(502, "EMPTY_DEEPSEEK_OUTPUT");

  try {
    return { data: JSON.parse(cleanJson(content)) as T, model, usage: payload.usage };
  } catch {
    throw new ApiError(502, "INVALID_DEEPSEEK_JSON");
  }
}
