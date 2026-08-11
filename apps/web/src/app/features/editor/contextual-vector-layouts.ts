import type { MotionPreset } from "./editor.models";

export type ContextualVectorTopic = "choice" | "interface" | "flow" | "system" | "data" | "security" | "editorial";
export type ContextualVectorLayoutKey = "window" | "user-signal" | "compare" | "target" | "cards" | "path" | "converge" | "layers" | "orbit" | "shield" | "spotlight";

type Palette = { ink: string; accent: string; primary: string; paper: string; marker?: string };

export type ContextualVectorLayout = {
  key: ContextualVectorLayoutKey;
  topic: ContextualVectorTopic;
  name: string;
  svg: string;
  aspectRatio: number;
  motion: MotionPreset;
  previousUses: number;
};

const ORDERS: Record<ContextualVectorTopic, ContextualVectorLayoutKey[]> = {
  choice: ["compare", "converge", "target", "window", "path"],
  interface: ["window", "user-signal", "compare", "target", "cards"],
  flow: ["path", "cards", "layers", "orbit", "user-signal"],
  system: ["layers", "orbit", "cards", "path", "window"],
  data: ["layers", "path", "orbit", "cards", "compare"],
  security: ["shield", "window", "path", "target", "compare"],
  editorial: ["spotlight", "cards", "orbit", "compare", "path"],
};

// "converge" shares the path builder but keeps its own selection slot.
const CONVERGE_KEY: ContextualVectorLayoutKey = "converge";

const GENERIC_NAMES: Record<ContextualVectorLayoutKey, string> = {
  window: "Interfaz en foco",
  "user-signal": "Señales que guían",
  compare: "Ruido frente a claridad",
  target: "Acción imposible de ignorar",
  cards: "Jerarquía de ideas",
  path: "Recorrido visual",
  converge: "Opciones que convergen",
  layers: "Sistema por capas",
  orbit: "Relaciones alrededor de una idea",
  shield: "Protección visible",
  spotlight: "Idea central en foco",
};

export function detectContextualVectorTopic(context: string): ContextualVectorTopic {
  const source = context.toLocaleLowerCase();
  if (/hick|fitts|opciones|carga mental|botones|objetivos|decisi[oó]n|elecci[oó]n/.test(source)) return "choice";
  if (/interfaz|usuarios?|instrucciones?|autoexplic|explicarse|usabilidad|claridad|experiencia|\bui\b|\bux\b/.test(source)) return "interface";
  if (/https|ssl|seguridad|security|certificado|privacidad|protecci[oó]n/.test(source)) return "security";
  if (/database|base de datos|sql|postgres|supabase|datos|data flow/.test(source)) return "data";
  if (/git|github|repo|branch|origin|remote|api|request|response|endpoint|flujo|proceso|pasos?/.test(source)) return "flow";
  if (/angular|flutter|component|widget|backend|microserv|arquitectura|sistema|typescript|java|spring|quarkus/.test(source)) return "system";
  return "editorial";
}

function titleFor(topic: ContextualVectorTopic, key: ContextualVectorLayoutKey) {
  const topicNames: Partial<Record<ContextualVectorTopic, Partial<Record<ContextualVectorLayoutKey, string>>>> = {
    choice: { compare: "Demasiadas opciones vs. una acción", target: "Objetivo grande y alcanzable", window: "Decisión clara en la interfaz", path: "Opciones que convergen" },
    interface: { window: "Interfaz que se explica sola", "user-signal": "Usuario guiado por señales", compare: "Instrucciones vs. claridad visual", target: "Acción visible al instante", cards: "Jerarquía que orienta" },
    flow: { path: "Flujo con puntos de decisión", cards: "Proceso en tarjetas", layers: "Flujo entre capas", orbit: "Sistema conectado", "user-signal": "Señal que avanza" },
    system: { layers: "Arquitectura por capas", orbit: "Constelación de componentes", cards: "Módulos coordinados", path: "Dependencias en movimiento", window: "Sistema dentro de la interfaz" },
    data: { layers: "Datos por niveles", path: "Ruta de los datos", orbit: "Nodos de información", cards: "Bloques de información", compare: "Entrada y resultado" },
    security: { shield: "Protección en el centro", window: "Interfaz protegida", path: "Ruta segura", target: "Acceso verificado", compare: "Riesgo frente a protección" },
  };
  return topicNames[topic]?.[key] ?? GENERIC_NAMES[key];
}

function wrap(key: ContextualVectorLayoutKey, cycle: number, body: string) {
  const transform = cycle % 2 ? "translate(480 0) scale(-1 1)" : cycle ? `rotate(${Math.min(3, cycle)} 240 150)` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" data-layout="${key}" data-layout-cycle="${cycle}"><g${transform ? ` transform="${transform}"` : ""}>${body}</g></svg>`;
}

function buildSvg(key: ContextualVectorLayoutKey, palette: Palette, cycle: number) {
  const { ink, accent, primary, paper } = palette;
  const marker = palette.marker ?? "#FFD45F";
  if (key === "window") return wrap(key, cycle, `<rect x="38" y="30" width="404" height="240" rx="24" fill="${paper}" stroke="${ink}" stroke-width="9"/><path d="M38 86h404" stroke="${ink}" stroke-width="9"/><circle cx="72" cy="58" r="9" fill="${accent}"/><circle cx="101" cy="58" r="9" fill="${primary}"/><rect x="138" y="47" width="264" height="22" rx="11" fill="${accent}" opacity=".22"/><rect x="76" y="124" width="204" height="24" rx="12" fill="${ink}" opacity=".12"/><rect x="76" y="166" width="118" height="64" rx="18" fill="${primary}" stroke="${ink}" stroke-width="8"/><path d="m107 199 17 17 37-45" fill="none" stroke="${paper}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="m324 130 64 61-31 5 17 32-19 10-17-34-24 21Z" fill="${marker}" stroke="${ink}" stroke-width="8" stroke-linejoin="round"/>`);
  if (key === "user-signal") return wrap(key, cycle, `<circle cx="83" cy="91" r="40" fill="${marker}" stroke="${ink}" stroke-width="9"/><path d="M28 241c7-72 32-105 55-105s49 33 56 105Z" fill="${primary}" stroke="${ink}" stroke-width="9"/><path d="M151 153h92m-26-25 29 25-29 25" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M180 96c19-20 45-20 64 0m-45 27c9-9 18-9 27 0" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><rect x="274" y="44" width="178" height="212" rx="24" fill="${paper}" stroke="${ink}" stroke-width="9"/><rect x="305" y="84" width="116" height="28" rx="14" fill="${accent}"/><rect x="305" y="137" width="116" height="72" rx="18" fill="${primary}"/><path d="M328 161h71m-71 25h48" stroke="${paper}" stroke-width="10" stroke-linecap="round"/>`);
  if (key === "compare") return wrap(key, cycle, `<rect x="24" y="44" width="194" height="212" rx="24" fill="${paper}" stroke="${ink}" stroke-width="9"/><rect x="262" y="44" width="194" height="212" rx="24" fill="${paper}" stroke="${ink}" stroke-width="9"/><g fill="${accent}" opacity=".6">${[0,1,2].flatMap((row) => [0,1,2].map((column) => `<rect x="${48 + column * 52}" y="${76 + row * 50}" width="34" height="32" rx="8"/>`)).join("")}</g><path d="m72 213 98-98m-98 0 98 98" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><rect x="298" y="106" width="122" height="86" rx="22" fill="${primary}" stroke="${ink}" stroke-width="8"/><path d="m326 149 22 22 46-55" fill="none" stroke="${paper}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (key === "target") return wrap(key, cycle, `<circle cx="231" cy="150" r="112" fill="${paper}" stroke="${ink}" stroke-width="9"/><circle cx="231" cy="150" r="78" fill="${accent}" stroke="${ink}" stroke-width="8"/><circle cx="231" cy="150" r="43" fill="${primary}" stroke="${ink}" stroke-width="8"/><circle cx="231" cy="150" r="14" fill="${paper}"/><path d="m321 58 116 108-58 9 30 58-30 16-31-63-45 41Z" fill="${marker}" stroke="${ink}" stroke-width="9" stroke-linejoin="round"/>`);
  if (key === "cards") return wrap(key, cycle, `<g transform="rotate(-8 125 150)"><rect x="34" y="63" width="176" height="190" rx="24" fill="${accent}" stroke="${ink}" stroke-width="9"/><path d="M66 107h109M66 144h76M66 207h105" stroke="${paper}" stroke-width="11" stroke-linecap="round"/></g><g transform="rotate(5 340 150)"><rect x="260" y="45" width="184" height="204" rx="24" fill="${paper}" stroke="${ink}" stroke-width="9"/><circle cx="352" cy="110" r="40" fill="${marker}" stroke="${ink}" stroke-width="8"/><rect x="298" y="171" width="109" height="38" rx="19" fill="${primary}"/></g><path d="M208 150h55m-18-20 23 20-23 20" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (key === "path" || key === CONVERGE_KEY) return wrap(key, cycle, `<path d="M48 224C83 74 160 71 215 151s125 84 214-69" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 22"/><g stroke="${ink}" stroke-width="8"><circle cx="51" cy="222" r="28" fill="${paper}"/><circle cx="142" cy="83" r="34" fill="${marker}"/><circle cx="238" cy="174" r="42" fill="${primary}"/><circle cx="345" cy="181" r="31" fill="${paper}"/><circle cx="430" cy="81" r="44" fill="${accent}"/></g><path d="m414 41 35 36-38 32" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (key === "layers") return wrap(key, cycle, `<path d="m240 30 184 74-184 75L56 104Z" fill="${marker}" stroke="${ink}" stroke-width="9" stroke-linejoin="round"/><path d="m76 151 164 66 164-66" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="m76 205 164 66 164-66" fill="none" stroke="${primary}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><circle cx="240" cy="104" r="35" fill="${paper}" stroke="${ink}" stroke-width="8"/><path d="M222 104h36" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>`);
  if (key === "orbit") return wrap(key, cycle, `<g fill="none" stroke="${accent}" stroke-width="7" stroke-dasharray="3 16"><ellipse cx="240" cy="150" rx="188" ry="82"/><ellipse cx="240" cy="150" rx="88" ry="139" transform="rotate(58 240 150)"/></g><circle cx="240" cy="150" r="62" fill="${primary}" stroke="${ink}" stroke-width="9"/><path d="M207 133h66m-66 30h44" stroke="${paper}" stroke-width="10" stroke-linecap="round"/><g fill="${marker}" stroke="${ink}" stroke-width="7"><circle cx="75" cy="116" r="27"/><circle cx="388" cy="204" r="34"/><circle cx="310" cy="39" r="25"/><circle cx="156" cy="264" r="23"/></g>`);
  if (key === "shield") return wrap(key, cycle, `<path d="M240 30c-78 0-132 41-132 41v88c0 88 132 119 132 119s132-31 132-119V71s-54-41-132-41Z" fill="${primary}" stroke="${ink}" stroke-width="10"/><rect x="181" y="136" width="118" height="84" rx="20" fill="${paper}" stroke="${ink}" stroke-width="9"/><path d="M204 136v-23a36 36 0 0 1 72 0v23" fill="none" stroke="${paper}" stroke-width="14" stroke-linecap="round"/><circle cx="240" cy="174" r="14" fill="${accent}"/><path d="M240 186v18" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>`);
  return wrap("spotlight", cycle, `<path d="M49 150s67-88 191-88 191 88 191 88-67 88-191 88S49 150 49 150Z" fill="${paper}" stroke="${ink}" stroke-width="9"/><circle cx="240" cy="150" r="70" fill="${primary}" stroke="${ink}" stroke-width="9"/><circle cx="240" cy="150" r="24" fill="${marker}"/><path d="M240 25V8M91 64 70 41m319 23 21-23M46 150H18m416 0h28M91 236l-21 23m319-23 21 23" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>`);
}

export function createContextualVectorLayout(context: string, palette: Palette, previousLayoutKeys: string[]): ContextualVectorLayout {
  const topic = detectContextualVectorTopic(context);
  const order = ORDERS[topic];
  const counts = new Map<ContextualVectorLayoutKey, number>(order.map((key) => [key, 0]));
  for (const key of previousLayoutKeys) if (counts.has(key as ContextualVectorLayoutKey)) counts.set(key as ContextualVectorLayoutKey, (counts.get(key as ContextualVectorLayoutKey) ?? 0) + 1);
  const minimum = Math.min(...order.map((key) => counts.get(key) ?? 0));
  const key = order.find((candidate) => (counts.get(candidate) ?? 0) === minimum) ?? order[0];
  const previousUses = counts.get(key) ?? 0;
  return { key, topic, name: titleFor(topic, key), svg: buildSvg(key, palette, previousUses), aspectRatio: 1.6, motion: ["path", "user-signal", CONVERGE_KEY].includes(key) ? "draw" : key === "orbit" ? "orbit" : "float", previousUses };
}
