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
        stability: 0.5,
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
      ? "[MODO DEMO] Recorrido hero→cta. Identidad: eres un guia masculino, seguro y directo; nunca uses formas femeninas. Contrato estricto: no narres una seccion hasta que este visible. Para cada seccion: (1) llama scrollToSection, (2) espera el resultado, (3) responde UNICAMENTE con la frase final que vas a decir en voz alta, maximo 28 palabras, (4) termina en punto, sin preguntas, confirmaciones, signos ? o signos ¿; despues llama scrollToSection de la SIGUIENTE. Prohibido escribir razonamiento interno, analisis, conteo de palabras, instrucciones, texto en ingles, markdown, etiquetas emocionales como [excited] o cierres que ordenen al usuario escuchar."
      : "[DEMO MODE] Tour hero→cta. Identity: you are a male guide, confident and direct; never use feminine self-references. Strict contract: never narrate a section until it is visible. For each section: (1) call scrollToSection, (2) wait for the result, (3) output ONLY the final sentence to speak aloud, maximum 28 words, (4) end with a period, no questions, confirmations, or question marks; then call scrollToSection for the NEXT. Never output hidden reasoning, analysis, word counts, instructions, markdown, emotion tags like [excited], or endings that tell the user they only need to listen.";
  }

  return language === "es"
    ? "Inicia el recorrido guiado seccion por seccion como guia masculino. Usa scrollToSection, espera a que la seccion este visible y responde unicamente con una frase clara de maximo 28 palabras antes de avanzar. No hagas preguntas, no uses signos ? ni ¿, no pidas confirmacion, no escribas razonamiento interno y no cierres ordenando al usuario escuchar."
    : "Start the guided tour section by section as a male guide. Use scrollToSection, wait until the section is visible, and output only one clear sentence of maximum 28 words before advancing. Do not ask questions, use question marks, ask for confirmation, output hidden reasoning, or tell the user they only need to listen.";
}

function isBrowserEvent(value: unknown): value is Event {
  return typeof Event !== "undefined" && value instanceof Event;
}

/** Normalize SDK / LiveKit failures that may arrive as Event instead of Error. */
export function normalizeGuideErrorMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value instanceof Error && value.message.trim()) {
    return value.message.trim();
  }

  if (isBrowserEvent(value)) {
    return "Voice connection interrupted";
  }

  if (typeof value === "object" && value !== null && "isTrusted" in value) {
    return "Voice connection interrupted";
  }

  return "Guide session failed";
}

export function formatGuideError(message: string, language: GuideLanguage): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("voice connection interrupted") ||
    normalized.includes("websocket") ||
    normalized.includes("connection state mismatch")
  ) {
    return language === "es"
      ? "La conexión de voz se interrumpió. Pulsa ▶ para reintentar."
      : "Voice connection was interrupted. Press ▶ to retry.";
  }

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

  if (normalized.includes("guide startup timeout")) {
    return language === "es"
      ? "El agente tardó demasiado en conectar. Pulsa ▶ para reintentar."
      : "The guide took too long to connect. Press ▶ to retry.";
  }

  if (normalized.includes("guide response timeout")) {
    return language === "es"
      ? "El agente se quedó esperando una respuesta de voz. Pulsa ▶ para reintentar."
      : "The guide got stuck waiting for a voice response. Press ▶ to retry.";
  }

  return message;
}
