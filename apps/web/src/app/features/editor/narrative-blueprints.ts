// Arcos narrativos: capa por encima del contentType que estructura la SECUENCIA
// de slides y la intención de cada una. El arco se elige a partir del
// contentType (mapa determinista) y se "estira" al número de slides pedido.
//
// Objetivo: que el storytelling deje de ser genérico/estático. Dos carruseles
// sobre el mismo tema pero con arcos distintos (how-to vs myth-bust) tendrán
// estructuras y recipes distintos, no solo distinto copy.
//
// Fuente de verdad complementaria a recipe-catalog.ts:
//   - recipe-catalog: QUÉ receta de layout usar por slide.
//   - narrative-blueprints: EN QUÉ ORDEN y con QUÉ INTENCIÓN aparecen las slides.

import type { ContentGoal } from "../content/content.models";
import {
  type EditorialContentType,
  type EditorialRecipeId,
  type EditorialRole,
  pickRecipeForRole,
} from "./recipe-catalog";

export type NarrativeArc =
  | "how-to"
  | "listicle"
  | "case-study"
  | "myth-bust"
  | "comparison"
  | "release-log";

export type NarrativeBlueprint = {
  id: NarrativeArc;
  /** contentTypes que disparan este arco (resolución determinista). */
  contentTypes: EditorialContentType[];
  /** Descripción corta para mostrar al LLM/usuaria. */
  description: string;
  /** Secuencia base de roles; se expande a `count` slides manteniendo
   *  cover al inicio y cta al final. Los roles intermedios se reparten. */
  sequence: EditorialRole[];
  /** Override de recipe por rol para este arco (opcional). Si no hay override,
   *  pickRecipeForRole decide con el contentType. */
  recipeOverrides?: Partial<Record<EditorialRole, EditorialRecipeId>>;
  /** Cierre según goal; el arco puede modularlo. */
  closingRule: (goal: ContentGoal) => { cta: string; captionSuffix: string };
};

const DEFAULT_CLOSING: Record<ContentGoal, { cta: string; captionSuffix: string }> = {
  teach: { cta: "Ponlo a prueba en tu próximo proyecto.", captionSuffix: "¿Qué parte aplicarías primero?" },
  save: { cta: "Guárdalo como checklist.", captionSuffix: "Guárdalo para cuando lo necesites." },
  discuss: { cta: "¿Qué cambiarías tú?", captionSuffix: "Cuéntame tu postura en los comentarios." },
  act: { cta: "Da el primer paso hoy.", captionSuffix: "Elige un paso y hazlo esta semana." },
};

const closing = (base: Partial<Record<ContentGoal, { cta: string; captionSuffix: string }>>) =>
  (goal: ContentGoal) => ({ ...DEFAULT_CLOSING[goal], ...base[goal] });

export const NARRATIVE_BLUEPRINTS: NarrativeBlueprint[] = [
  {
    id: "how-to",
    contentTypes: ["tutorial"],
    description: "Guía paso a paso: promesa → por qué importa → pasos numerados → trampa común → aplicación.",
    sequence: ["cover", "intro", "step", "step", "step", "summary", "cta"],
    recipeOverrides: { cover: "editorial-hero", step: "editorial-step", summary: "checklist" },
    closingRule: closing({ act: { cta: "Haz el paso 1 hoy.", captionSuffix: "Elige el primer paso y ejecútalo." } }),
  },
  {
    id: "listicle",
    contentTypes: ["list", "resource"],
    description: "Lista numerada de items discretos: cada slide es un item accionable, con cierre tipo checklist.",
    sequence: ["cover", "step", "step", "step", "step", "summary", "cta"],
    recipeOverrides: { cover: "editorial-hero", step: "editorial-list", summary: "checklist" },
    closingRule: closing({ save: { cta: "Guárdalo como checklist.", captionSuffix: "Checklist lista para guardar." } }),
  },
  {
    id: "case-study",
    contentTypes: ["case-study"],
    description: "Narrativa de caso real: contexto → problema → decisión → acción → resultado medible → lección.",
    sequence: ["cover", "intro", "step", "comparison", "step", "summary", "cta"],
    recipeOverrides: { cover: "bold-headline", intro: "demo-frame", step: "bold-stat", summary: "editorial-quote" },
    closingRule: closing({ discuss: { cta: "¿Habrías decidido igual?", captionSuffix: "¿Qué hubieras hecho distinto?" } }),
  },
  {
    id: "myth-bust",
    contentTypes: ["opinion"],
    description: "Desmonta una creencia: hook polémico → el mito → la evidencia → el matiz → la postura honesta.",
    sequence: ["cover", "comparison", "step", "step", "summary", "cta"],
    recipeOverrides: { cover: "bold-headline", comparison: "bold-contrast", summary: "editorial-quote" },
    closingRule: closing({ discuss: { cta: "¿Estás de acuerdo?", captionSuffix: "¿Cuál es tu postura?" } }),
  },
  {
    id: "comparison",
    contentTypes: ["comparison"],
    description: "Comparativa de opciones: contexto → criterios → versus por criterio → veredicto matizado.",
    sequence: ["cover", "intro", "comparison", "comparison", "summary", "cta"],
    recipeOverrides: { cover: "editorial-hero", comparison: "bold-contrast", summary: "minimal-text" },
    closingRule: closing({ teach: { cta: "Elige según tu contexto.", captionSuffix: "No hay ganador universal; depende de tu caso." } }),
  },
  {
    id: "release-log",
    contentTypes: ["release", "repo"],
    description: "Anuncio de release: qué es → qué cambia → highlights → cómo migrar/pruebas → disponibilidad.",
    sequence: ["cover", "intro", "step", "step", "summary", "cta"],
    recipeOverrides: { cover: "bold-headline", intro: "demo-frame", step: "code-block", summary: "editorial-quote" },
    closingRule: closing({ act: { cta: "Actualiza y prueba hoy.", captionSuffix: "Pruébalo en staging antes de producción." } }),
  },
];

const BLUEPRINT_BY_ID = new Map<NarrativeArc, NarrativeBlueprint>(
  NARRATIVE_BLUEPRINTS.map((item) => [item.id, item]),
);

const BLUEPRINT_BY_CONTENT_TYPE = new Map<EditorialContentType, NarrativeBlueprint>();
for (const blueprint of NARRATIVE_BLUEPRINTS) {
  for (const type of blueprint.contentTypes) BLUEPRINT_BY_CONTENT_TYPE.set(type, blueprint);
}

export const isNarrativeArc = (value: string): value is NarrativeArc =>
  BLUEPRINT_BY_ID.has(value as NarrativeArc);

/** Resuelve el arco para un contentType (determinista). El fallback es how-to
 *  porque cubre la mayoría de contenido educativo sin imponer comparativa. */
export const resolveBlueprint = (contentType: EditorialContentType): NarrativeBlueprint =>
  BLUEPRINT_BY_CONTENT_TYPE.get(contentType) ?? BLUEPRINT_BY_ID.get("how-to")!;

export const blueprintById = (id: NarrativeArc): NarrativeBlueprint | undefined =>
  BLUEPRINT_BY_ID.get(id);

/** Resuelve un arco desde un valor remoto (string del LLM), cayendo al arco
 *  asociado al contentType si el valor no es válido. Nunca lanza. */
export const resolveArcSafely = (
  remote: unknown,
  contentType: EditorialContentType,
): NarrativeBlueprint => {
  if (typeof remote === "string" && isNarrativeArc(remote)) {
    return BLUEPRINT_BY_ID.get(remote) ?? resolveBlueprint(contentType);
  }
  return resolveBlueprint(contentType);
};

/** Expande la secuencia base del arco a exactamente `count` slides, preservando
 *  cover al inicio y cta al final, y repartiendo los roles intermedios.
 *  count=1 → [summary]; count=2 → [cover, cta]; count>=3 → cover + medios + cta. */
export const expandSequence = (blueprint: NarrativeBlueprint, count: number): EditorialRole[] => {
  if (count <= 1) return ["summary"];
  if (count === 2) return ["cover", "cta"];
  const middleRoles = blueprint.sequence.filter((role) => role !== "cover" && role !== "cta");
  const middleCount = count - 2;
  const middle: EditorialRole[] = [];
  for (let index = 0; index < middleCount; index++) {
    middle.push(middleRoles[index % middleRoles.length] ?? "step");
  }
  return ["cover", ...middle, "cta"];
};

/** Elige el recipe canónico para una slide del arco, respetando overrides y
 *  evitando repetir el anterior. Caída sana a pickRecipeForRole. */
export const pickRecipeForArc = (
  blueprint: NarrativeBlueprint,
  role: EditorialRole,
  contentType: EditorialContentType,
  exclude?: string,
): EditorialRecipeId => {
  const override = blueprint.recipeOverrides?.[role];
  if (override && override !== exclude) return override;
  return pickRecipeForRole(role, contentType, exclude);
};

/** Intención editorial de cada slide dentro del arco (para guiar al LLM y al
 *  planner local a no repetir el mismo tipo de idea en slides consecutivas). */
export const slideIntention = (
  blueprint: NarrativeBlueprint,
  index: number,
  total: number,
): string => {
  const sequence = expandSequence(blueprint, total);
  const role = sequence[index] ?? "step";
  const base: Record<EditorialRole, string> = {
    cover: "Hook + promesa concreta. Solo una idea; sin spoilers del desarrollo.",
    intro: "Por qué importa y para quién. Contexto mínimo, sin definir lo obvio.",
    step: "Una idea nueva y accionable. Si es un paso, que se pueda ejecutar hoy.",
    comparison: "Contraste explícito (antes/después, opción A vs B). Sin empate vago.",
    summary: "Takeaway sintético o métrica. La idea que se lleva el lector.",
    cta: "Cierre accionable alineado al goal. Una sola acción, no tres.",
  };
  return base[role];
};
