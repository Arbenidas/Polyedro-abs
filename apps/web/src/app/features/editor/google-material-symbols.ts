/**
 * Curated Google Material Icons paths, embedded so canvas exports do not depend
 * on a webfont or network request. Source: google/material-design-icons.
 * License: Apache-2.0.
 */
export type GoogleMaterialSymbolName =
  | "track_changes" | "search" | "device_hub" | "web_asset" | "trending_up" | "groups"
  | "smart_toy" | "build" | "shield" | "storage" | "person" | "description" | "memory" | "task_alt";

const PATHS: Record<GoogleMaterialSymbolName, string> = {
  track_changes: "M19.07 4.93l-1.41 1.41C19.1 7.79 20 9.79 20 12c0 4.42-3.58 8-8 8s-8-3.58-8-8c0-4.08 3.05-7.44 7-7.93v2.02C8.16 6.57 6 9.03 6 12c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.66-.67-3.16-1.76-4.24l-1.41 1.41C15.55 9.9 16 10.9 16 12c0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86v2.14c-.6.35-1 .98-1 1.72 0 1.1.9 2 2 2s2-.9 2-2c0-.74-.4-1.38-1-1.72V2h-1C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-2.76-1.12-5.26-2.93-7.07z",
  search: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  device_hub: "M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v5h5v-3.05l4-4.2 4 4.2V21h5v-5h-4z",
  web_asset: "M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.89-2-2-2zm0 14H5V8h14v10z",
  trending_up: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z",
  groups: "M4 13c1.1 0 2-.9 2-2S5.1 9 4 9s-2 .9-2 2 .9 2 2 2zm1.13 1.1C4.76 14.04 4.39 14 4 14c-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zm-7.76-2.78c-1.17-.52-2.61-.9-4.24-.9s-3.07.39-4.24.9C6.68 14.13 6 15.21 6 16.39V18h12v-1.61c0-1.18-.68-2.26-1.76-2.74zM8.07 16c.09-.23.13-.39.91-.69.97-.38 1.99-.56 3.02-.56s2.05.18 3.02.56c.77.3.81.46.91.69H8.07zM12 8c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1m0-2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  smart_toy: "M20 9V7h-2V6c0-1.1-.9-2-2-2h-3V2h-2v2H8C6.9 4 6 4.9 6 6v1H4v2h2v6c0 1.1.9 2 2 2h1v2h6v-2h1c1.1 0 2-.9 2-2V9h2zm-5 5H9v-2h6v2zm-5-3c-.83 0-1.5-.67-1.5-1.5S9.17 8 10 8s1.5.67 1.5 1.5S10.83 11 10 11zm4 0c-.83 0-1.5-.67-1.5-1.5S13.17 8 14 8s1.5.67 1.5 1.5S14.83 11 14 11z",
  build: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6.3 6.4 8.9 2.1 4.6C1 7 1.4 10 3.4 12c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l1.8-1.8c.5-.4.5-1.1.1-1.8z",
  shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
  storage: "M4 6c0 1.1 3.58 2 8 2s8-.9 8-2-3.58-2-8-2-8 .9-8 2zm0 4c0 1.1 3.58 2 8 2s8-.9 8-2V8c0 1.1-3.58 2-8 2S4 9.1 4 8v2zm0 4c0 1.1 3.58 2 8 2s8-.9 8-2v-2c0 1.1-3.58 2-8 2s-8-.9-8-2v2zm0 4c0 1.1 3.58 2 8 2s8-.9 8-2v-2c0 1.1-3.58 2-8 2s-8-.9-8-2v2z",
  person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  description: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  memory: "M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z",
  task_alt: "M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM19.79 10.22c.13.57.21 1.16.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.24l1.44-1.44C15.07.66 13.6.23 12 .23 5.5.23.23 5.5.23 12S5.5 23.77 12 23.77 23.77 18.5 23.77 12c0-1.2-.18-2.35-.51-3.44l-1.47 1.66z",
};

const ORDER: GoogleMaterialSymbolName[] = ["track_changes", "search", "device_hub", "web_asset", "trending_up", "groups", "smart_toy", "build", "shield", "storage", "person", "description", "memory", "task_alt"];

export function materialSymbolForConcept(concept: string, index = 0): GoogleMaterialSymbolName {
  const value = concept.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  if (/smart[_ ]?toy|agente|agent|modelo|\bllm\b|robot/.test(value)) return "smart_toy";
  if (/herramienta|tool|build|ejecut|wrench|configur/.test(value)) return "build";
  if (/guardrail|shield|segur|prote|riesgo|permiso|politica|policy/.test(value)) return "shield";
  if (/database|base de datos|storage|almacen|datos/.test(value)) return "storage";
  if (/document|archivo|brief|descripcion|fuente/.test(value)) return "description";
  if (/memoria|memory|contexto persistente|historial/.test(value)) return "memory";
  if (/complet|final|entrega|tarea|task|valid|check/.test(value)) return "task_alt";
  if (/usuario|persona|cliente individual|user/.test(value)) return "person";
  if (/problem|pregunta|investig|busca|descubr|diagnos|reto|desafio/.test(value)) return "search";
  if (/contribu|impact|metric|crec|mejora|resultado|rendimiento/.test(value)) return "trending_up";
  if (/equipo|audiencia|clientes|colabora|\brol\b|responsabilidad/.test(value)) return "groups";
  if (/context|objetiv|meta|target|escenario|alcance/.test(value)) return "track_changes";
  if (/proceso|flujo|metodo|sistema|estructur|pasos|arquitect/.test(value)) return "device_hub";
  if (/soluci|diseno|prototip|interfaz|producto|entrega/.test(value)) return "web_asset";
  return ORDER[Math.abs(index) % ORDER.length];
}

export function googleMaterialSymbolSvg(name: GoogleMaterialSymbolName, color: string) {
  const safeColor = /^#[0-9a-f]{6}$/iu.test(color) ? color : "#315DE8";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${name.replace(/_/g, " ")}"><path fill="${safeColor}" d="${PATHS[name]}"/></svg>`;
}
