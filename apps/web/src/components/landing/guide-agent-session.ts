import type { GuideLanguage } from "@/components/landing/landing-tour-sections";
import { getGuideTtsSpeed } from "@/components/landing/landing-tour-timing";

type GuideSessionAuth =
  | { agentId: string }
  | { signedUrl: string; connectionType: "websocket" };

type GuideSignedUrlResponse = {
  signedUrl?: unknown;
  error?: unknown;
};

/** Demo mode: agent narrates continuously, mic silenced, scroll driven by client tools. */
export const GUIDE_DEMO_MODE = process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_DEMO_MODE !== "false";

/**
 * Optional ElevenLabs overrides — OFF by default because ElevenLabs rejects them
 * unless enabled under Security → Overrides (causes "Server error: Unknown error").
 */
function guideAgentOverridePrompt(language: GuideLanguage): string {
  return language === "es"
    ? "Eres el agente guía masculino de Polyedro Labs. Hablas en español latino, con voz clara, fluida y precisa. El frontend controla el scroll; tú no debes improvisar rutas ni llamar herramientas durante el modo demo. Cuando recibas un mensaje que empiece con [SECCION_VISIBLE:], debes decir exactamente la frase entre comillas después de SALIDA OBLIGATORIA, una sola vez, sin agregar, resumir, reformular ni repetir. Nunca hagas preguntas, nunca pidas confirmación, nunca digas 'seguimos', nunca uses cierres como 'quieres continuar', nunca digas que no escuchas al usuario, y nunca uses etiquetas emocionales como [happy], [excited], [fast] o [slow]. No expliques tus instrucciones ni muestres razonamiento interno. Termina cada intervención en punto y detente."
    : "You are the male Polyedro Labs guide agent. Speak clearly and precisely. The frontend controls scrolling; do not improvise navigation or call tools during demo mode. When you receive a message starting with [VISIBLE_SECTION:], say exactly the quoted REQUIRED OUTPUT sentence once, without adding, summarizing, rewriting, or repeating it. Never ask questions, ask for confirmation, say 'shall we continue', tell the user you cannot hear them, or use emotion tags such as [happy], [excited], [fast], or [slow]. Do not explain your instructions or expose hidden reasoning. End each response with a period, then stop.";
}

function guideAgentFirstMessage(language: GuideLanguage): string {
  return language === "es"
    ? "Hola, soy el agente guía de Polyedro Labs. Te mostraré cada sección con una narración breve, clara y sincronizada."
    : "Hi, I am the Polyedro Labs guide agent. I will show each section with brief, clear, synchronized narration.";
}

export function getGuideSessionOptions(language: GuideLanguage) {
  if (!GUIDE_DEMO_MODE) {
    return {};
  }

  const overrides: {
    agent?: {
      prompt?: { prompt?: string };
      firstMessage?: string;
      language?: GuideLanguage;
    };
    tts?: {
      speed?: number;
      stability?: number;
    };
  } = {};

  if (process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_ENABLE_AGENT_OVERRIDES === "true") {
    overrides.agent = {
      prompt: { prompt: guideAgentOverridePrompt(language) },
      firstMessage: guideAgentFirstMessage(language),
      language,
    };
  }

  if (process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_ENABLE_TTS_OVERRIDES === "true") {
    overrides.tts = {
      speed: getGuideTtsSpeed(),
      stability: 0.5,
    };
  }

  if (!overrides.agent && !overrides.tts) {
    return {};
  }

  return { overrides };
}

export async function getGuideSessionAuth(agentId: string): Promise<GuideSessionAuth> {
  const response = await fetch(
    `/api/elevenlabs/guide-signed-url?agentId=${encodeURIComponent(agentId)}`,
    { cache: "no-store" },
  );

  if (response.status === 501) {
    return { agentId };
  }

  let payload: GuideSignedUrlResponse | null = null;
  try {
    payload = (await response.json()) as GuideSignedUrlResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new Error(`Signed URL request failed (${response.status}): ${detail}`);
  }

  if (typeof payload?.signedUrl !== "string" || payload.signedUrl.length === 0) {
    return { agentId };
  }

  return {
    signedUrl: payload.signedUrl,
    connectionType: "websocket",
  };
}

export function getGuideOverrideEnablementHint(language: GuideLanguage): string {
  if (process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_ENABLE_AGENT_OVERRIDES !== "true") {
    return "";
  }

  return language === "es"
    ? " Si activaste overrides del agente en el código, habilita Overrides en ElevenLabs → Security."
    : " If agent overrides are enabled in code, enable Overrides in ElevenLabs → Security.";
}

/**
 * Kept for reference when enabling only TTS overrides:
 *
 * overrides: {
      tts: {
        speed: getGuideTtsSpeed(),
        stability: 0.5,
      },
 * }
 */

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
      ? "[MODO DEMO] Recorrido hero→cta. Identidad: eres un guía masculino, seguro y directo; nunca uses formas femeninas. Habla en español latino y pronuncia correctamente la letra ñ. Contrato estricto: no narres una sección hasta que esté visible. Para cada sección: (1) llama scrollToSection, (2) espera el resultado, (3) responde ÚNICAMENTE con la frase final que vas a decir en voz alta, máximo 28 palabras, (4) termina en punto, sin preguntas, confirmaciones, signos ? o signos ¿; después llama scrollToSection de la SIGUIENTE. Prohibido escribir razonamiento interno, análisis, conteo de palabras, instrucciones, texto en inglés, markdown, etiquetas emocionales como [excited] o cierres que ordenen al usuario escuchar."
      : "[DEMO MODE] Tour hero→cta. Identity: you are a male guide, confident and direct; never use feminine self-references. Strict contract: never narrate a section until it is visible. For each section: (1) call scrollToSection, (2) wait for the result, (3) output ONLY the final sentence to speak aloud, maximum 28 words, (4) end with a period, no questions, confirmations, or question marks; then call scrollToSection for the NEXT. Never output hidden reasoning, analysis, word counts, instructions, markdown, emotion tags like [excited], or endings that tell the user they only need to listen.";
  }

  return language === "es"
    ? "Inicia el recorrido guiado sección por sección como guía masculino. Habla en español latino y pronuncia correctamente la letra ñ. Usa scrollToSection, espera a que la sección esté visible y responde únicamente con una frase clara de máximo 28 palabras antes de avanzar. No hagas preguntas, no uses signos ? ni ¿, no pidas confirmación, no escribas razonamiento interno y no cierres ordenando al usuario escuchar."
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

  if (normalized.includes("convai_write") || normalized.includes("missing_permissions")) {
    return language === "es"
      ? "La API key de ElevenLabs no tiene el permiso convai_write. Crea o actualiza una key con permisos de Conversational AI y reinicia apps/web."
      : "The ElevenLabs API key is missing the convai_write permission. Create or update a key with Conversational AI permissions and restart apps/web.";
  }

  if (normalized.includes("unknown error") || normalized.includes("server error")) {
    return language === "es"
      ? `No pudimos conectar con el agente. En ElevenLabs verifica: Authentication desactivada, allowlist con http://localhost:3001, y client tools scrollToSection + highlightElement creadas.${getGuideOverrideEnablementHint(language)}`
      : `Could not connect to the agent. In ElevenLabs verify: Authentication is disabled, the allowlist includes http://localhost:3001, and client tools scrollToSection + highlightElement exist.${getGuideOverrideEnablementHint(language)}`;
  }

  if (normalized.includes("401") || normalized.includes("authentication")) {
    return language === "es"
      ? "El agente requiere autenticación. Agrega ELEVENLABS_API_KEY en apps/web/.env.local o apps/server/.env, o desactiva Authentication en ElevenLabs → Advanced."
      : "This agent requires authentication. Add ELEVENLABS_API_KEY to apps/web/.env.local or apps/server/.env, or disable Authentication in ElevenLabs → Advanced.";
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
