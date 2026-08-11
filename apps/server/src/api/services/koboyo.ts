import { ApiError } from "@/api/shared";

// ---------------------------------------------------------------------------
// Cliente del MCP server de Koboyo (iconos hand-drawn). Transporte HTTP + SSE:
// cada POST al endpoint devuelve líneas `event: message` / `data: {jsonrpc…}`.
// Docs del MCP: https://koboyo.com — endpoint: https://api.koboyo.com/v1-mcp
// ---------------------------------------------------------------------------

const KOBOYO_MCP_URL = process.env.KOBOYO_MCP_URL ?? "https://api.koboyo.com/v1-mcp";

type MCPRequest = { jsonrpc: "2.0"; id: number; method: string; params?: Record<string, unknown> };
type MCPResponse = {
  result?: { content?: Array<{ type: string; text: string }> };
  error?: { code?: number; message?: string };
  jsonrpc?: string;
  id?: number;
};

let requestId = 1;

/** Una sola llamada al MCP server de Koboyo. El JSON-RPC del transporte MCP
 *  envuelve los tools en method "tools/call" con { name, arguments }. Devuelve
 *  el texto crudo del tool. */
async function koboyoCall(toolName: string, arguments_: Record<string, unknown>): Promise<string> {
  const body: MCPRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/call",
    params: { name: toolName, arguments: arguments_ },
  };

  const response = await fetch(KOBOYO_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(502, `KOBOYO_${response.status}:${await response.text().catch(() => "")}`);
  }

  const raw = await response.text();
  const text = parseSseData(raw);
  if (text.error) {
    throw new ApiError(502, `KOBOYO_MCP_${text.error.code ?? 0}:${text.error.message}`);
  }
  const content = text.result?.content;
  const payload = Array.isArray(content) ? content.map((c) => c.text ?? "").join("\n") : "";
  if (!payload.trim()) throw new ApiError(502, "KOBOYO_EMPTY_RESULT");
  return payload;
}

/** Extrae el primer JSON válido de las líneas `data: {…}` del SSE. */
function parseSseData(raw: string): MCPResponse {
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^data:\s*(.+)$/);
    if (!match) continue;
    try {
      return JSON.parse(match[1]!) as MCPResponse;
    } catch {
      // Línea data no-JSON; continuamos buscando.
    }
  }
  throw new ApiError(502, "KOBOYO_INVALID_SSE");
}

export type KoboyoIcon = {
  slug: string;
  name: string;
  category: string;
  width: number;
  height: number;
};

export type KoboyoIconWithSvg = KoboyoIcon & { svg: string };

function parseTable(text: string): KoboyoIcon[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const icons: KoboyoIcon[] = [];
  for (const line of lines) {
    const match = line.match(/^([\w-]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*[x×]\s*(\d+)$/);
    if (match) {
      icons.push({
        slug: match[1]!,
        name: match[2]!.trim(),
        category: match[3]!.trim(),
        width: Number(match[4]),
        height: Number(match[5]),
      });
    }
  }
  return icons;
}

function parseSvg(text: string): { svg: string; name: string; slug: string; width: number; height: number } | null {
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/);
  if (!svgMatch) return null;
  const heading = text.split("\n")[0] ?? "";
  const slugMatch = heading.match(/^##\s+([\w-]+)/);
  // El heading trae las dimensiones del viewBox: "## slug — Name (147x191)".
  const sizeMatch = heading.match(/\((\d+)\s*[x×]\s*(\d+)\)/);
  return {
    svg: svgMatch[0],
    name: heading.replace(/^##\s+[\w-]+\s*—\s*/, ""),
    slug: slugMatch?.[1] ?? "",
    width: sizeMatch ? Number(sizeMatch[1]) : 0,
    height: sizeMatch ? Number(sizeMatch[2]) : 0,
  };
}

/** Busca iconos por un concepto. Devuelve los primeros `limit` (ranked). */
export const searchKoboyoIcons = async (query: string, limit = 6): Promise<KoboyoIcon[]> => {
  const payload = await koboyoCall("search_icons", { query, limit });
  return parseTable(payload).slice(0, limit);
};

/** Empareja MUCHOS conceptos a iconos en una sola llamada. Devuelve un mapa
 *  concepto → iconos candidatos (ranked, primero el más genérico). */
export const findKoboyoIconsFor = async (concepts: string[], perConcept = 2): Promise<Record<string, KoboyoIcon[]>> => {
  const unique = [...new Set(concepts.map((item) => item.trim()).filter(Boolean))].slice(0, 20);
  if (!unique.length) return {};
  const payload = await koboyoCall("find_icons_for", { concepts: unique, per_concept: perConcept });
  const result: Record<string, KoboyoIcon[]> = {};
  // El texto agrupa por "## <concept>" seguido de una tabla.
  const sections = payload.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const [header, ...rest] = section.split(/\r?\n/);
    const concept = header?.trim().replace(/[:：].*$/, "").trim();
    if (!concept) continue;
    const icons = parseTable(rest.join("\n"));
    if (icons.length) result[concept] = icons;
  }
  return result;
};

/** Trae el markup SVG inline de hasta 20 slugs. */
export const getKoboyoIconSvg = async (slugs: string[]): Promise<KoboyoIconWithSvg[]> => {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))].slice(0, 20);
  if (!unique.length) return [];
  const payload = await koboyoCall("get_icon_svg", { slugs: unique });
  // El output incluye la cabecera y el SVG para cada slug, separados por \n\n.
  const chunks = payload.split(/\n\n/);
  const result: KoboyoIconWithSvg[] = [];
  for (const chunk of chunks) {
    const parsed = parseSvg(chunk);
    if (parsed) {
      result.push({
        slug: parsed.slug,
        name: parsed.name,
        category: "",
        width: parsed.width,
        height: parsed.height,
        svg: parsed.svg,
      });
    }
  }
  return result;
};

/** Lista categorías del catálogo (nombre, id y conteo por grupo). */
export const listKoboyoCategories = async (): Promise<string> => {
  return koboyoCall("list_categories", {});
};
