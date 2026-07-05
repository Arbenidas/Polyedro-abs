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
    es: "Polyedro /abs convierte una marca en un sistema de campanas listo para operar: estrategia, piezas creativas, voz y aprobacion desde un solo workspace.",
    en: "Polyedro /abs turns a brand into an operating campaign system: strategy, creative assets, voice, and approval from one workspace.",
  },
  problem: {
    es: "El dolor es claro: demasiadas herramientas desconectadas hacen que estrategia, contenido y ejecucion avancen lento y pierdan consistencia.",
    en: "The pain is clear: disconnected tools make strategy, content, and execution slower and less consistent.",
  },
  "how-it-works": {
    es: "El flujo reduce la friccion: creas el workspace, defines la marca y los agentes preparan una campana que el usuario revisa antes de publicar.",
    en: "The flow removes friction: create the workspace, define the brand, and agents prepare a campaign the user reviews before publishing.",
  },
  agents: {
    es: "Aqui el usuario entiende el equipo: cada agente toma una tarea concreta, desde marca y anuncios hasta video, voz, automatizacion y aprobacion.",
    en: "Here the user sees the team: each agent owns a clear job, from brand and ads to video, voice, automation, and approval.",
  },
  pipeline: {
    es: "El pipeline muestra el avance operativo: la idea se transforma en assets concretos, ordenados por estado y listos para decision.",
    en: "The pipeline shows operational progress: the idea becomes concrete assets, organized by status and ready for a decision.",
  },
  approval: {
    es: "La aprobacion mantiene control humano: la IA acelera la produccion, pero el usuario decide que piezas pasan a publicacion.",
    en: "Approval keeps human control: AI speeds up production, but the user decides which assets move to publishing.",
  },
  automation: {
    es: "La automatizacion conecta el workspace con n8n, Supabase, ElevenLabs y Meta Ads para que el flujo no termine en archivos sueltos.",
    en: "Automation connects the workspace with n8n, Supabase, ElevenLabs, and Meta Ads so the flow does not end in scattered files.",
  },
  demo: {
    es: "La demo aterriza la promesa: una marca ficticia recibe brand kit, anuncio, copy, especificaciones y voz listos para evaluar.",
    en: "The demo makes the promise concrete: a fictional brand gets a brand kit, ad, copy, specs, and voice ready to evaluate.",
  },
  audience: {
    es: "El publico objetivo son marcas personales y PyMEs que necesitan vender mejor sin contratar un equipo completo de marketing.",
    en: "The target users are personal brands and small businesses that need better selling without hiring a full marketing team.",
  },
  guide: {
    es: "Este agente guia prueba la experiencia conversacional: explica lo importante mientras la interfaz se mueve con la narracion.",
    en: "This guide agent proves the conversational experience: it explains what matters while the interface moves with the narration.",
  },
  cta: {
    es: "El cierre empuja a la accion: empezar con un workspace y pasar de marca a campana aprobable sin saltar entre herramientas.",
    en: "The close pushes action: start with one workspace and move from brand to approvable campaign without jumping between tools.",
  },
};

const FORBIDDEN_NARRATION_PATTERNS = [
  /[¿?]/,
  /\bseguimos\b/i,
  /\bquieres continuar\b/i,
  /\bsolo escucha\b/i,
  /\blisten only\b/i,
  /\bshall we continue\b/i,
] as const;

export function validateGuideNarrationText(message: string): string[] {
  const issues: string[] = [];
  const words = message.trim().split(/\s+/).filter(Boolean);

  if (words.length > 28) {
    issues.push(`too many words (${words.length}/28)`);
  }

  for (const pattern of FORBIDDEN_NARRATION_PATTERNS) {
    if (pattern.test(message)) {
      issues.push(`forbidden pattern: ${pattern.source}`);
    }
  }

  if (/\n/.test(message)) {
    issues.push("contains line breaks");
  }

  return issues;
}

export function getGuideSectionNarration(
  sectionId: LandingTourSectionId,
  language: GuideLanguage,
): string {
  const narration = LANDING_TOUR_NARRATION[sectionId][language];
  const issues = validateGuideNarrationText(narration);

  if (issues.length > 0) {
    console.warn(`[Guide Agent] Invalid narration for ${sectionId}: ${issues.join(", ")}`);
  }

  return narration;
}

export function guideSectionNarrationPrompt(
  sectionId: LandingTourSectionId,
  language: GuideLanguage,
): string {
  const narration = getGuideSectionNarration(sectionId, language);

  return language === "es"
    ? `[SECCION_VISIBLE:${sectionId}] La pagina ya esta posicionada. SALIDA OBLIGATORIA: di exactamente esta frase una sola vez, sin agregar, resumir, reformular ni repetir: "${narration}" Eres un guia masculino. Prohibido: repetir la frase dos veces, hacer preguntas, usar signos ? o ¿, usar tools, pedir permiso, decir "seguimos", "quieres continuar" o cierres que ordenen escuchar, escribir analisis, razonamiento interno, conteo de palabras, markdown, etiquetas emocionales como [excited] o texto en ingles. Termina en punto y detente.`
    : `[VISIBLE_SECTION:${sectionId}] The page is already positioned. REQUIRED OUTPUT: say exactly this sentence once, without adding, summarizing, rewriting, or repeating it: "${narration}" You are a male guide. Forbidden: repeating the sentence twice, asking questions, using question marks, using tools, asking permission, saying "shall we continue", using endings that tell the user they only need to listen, outputting analysis, hidden reasoning, word counts, markdown, emotion tags like [excited], or Spanish instruction text. End with a period, then stop.`;
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
  return `Sección "${sectionId}" (${label}) visible y estable. Ahora responde UNICAMENTE con la frase final de narracion, maximo 28 palabras, como guia masculino. No escribas razonamiento, instrucciones, etiquetas emocionales, texto en ingles ni cierres que ordenen escuchar. No repitas la frase, no hagas preguntas, no uses signos ? ni ¿, y no cierres con invitaciones a continuar. Cuando termines, llama scrollToSection con la proxima seccion.`;
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
