import type { ContentGoal } from "../content/content.models";

/** Categorías editoriales de arbe.blog — espejo de los BrandPillar. */
export type TopicCategory = "news" | "problem-solved" | "ranking" | "field-notes";

/** Fuente consultada durante la investigación web (Tavily). */
export type TopicSource = {
  title: string;
  url: string;
  snippet: string;
};

/** Fase 1 del flujo: el post largo estructurado, listo para revisión humana. */
export type TopicDraft = {
  id: string;
  title: string;
  category: TopicCategory;
  /** Post largo en markdown-lite (## secciones, bullets). */
  body: string;
  sources: TopicSource[];
  keyTakeaways: string[];
  createdAt: string;
  provider?: string;
  model?: string;
};

/** Input del composer: idea corta (research) o texto pegado (rewrite). */
export type TopicInput = {
  mode: "research" | "rewrite";
  topic: string;
  category?: TopicCategory;
  goal: ContentGoal;
  audience?: string;
  /** En rewrite: true si el texto ya está estructurado y no debe reescribirse. */
  keepAsIs?: boolean;
};
