// Helper compartido para MiMo (API compatible con OpenAI) vía edge functions.
// MiMo 2.5 acepta imágenes en el input (visión) y devuelve texto estructurado —
// es la pieza que analiza imágenes de referencia y devuelve especificaciones
// editables. Config:
//   MIMO_API_KEY=...        (obligatoria)
//   MIMO_BASE_URL=https://api.xiaomimimo.com/v1   (opcional)
//   MIMO_VISION_MODEL=mimo-v2.5                   (opcional; el .5 acepta imagen)
//   MIMO_TEXT_MODEL=mimo-v2.5-pro                 (opcional; texto puro)

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

function cleanJson(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** Normaliza una imagen a data URL (ya sea data URL, base64 desnudo, o URL
 *  http(s)). Devuelve undefined si no puede interpretarla. */
export function toDataUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const source = value.trim();
  if (source.startsWith("data:")) return source;
  if (/^https?:\/\//i.test(source)) return source;
  if (/^[A-Za-z0-9+/=]{40,}$/.test(source)) return `data:image/png;base64,${source}`;
  return undefined;
}

/** Llamada a chat/completions de MiMo (OpenAI-compatible). Devuelve el JSON
 *  parseado del contenido del mensaje del asistente. */
export async function mimoJson<T>(
  messages: MimoMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<MimoJsonResult<T>> {
  const key = Deno.env.get("MIMO_API_KEY");
  if (!key) throw new Error("MIMO_API_KEY_MISSING");

  const baseUrl = (Deno.env.get("MIMO_BASE_URL") ?? "https://api.xiaomimimo.com/v1").replace(/\/+$/, "");
  const hasImage = messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url"));
  const model = options.model ?? Deno.env.get(hasImage ? "MIMO_VISION_MODEL" : "MIMO_TEXT_MODEL") ?? (hasImage ? "mimo-v2.5" : "mimo-v2.5-pro");

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
    throw new Error(`MIMO_${response.status}:${detail.slice(0, 400)}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: MimoJsonResult<T>["usage"];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("EMPTY_MIMO_OUTPUT");

  try {
    return { data: JSON.parse(cleanJson(content)) as T, model, usage: payload.usage };
  } catch {
    throw new Error("INVALID_MIMO_JSON");
  }
}
