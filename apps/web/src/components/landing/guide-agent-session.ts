import type { GuideLanguage } from "@/components/landing/landing-tour-sections";
import { getGuideTtsSpeed } from "@/components/landing/landing-tour-timing";

/** Demo mode: agent narrates continuously, mic silenced, scroll driven by client tools. */
export const GUIDE_DEMO_MODE = process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_DEMO_MODE !== "false";

/**
 * Optional TTS overrides — OFF by default because ElevenLabs rejects them unless
 * enabled under Security → Overrides (causes "Server error: Unknown error").
 * Set NEXT_PUBLIC_ELEVENLABS_GUIDE_ENABLE_TTS_OVERRIDES=true after enabling in dashboard.
 */
export function getGuideSessionOptions() {
  if (!GUIDE_DEMO_MODE || process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_ENABLE_TTS_OVERRIDES !== "true") {
    return {};
  }

  return {
    overrides: {
      tts: {
        speed: getGuideTtsSpeed(),
        stability: 0.55,
      },
    },
  };
}

/** Module-level mutex — one guide session at a time across remounts. */
let guideSessionActive = false;

export function isGuideSessionActive(): boolean {
  return guideSessionActive;
}

export function markGuideSessionActive(): boolean {
  if (guideSessionActive) {
    return false;
  }

  guideSessionActive = true;
  return true;
}

export function markGuideSessionInactive(): void {
  guideSessionActive = false;
}

export function waitForGuideDisconnect(
  getStatus: () => string,
  timeoutMs = 3000,
): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const tick = () => {
      const status = getStatus();
      if (status === "disconnected" || status === "error") {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve();
        return;
      }

      window.setTimeout(tick, 100);
    };

    tick();
  });
}

export function tourKickoffMessage(language: GuideLanguage): string {
  if (GUIDE_DEMO_MODE) {
    return language === "es"
      ? "[MODO DEMO] Recorrido hero→cta. Contrato estricto: no narres una sección hasta que esté visible. Para cada sección: (1) llama scrollToSection, (2) espera el resultado de la tool, (3) narra 1-2 frases cortas SOLO de esa sección, (4) detente; cuando termines de hablar llama scrollToSection de la SIGUIENTE. Nunca mezcles narración y siguiente scroll en el mismo beat. UNA tool a la vez. Parafrasea, no leas la UI."
      : "[DEMO MODE] Tour hero→cta. Strict contract: never narrate a section until it is visible. For each section: (1) call scrollToSection, (2) wait for the tool result, (3) narrate 1-2 short sentences ONLY about that section, (4) stop; after speaking call scrollToSection for the NEXT. Never mix narration and the next scroll in the same beat. ONE tool at a time. Paraphrase.";
  }

  return language === "es"
    ? "Inicia el recorrido guiado sección por sección. Primero usa scrollToSection, espera a que la sección esté visible, narra esa sección con frases cortas y solo después de terminar la voz pasa a la siguiente."
    : "Start the guided tour section by section. First use scrollToSection, wait until the section is visible, narrate that section briefly, and only after the voice finishes move to the next one.";
}

export function formatGuideError(message: string, language: GuideLanguage): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("unknown error") || normalized.includes("server error")) {
    return language === "es"
      ? "No pudimos conectar con el agente. En ElevenLabs verifica: Authentication desactivada, allowlist con http://localhost:3001, y client tools scrollToSection + highlightElement creadas. Si activaste overrides de TTS en el código, habilita Overrides en Security o desactiva NEXT_PUBLIC_ELEVENLABS_GUIDE_ENABLE_TTS_OVERRIDES."
      : "Could not connect to the agent. In ElevenLabs verify: Authentication disabled, allowlist includes http://localhost:3001, and scrollToSection + highlightElement client tools exist.";
  }

  if (normalized.includes("401") || normalized.includes("authentication")) {
    return language === "es"
      ? "El agente requiere autenticación. Desactívala en ElevenLabs → Advanced, o configura signed URL en el servidor."
      : "This agent requires authentication. Disable it in ElevenLabs → Advanced, or configure a signed URL on the server.";
  }

  if (normalized.includes("microphone") || normalized.includes("notallowederror")) {
    return language === "es"
      ? "Necesitamos acceso al micrófono para el tour con voz."
      : "Microphone access is required for the voice tour.";
  }

  return message;
}
