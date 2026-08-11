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

function cleanJson(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export async function deepSeekJson<T>(messages: DeepSeekMessage[], maxTokens = 6_000): Promise<DeepSeekJsonResult<T>> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY_MISSING");

  const model = Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash";
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

  if (!response.ok) throw new Error(`DEEPSEEK_${response.status}:${await response.text()}`);
  const payload = await response.json() as DeepSeekResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("EMPTY_DEEPSEEK_OUTPUT");

  try {
    return { data: JSON.parse(cleanJson(content)) as T, model, usage: payload.usage };
  } catch {
    throw new Error("INVALID_DEEPSEEK_JSON");
  }
}
