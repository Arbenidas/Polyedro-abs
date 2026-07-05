export type LandingTourSectionId =
  | "hero"
  | "problem"
  | "how-it-works"
  | "agents"
  | "pipeline"
  | "approval"
  | "automation"
  | "demo"
  | "audience"
  | "guide"
  | "cta";

import {
  clearTourHighlights,
  clearTourSectionActive,
  setTourSectionActive,
} from "./landing-tour-highlights";
import { smoothScrollToElement, waitBeforeSectionScroll } from "./landing-tour-timing";

export type GuideLanguage = "es" | "en";

/** Default voice tour language for Polyedro landing. */
export const DEFAULT_GUIDE_LANGUAGE: GuideLanguage = "es";

export const LANDING_TOUR_SECTIONS: ReadonlyArray<{
  id: LandingTourSectionId;
  labelEn: string;
  labelEs: string;
}> = [
  { id: "hero", labelEn: "Hero", labelEs: "Inicio" },
  { id: "problem", labelEn: "The problem", labelEs: "El problema" },
  { id: "how-it-works", labelEn: "How it works", labelEs: "Cómo funciona" },
  { id: "agents", labelEn: "Eight agents", labelEs: "Ocho agentes" },
  { id: "pipeline", labelEn: "Asset pipeline", labelEs: "Pipeline de assets" },
  { id: "approval", labelEn: "Approval flow", labelEs: "Flujo de aprobación" },
  { id: "automation", labelEn: "Automation", labelEs: "Automatización" },
  { id: "demo", labelEn: "Demo", labelEs: "Demo" },
  { id: "audience", labelEn: "Audience", labelEs: "Audiencia" },
  { id: "guide", labelEn: "Guide agent", labelEs: "Agente guía" },
  { id: "cta", labelEn: "Get started", labelEs: "Empezar" },
] as const;

/** Ordered tour path — keep in sync with ElevenLabs agent prompt + scrollToSection enum. */
export const LANDING_TOUR_ORDER: readonly LandingTourSectionId[] = [
  "hero",
  "problem",
  "how-it-works",
  "agents",
  "pipeline",
  "approval",
  "automation",
  "demo",
  "audience",
  "guide",
  "cta",
] as const;

const LANDING_TOUR_NARRATION: Record<LandingTourSectionId, Record<GuideLanguage, string>> = {
  hero: {
    es: "Polyedro /abs es un laboratorio de marketing con IA. La landing abre con la promesa principal: convertir una marca en un sistema de campañas completo.",
    en: "Polyedro /abs is an AI marketing lab. The landing opens with the core promise: turning a brand into a complete campaign system.",
  },
  problem: {
    es: "Aqui mostramos el problema: las PyMEs usan demasiadas herramientas separadas y pierden consistencia entre estrategia, contenido y ejecucion.",
    en: "Here we show the problem: small teams use too many disconnected tools and lose consistency between strategy, content, and execution.",
  },
  "how-it-works": {
    es: "El flujo es simple: crear un workspace, construir el brand kit y generar una campaña lista para revisar antes de publicar.",
    en: "The flow is simple: create a workspace, build the brand kit, and generate a campaign ready for review before publishing.",
  },
  agents: {
    es: "Esta seccion presenta los agentes especializados. Cada agente cubre una parte del trabajo: marca, estrategia, Meta Ads, creativos, video, voz, automatizacion y aprobacion.",
    en: "This section presents the specialized agents. Each agent owns part of the work: brand, strategy, Meta Ads, creative, video, voice, automation, and approval.",
  },
  pipeline: {
    es: "Aqui se ve el pipeline de produccion. La campana deja de ser una idea suelta y se convierte en assets organizados para ejecutar.",
    en: "Here you see the production pipeline. The campaign stops being a loose idea and becomes organized assets ready to execute.",
  },
  approval: {
    es: "La aprobacion humana mantiene el control. La IA produce rapido, pero el usuario decide que piezas pasan a publicacion.",
    en: "Human approval keeps control in place. AI produces quickly, but the user decides which assets are approved for publishing.",
  },
  automation: {
    es: "La automatizacion conecta el sistema con herramientas como n8n, Supabase, ElevenLabs y Meta Ads para cerrar el flujo operativo.",
    en: "Automation connects the system with tools like n8n, Supabase, ElevenLabs, and Meta Ads to complete the operating flow.",
  },
  demo: {
    es: "La demo usa una marca tech ficticia para mostrar el resultado: brand kit, anuncio, copy, especificaciones y voz listos para campana.",
    en: "The demo uses a fictional tech brand to show the output: brand kit, ad, copy, specs, and voice ready for a campaign.",
  },
  audience: {
    es: "El producto esta pensado para marcas personales y PyMEs que necesitan vender mas sin construir un equipo grande de marketing.",
    en: "The product is built for personal brands and small businesses that need to sell more without building a large marketing team.",
  },
  guide: {
    es: "El agente guia demuestra la experiencia conversacional: explica la plataforma mientras la interfaz se mueve al ritmo de la narracion.",
    en: "The guide agent demonstrates the conversational experience: it explains the platform while the interface moves with the narration.",
  },
  cta: {
    es: "El cierre lleva al usuario a empezar. La propuesta es pasar de marca a campana aprobable desde un solo workspace.",
    en: "The closing section invites the user to start. The promise is moving from brand to approvable campaign in one workspace.",
  },
};

export function guideSectionNarrationPrompt(
  sectionId: LandingTourSectionId,
  language: GuideLanguage,
): string {
  const narration = LANDING_TOUR_NARRATION[sectionId][language];

  return language === "es"
    ? `[SECCION_VISIBLE:${sectionId}] La pagina ya esta posicionada en esta seccion. Narra de forma natural en 1-2 frases esta idea: ${narration} No uses tools en esta respuesta. Cuando termines de hablar, detente.`
    : `[VISIBLE_SECTION:${sectionId}] The page is already positioned on this section. Naturally narrate this idea in 1-2 sentences: ${narration} Do not use tools in this response. After speaking, stop.`;
}

export async function scrollToLandingSectionAsync(
  sectionId: LandingTourSectionId,
  isSpeaking?: () => boolean,
): Promise<string> {
  const target = document.getElementById(sectionId);
  if (!target) {
    return `La sección "${sectionId}" no se encontró en la página.`;
  }

  await waitBeforeSectionScroll(isSpeaking);

  clearTourHighlights();
  setTourSectionActive(sectionId);
  await smoothScrollToElement(target);

  const label = LANDING_TOUR_SECTIONS.find((section) => section.id === sectionId)?.labelEs ?? sectionId;
  return `Sección "${sectionId}" (${label}) visible y estable. Ahora narra SOLO esta sección en 1-2 frases. Cuando termines de hablar, no narres la siguiente todavía: llama scrollToSection con la próxima sección.`;
}

export { clearTourHighlights, clearTourSectionActive } from "./landing-tour-highlights";

export function isLandingTourSectionId(value: string): value is LandingTourSectionId {
  return LANDING_TOUR_SECTIONS.some((section) => section.id === value);
}

export function detectGuideLanguage(): GuideLanguage {
  if (typeof navigator === "undefined") {
    return DEFAULT_GUIDE_LANGUAGE;
  }

  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

export function guideIdlePrompt(language: GuideLanguage, demoMode = true): string {
  if (demoMode) {
    return language === "es"
      ? "Pulsa «Iniciar recorrido» — tour en voz, scroll automático."
      : "Demo mode — press «Start tour» and the agent will narrate the full landing without interruptions, scrolling automatically.";
  }

  return language === "es"
    ? "Pulsa «Iniciar recorrido» y te guío por toda la landing con voz — sección por sección."
    : "Press «Start tour» and I'll voice-guide you through the landing — section by section.";
}

export function guideStartTourLabel(language: GuideLanguage): string {
  return language === "es" ? "Iniciar recorrido →" : "Start tour →";
}

export function guideEndTourLabel(language: GuideLanguage): string {
  return language === "es" ? "Finalizar recorrido" : "End tour";
}

export function guideFirstMessage(language: GuideLanguage): string {
  return language === "es"
    ? "Iniciando tour…"
    : "Starting Polyedro /abs demo tour…";
}
