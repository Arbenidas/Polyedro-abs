import { env } from "@Polyedro-abs/env/server";
import { ApiError } from "@/api/shared";

export type MimoMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type MimoMessage = {
  role: "system" | "user";
  content: MimoMessageContent;
};

export type MimoJsonResult<T> = {
  data: T;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export const isMimoConfigured = () => !!env.MIMO_API_KEY;

function cleanJson(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** Normaliza una imagen a data URL (data URL, base64 desnudo, o URL http(s)). */
export function toDataUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const source = value.trim();
  if (source.startsWith("data:")) return source;
  if (/^https?:\/\//i.test(source)) return source;
  if (/^[A-Za-z0-9+/=]{40,}$/.test(source)) return `data:image/png;base64,${source}`;
  return undefined;
}

/** Cliente de MiMo (OpenAI-compatible, soporta visión) para el server. */
export async function mimoJson<T>(
  messages: MimoMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<MimoJsonResult<T>> {
  const key = env.MIMO_API_KEY;
  if (!key) throw new ApiError(500, "MIMO_API_KEY_MISSING");

  const baseUrl = env.MIMO_BASE_URL.replace(/\/+$/, "");
  const hasImage = messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url"));
  const model = options.model ?? (hasImage ? env.MIMO_VISION_MODEL : env.MIMO_TEXT_MODEL);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4_000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ApiError(502, `MIMO_${response.status}:${detail.slice(0, 400)}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: MimoJsonResult<T>["usage"];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new ApiError(502, "EMPTY_MIMO_OUTPUT");

  try {
    return { data: JSON.parse(cleanJson(content)) as T, model, usage: payload.usage };
  } catch {
    throw new ApiError(502, "INVALID_MIMO_JSON");
  }
}
