/** Valid `data-tour-id` values — keep in sync with landing-sections + ElevenLabs agent prompt. */

import {
  getMaxScrollDurationMs,
  getTourHighlightDwellMs,
  getScrollSettleMs,
  smoothScrollToElement,
  waitBeforeSectionScroll,
} from "./landing-tour-timing";

export const TOUR_HIGHLIGHT_IDS = [
  "hero-wordmark",
  "hero-tagline",
  "hero-headline",
  "hero-description",
  "hero-cta-create",
  "hero-cta-tour",
  "problem-tools",
  "problem-drift",
  "problem-blind",
  "flow-workspace",
  "flow-brandkit",
  "flow-campaign",
  "agent-brand",
  "agent-strategy",
  "agent-meta",
  "agent-creative",
  "agent-video",
  "agent-voice",
  "agent-automation",
  "agent-approval",
  "pipeline-strategy",
  "pipeline-audiences",
  "pipeline-copy",
  "pipeline-creatives",
  "pipeline-video",
  "pipeline-voice",
  "approval-panel",
  "approval-blocked",
  "approval-ok-copy",
  "approval-ok-voice",
  "auto-trigger",
  "auto-supabase",
  "auto-package",
  "auto-meta",
  "auto-notify",
  "demo-brandkit",
  "demo-kit-logo",
  "demo-kit-palette",
  "demo-kit-voice",
  "demo-ad",
  "demo-ad-headline",
  "demo-ad-specs",
  "audience-startups",
  "audience-agencies",
  "audience-latam",
  "guide-intro",
  "guide-capabilities",
  "cta-headline",
  "cta-button",
] as const;

export type TourHighlightId = (typeof TOUR_HIGHLIGHT_IDS)[number];

const TOUR_HIGHLIGHT_CLASS = "tour-highlight";
const TOUR_SECTION_CLASS = "tour-section-active";

let activeHighlightTimer: ReturnType<typeof setTimeout> | null = null;
let activeHighlightEl: HTMLElement | null = null;

export function isTourHighlightId(value: string): value is TourHighlightId {
  return (TOUR_HIGHLIGHT_IDS as readonly string[]).includes(value);
}

export function clearTourHighlights(): void {
  if (activeHighlightTimer) {
    clearTimeout(activeHighlightTimer);
    activeHighlightTimer = null;
  }

  if (activeHighlightEl) {
    activeHighlightEl.classList.remove(TOUR_HIGHLIGHT_CLASS);
    activeHighlightEl = null;
  }

  document.querySelectorAll(`.${TOUR_HIGHLIGHT_CLASS}`).forEach((node) => {
    node.classList.remove(TOUR_HIGHLIGHT_CLASS);
  });
}

export function clearTourSectionActive(): void {
  document.querySelectorAll(`.${TOUR_SECTION_CLASS}`).forEach((node) => {
    node.classList.remove(TOUR_SECTION_CLASS);
  });
}

export function setTourSectionActive(sectionId: string): void {
  clearTourSectionActive();
  document.getElementById(sectionId)?.classList.add(TOUR_SECTION_CLASS);
}

function getHighlightVisualMs(dwellMs: number, durationMs?: number): number {
  const scrollBudget = getMaxScrollDurationMs() + getScrollSettleMs() + 800;
  const floor = dwellMs + scrollBudget + 1200;
  return Math.max(durationMs ?? getTourHighlightDwellMs() + 800, floor);
}

export async function highlightTourTargetAsync(
  targetId: string,
  options: {
    durationMs?: number;
    dwellMs: number;
    isSpeaking?: () => boolean;
  },
): Promise<string> {
  if (!isTourHighlightId(targetId)) {
    return `Target "${targetId}" no es válido. Usa un id exacto del catálogo de highlights del recorrido.`;
  }

  const el = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
  if (!el) {
    return `No se encontró el elemento "${targetId}" en la página.`;
  }

  await waitBeforeSectionScroll(options.isSpeaking);

  const visualMs = getHighlightVisualMs(options.dwellMs, options.durationMs);
  await applyTourHighlight(targetId, visualMs);

  return `Highlight "${targetId}" visible y estable. Ahora explica SOLO este elemento. Cuando termines de hablar, llama la siguiente tool; no adelantes la narración.`;
}

async function applyTourHighlight(targetId: string, durationMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
  if (!el) {
    return;
  }

  clearTourHighlights();

  el.classList.add(TOUR_HIGHLIGHT_CLASS);
  activeHighlightEl = el;

  await smoothScrollToElement(el);

  activeHighlightTimer = setTimeout(() => {
    el.classList.remove(TOUR_HIGHLIGHT_CLASS);
    if (activeHighlightEl === el) {
      activeHighlightEl = null;
    }
    activeHighlightTimer = null;
  }, durationMs);
}
