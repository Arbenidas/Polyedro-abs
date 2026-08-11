import type { ContentChannel } from "../../editorial.models";
import type { NarrativeArc } from "../editor/narrative-blueprints";
import type { EditorialDiagramProfile } from "../editor/editor.models";
import type { TopicDraft } from "../topic/topic.models";

export type ContentFormat = "auto" | "single" | "carousel";
export type VisualDirection = "auto" | "clean" | "annotated" | "technical" | "image-led";
export type HookAngle = "resultado" | "contraste" | "curiosidad";
export type ContentGoal = "teach" | "save" | "discuss" | "act";

/** Dirección visual de la pieza, elegida por la AI según el contenido (o
 *  inferida por el planner local). Alimenta la selección de recetas/fondos
 *  para que cada publicación tenga un look coherente sin caer en AI slop. */
export type VisualStyle = {
  /** Fondo dominante: claro editorial, oscuro técnico, papel de cuaderno. */
  background: "light" | "dark" | "paper";
  /** Énfasis tipográfico: bold editorial, serif clásico, mono técnico. */
  typeMood: "bold" | "serif" | "mono";
  /** Nivel de decoración visual (stickers/iconos). */
  ornamentation: "minimal" | "playful" | "technical";
};

export type ContentPreferences = {
  channel: ContentChannel;
  format: ContentFormat;
  slideCount: "auto" | number;
  visualDirection: VisualDirection;
  goal?: ContentGoal;
  audience?: string;
};

export type HookCandidate = { id: string; text: string; angle: HookAngle };

export type EditorialSlidePlan = {
  id: string;
  role: "cover" | "intro" | "step" | "comparison" | "summary" | "cta";
  headline: string;
  body: string;
  keyPoint: string;
  /** Evidencia o ejemplo concreto que justifica la lámina. */
  proof?: string;
  /** Puente narrativo hacia la siguiente lámina; no se imprime como relleno. */
  transitionCue?: string;
  recipeId: string;
  assetQueries: string[];
  iconConcept: string;
  diagram?: EditorialDiagramProfile;
};

export type EditorialPlan = {
  topic: string;
  contentType: "tutorial" | "list" | "comparison" | "opinion" | "repo" | "case-study" | "release" | "resource";
  /** Arco narrativo que estructura la secuencia de slides. Opcional para no
   *  romper planes persistidos en IndexedDB creados antes de la Fase 2; el
   *  planner local y la edge function siempre lo emiten a partir de ahora. */
  narrativeArc?: NarrativeArc;
  /** Dirección visual elegida por la AI (o inferida localmente). Opcional para
   *  no romper planes persistidos; el planner y la edge function lo emiten. */
  visualStyle?: VisualStyle;
  recommendedFormat: "single" | "carousel";
  recommendedSlideCount: number;
  hookCandidates: HookCandidate[];
  selectedHookId: string;
  caption: string;
  cta: string;
  entities: string[];
  concepts: string[];
  visualMotifs: string[];
  slides: EditorialSlidePlan[];
};

export type ContentProject = {
  id: string;
  brandId: string;
  sourceText: string;
  preferences: ContentPreferences;
  plan: EditorialPlan;
  slideOrder: string[];
  selectedSlideId: string;
  status: "draft" | "review" | "approved";
  generationMode: "ai" | "local-fallback";
  /** Iconos Koboyo hand-drawn pre-fetchados: slug → SVG inline. */
  koboyoIcons?: Record<string, string>;
  /** Referencia al TopicDraft aprobado (post largo del artículo) si el
   *  proyecto nació del flujo de revisión del tema. */
  topicDraftId?: string;
  /** Snapshot del TopicDraft aprobado para la pantalla de publicación sin
   *  depender de que el draft siga en la librería. */
  topicDraft?: TopicDraft;
  createdAt: string;
  updatedAt: string;
};
