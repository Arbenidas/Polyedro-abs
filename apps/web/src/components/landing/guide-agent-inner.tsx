"use client";

import {
  useConversationClientTool,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ACID,
  CORAL,
  FONT_MONO,
  FONT_SANS,
  INK,
  monoLabel,
  PAPER,
  wave,
} from "@/components/labs/defs";

import { landingSignal } from "./landing-colors";
import {
  formatGuideError,
  normalizeGuideErrorMessage,
  getGuideSessionOptions,
  GUIDE_DEMO_MODE,
  isGuideSessionActive,
  markGuideSessionActive,
  markGuideSessionInactive,
  tourKickoffMessage,
  waitForGuideDisconnect,
} from "./guide-agent-session";
import { GUIDE_TOUR_START_EVENT } from "./guide-tour-events";
import {
  LANDING_TOUR_ORDER,
  type LandingTourSectionId,
  type GuideLanguage,
  clearTourHighlights,
  clearTourSectionActive,
  guideEndTourLabel,
  guideFirstMessage,
  guideIdlePrompt,
  guideSectionNarrationPrompt,
  guideStartTourLabel,
  isLandingTourSectionId,
  scrollToLandingSectionAsync,
} from "./landing-tour-sections";
import { highlightTourTargetAsync, isTourHighlightId } from "./landing-tour-highlights";
import {
  getGuideTtsSpeed,
  getTourHighlightDwellMs,
  sleep,
  waitForAgentSpeechToFinish,
} from "./landing-tour-timing";

type GuideAgentInnerProps = {
  agentId: string;
  language: GuideLanguage;
  onLanguageChange: (language: GuideLanguage) => void;
};

const RECENT_SPEECH_HOLD_MS = 550;
const CONNECTED_READY_DELAY_MS = 280;
const INITIAL_AGENT_GREETING_GRACE_MS = 1500;
const FIRST_NARRATION_RESPONSE_TIMEOUT_MS = 9_000;
const NARRATION_RESPONSE_TIMEOUT_MS = 7_500;
const MIN_ESTIMATED_SPEECH_MS = 900;
const MAX_ESTIMATED_SPEECH_MS = 12_000;
const SESSION_STARTUP_TIMEOUT_MS = 12_000;
const POST_NARRATION_BEAT_MS = 180;
const DUPLICATE_MESSAGE_WINDOW_MS = 30_000;
const WORD_MS_AT_NORMAL_SPEED = 340;
const PUNCTUATION_PAUSE_MS = 80;
const GUIDE_META_LEAK_MARKERS = [
  "The user wants me",
  "I need to",
  "I will",
  "Let's check",
  "This fits",
  "The provided idea",
  "Constraints:",
  "- Male guide",
  "Word count",
  "La pagina ya esta posicionada",
] as const;

type NarrationWaitResult = "finished" | "cancelled" | "timeout";
type TourRunResult = "completed" | "cancelled" | "timeout";

function normalizeGuideMessageFingerprint(message: string): string {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function estimateSpeechDurationMs(message: string): number {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  const punctuation = message.match(/[,.…;:!?]/g)?.length ?? 0;
  const estimatedMs =
    (words * WORD_MS_AT_NORMAL_SPEED + punctuation * PUNCTUATION_PAUSE_MS + 600) /
    getGuideTtsSpeed();

  return Math.round(
    Math.min(MAX_ESTIMATED_SPEECH_MS, Math.max(MIN_ESTIMATED_SPEECH_MS, estimatedMs)),
  );
}

function sanitizeGuideAgentMessage(message: string): { message: string | null; leakedMeta: boolean } {
  let cleaned = message.trim().replace(/^(?:\s*\[[^\]]+\]\s*)+/g, "");
  cleaned = cleaned
    .replace(/\s*Solo escucha\.?/gi, "")
    .replace(/\s*Listen only\.?/gi, "")
    .replace(/[¿?]+/g, ".");
  let leakedMeta = cleaned !== message.trim();

  for (const marker of GUIDE_META_LEAK_MARKERS) {
    const markerIndex = cleaned.indexOf(marker);
    if (markerIndex >= 0) {
      cleaned = cleaned.slice(0, markerIndex).trim();
      leakedMeta = true;
    }
  }

  const firstLine = cleaned.split(/\n+/)[0]?.trim() ?? "";
  if (firstLine !== cleaned) {
    leakedMeta = true;
    cleaned = firstLine;
  }

  const sentences = cleaned.match(/[^.!]+[.!]*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];

  if (sentences.length >= 2) {
    const dedupedSentences: string[] = [];
    let lastFingerprint = "";

    for (const sentence of sentences) {
      const fingerprint = normalizeGuideMessageFingerprint(sentence);
      if (fingerprint && fingerprint === lastFingerprint) {
        leakedMeta = true;
        continue;
      }

      dedupedSentences.push(sentence);
      lastFingerprint = fingerprint;
    }

    if (dedupedSentences.length !== sentences.length) {
      cleaned = dedupedSentences.join(" ").trim();
    }
  }

  const cleanedFingerprint = normalizeGuideMessageFingerprint(cleaned);
  const midpoint = Math.floor(cleaned.length / 2);
  const firstHalf = cleaned.slice(0, midpoint).trim();
  const secondHalf = cleaned.slice(midpoint).trim();

  if (
    cleaned.length > 24 &&
    normalizeGuideMessageFingerprint(firstHalf) === normalizeGuideMessageFingerprint(secondHalf)
  ) {
    cleaned = firstHalf.replace(/[,\s]+$/, "").trim();
    leakedMeta = true;
  }

  return { message: cleanedFingerprint ? cleaned : null, leakedMeta };
}

export default function GuideAgentInner({
  agentId,
  language,
  onLanguageChange,
}: GuideAgentInnerProps) {
  const { startSession, endSession, sendUserMessage, sendUserActivity } = useConversationControls();
  const { status, message: statusMessage } = useConversationStatus();
  const { mode } = useConversationMode();
  const [lastMessage, setLastMessage] = useState(() => guideIdlePrompt(language, GUIDE_DEMO_MODE));
  const [localError, setLocalError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  const lastSpeakingAtRef = useRef(0);
  const agentBusyUntilRef = useRef(0);
  const speechGuardUntilRef = useRef(0);
  const sceneQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const aiMessageSeqRef = useRef(0);
  const lastAcceptedMessageFingerprintRef = useRef("");
  const lastAcceptedMessageAtRef = useRef(0);
  const tourRunIdRef = useRef(0);
  const kickoffTimerRef = useRef<number | null>(null);
  const startupTimerRef = useRef<number | null>(null);
  const heights = wave(1);

  modeRef.current = mode;

  useEffect(() => {
    if (mode === "speaking") {
      lastSpeakingAtRef.current = Date.now();
    }
  }, [mode]);

  const clearKickoffTimer = useCallback(() => {
    if (kickoffTimerRef.current) {
      window.clearTimeout(kickoffTimerRef.current);
      kickoffTimerRef.current = null;
    }
  }, []);

  const clearStartupTimer = useCallback(() => {
    if (startupTimerRef.current) {
      window.clearTimeout(startupTimerRef.current);
      startupTimerRef.current = null;
    }
  }, []);

  const connected = status === "connected";
  const connecting = status === "connecting";
  const hasError = status === "error";
  const speaking = mode === "speaking";
  const playing = connected && speaking;
  const tourActive = connected || connecting || isGuideSessionActive();
  const rawError = localError ?? (hasError ? statusMessage : null);
  const error = rawError
    ? formatGuideError(normalizeGuideErrorMessage(rawError), language)
    : null;

  statusRef.current = status;

  const resetSceneSync = useCallback(() => {
    tourRunIdRef.current += 1;
    sceneQueueRef.current = Promise.resolve();
    speechGuardUntilRef.current = 0;
    agentBusyUntilRef.current = 0;
    lastSpeakingAtRef.current = 0;
    lastAcceptedMessageFingerprintRef.current = "";
    lastAcceptedMessageAtRef.current = 0;
  }, []);

  const isAgentPresenting = useCallback(() => {
    const now = Date.now();

    if (modeRef.current === "speaking") {
      return true;
    }

    // ElevenLabs may flip listening between TTS chunks — treat short gaps as still speaking.
    if (now - lastSpeakingAtRef.current < RECENT_SPEECH_HOLD_MS) {
      return true;
    }

    if (now < agentBusyUntilRef.current) {
      return true;
    }

    // Tool calls can arrive before the browser starts playing queued TTS.
    return now < speechGuardUntilRef.current;
  }, []);

  const isTourRunCurrent = useCallback((runId: number) => {
    return tourRunIdRef.current === runId && statusRef.current === "connected";
  }, []);

  const safeSendUserMessage = useCallback(
    (message: string) => {
      if (statusRef.current !== "connected") {
        return false;
      }

      try {
        sendUserMessage(message);
        return true;
      } catch (error) {
        console.warn("[Guide Agent] sendUserMessage skipped", error);
        return false;
      }
    },
    [sendUserMessage],
  );

  const nudgeConversationActivity = useCallback(() => {
    if (statusRef.current !== "connected") {
      return;
    }

    try {
      sendUserActivity();
    } catch {
      /* Session ended before the activity ping — ignore. */
    }
  }, [sendUserActivity]);

  const runSceneStep = useCallback((step: () => Promise<string>) => {
    const queuedStep = sceneQueueRef.current.then(step, step);
    sceneQueueRef.current = queuedStep.then(
      () => undefined,
      () => undefined,
    );

    return queuedStep;
  }, []);

  const hasNarrationStartedSince = useCallback(
    (messageSeqBefore: number) => {
      return aiMessageSeqRef.current > messageSeqBefore || isAgentPresenting();
    },
    [isAgentPresenting],
  );

  const waitForNarrationToFinish = useCallback(
    async (
      messageSeqBefore: number,
      runId: number,
      responseTimeoutMs: number,
    ): Promise<NarrationWaitResult> => {
      const deadline = Date.now() + responseTimeoutMs;

      while (
        isTourRunCurrent(runId) &&
        !hasNarrationStartedSince(messageSeqBefore) &&
        Date.now() < deadline
      ) {
        await sleep(80);
      }

      if (!isTourRunCurrent(runId)) {
        return "cancelled";
      }

      if (!hasNarrationStartedSince(messageSeqBefore)) {
        return "timeout";
      }

      await waitForAgentSpeechToFinish(isAgentPresenting);
      await sleep(POST_NARRATION_BEAT_MS);

      return isTourRunCurrent(runId) ? "finished" : "cancelled";
    },
    [hasNarrationStartedSince, isAgentPresenting, isTourRunCurrent],
  );

  const waitForInitialAgentSettle = useCallback(
    async (runId: number): Promise<boolean> => {
      await sleep(CONNECTED_READY_DELAY_MS);

      if (!isTourRunCurrent(runId)) {
        return false;
      }

      const messageSeqBefore = aiMessageSeqRef.current;
      const greetingDeadline = Date.now() + INITIAL_AGENT_GREETING_GRACE_MS;

      while (
        isTourRunCurrent(runId) &&
        aiMessageSeqRef.current === messageSeqBefore &&
        !isAgentPresenting() &&
        Date.now() < greetingDeadline
      ) {
        await sleep(80);
      }

      if (!isTourRunCurrent(runId)) {
        return false;
      }

      if (aiMessageSeqRef.current !== messageSeqBefore || isAgentPresenting()) {
        await waitForAgentSpeechToFinish(isAgentPresenting);
        await sleep(POST_NARRATION_BEAT_MS);
      }

      return isTourRunCurrent(runId);
    },
    [isAgentPresenting, isTourRunCurrent],
  );

  const runGuidedTour = useCallback(
    async (sessionLanguage: GuideLanguage, runId: number): Promise<TourRunResult> => {
      const ready = await waitForInitialAgentSettle(runId);
      if (!ready) {
        return "cancelled";
      }

      for (const [index, sectionId] of LANDING_TOUR_ORDER.entries()) {
        if (!isTourRunCurrent(runId)) {
          return "cancelled";
        }

        nudgeConversationActivity();

        await runSceneStep(() =>
          scrollToLandingSectionAsync(sectionId as LandingTourSectionId, isAgentPresenting),
        );

        if (!isTourRunCurrent(runId)) {
          return "cancelled";
        }

        const messageSeqBefore = aiMessageSeqRef.current;
        const sent = safeSendUserMessage(guideSectionNarrationPrompt(sectionId, sessionLanguage));

        if (!sent) {
          return "cancelled";
        }

        const narrationResult = await waitForNarrationToFinish(
          messageSeqBefore,
          runId,
          index === 0 ? FIRST_NARRATION_RESPONSE_TIMEOUT_MS : NARRATION_RESPONSE_TIMEOUT_MS,
        );

        if (narrationResult !== "finished") {
          return narrationResult;
        }
      }

      return "completed";
    },
    [
      isAgentPresenting,
      isTourRunCurrent,
      nudgeConversationActivity,
      runSceneStep,
      safeSendUserMessage,
      waitForInitialAgentSettle,
      waitForNarrationToFinish,
    ],
  );

  const scheduleTourKickoff = useCallback(
    (sessionLanguage: GuideLanguage, runId: number) => {
      clearKickoffTimer();
      kickoffTimerRef.current = window.setTimeout(() => {
        kickoffTimerRef.current = null;

        void (async () => {
          const ready = await waitForInitialAgentSettle(runId);
          if (!ready) {
            return;
          }

          safeSendUserMessage(tourKickoffMessage(sessionLanguage));
        })();
      }, GUIDE_DEMO_MODE ? 1400 : 900);
    },
    [clearKickoffTimer, safeSendUserMessage, waitForInitialAgentSettle],
  );

  const finishSession = useCallback(() => {
    clearKickoffTimer();
    clearStartupTimer();
    resetSceneSync();
    startingRef.current = false;
    markGuideSessionInactive();
  }, [clearKickoffTimer, clearStartupTimer, resetSceneSync]);

  const stopSessionAfterStall = useCallback(
    (sessionLanguage: GuideLanguage, reason: "Guide startup timeout" | "Guide response timeout") => {
      try {
        endSession();
      } catch (error) {
        console.warn("[Guide Agent] endSession after stall failed", error);
      }

      finishSession();
      clearTourHighlights();
      clearTourSectionActive();
      setLastMessage(guideIdlePrompt(sessionLanguage, GUIDE_DEMO_MODE));
      setLocalError(formatGuideError(reason, sessionLanguage));
    },
    [endSession, finishSession],
  );

  const scheduleStartupTimeout = useCallback(
    (sessionLanguage: GuideLanguage) => {
      clearStartupTimer();
      startupTimerRef.current = window.setTimeout(() => {
        startupTimerRef.current = null;

        if (statusRef.current === "connected") {
          return;
        }

        stopSessionAfterStall(sessionLanguage, "Guide startup timeout");
      }, SESSION_STARTUP_TIMEOUT_MS);
    },
    [clearStartupTimer, stopSessionAfterStall],
  );

  const beginSession = useCallback(
    async (sessionLanguage: GuideLanguage = language) => {
      if (startingRef.current || isGuideSessionActive() || connected || connecting) {
        return;
      }

      if (!markGuideSessionActive()) {
        return;
      }

      resetSceneSync();
      startingRef.current = true;
      setLocalError(null);
      setLastMessage(guideFirstMessage(sessionLanguage));

      if (!GUIDE_DEMO_MODE) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          finishSession();
          setLastMessage(guideIdlePrompt(sessionLanguage, GUIDE_DEMO_MODE));
          setLocalError(formatGuideError("Microphone access denied", sessionLanguage));
          return;
        }
      }

      scheduleStartupTimeout(sessionLanguage);

      try {
        startSession({
          agentId,
          userId: `landing-${sessionLanguage}${GUIDE_DEMO_MODE ? "-demo" : ""}`,
          ...getGuideSessionOptions(),
          onConnect: () => {
            clearStartupTimer();
            statusRef.current = "connected";
            startingRef.current = false;
            const runId = tourRunIdRef.current;

            if (GUIDE_DEMO_MODE) {
              void runGuidedTour(sessionLanguage, runId).then((result) => {
                if (result === "timeout" && isTourRunCurrent(runId)) {
                  stopSessionAfterStall(sessionLanguage, "Guide response timeout");
                }
              });
            } else {
              scheduleTourKickoff(sessionLanguage, runId);
            }
          },
          onDisconnect: () => {
            finishSession();
            clearTourHighlights();
            clearTourSectionActive();
            setLastMessage(guideIdlePrompt(sessionLanguage, GUIDE_DEMO_MODE));
          },
          onMessage: (message) => {
            if (message.source === "ai" && message.message) {
              const { message: nextMessage, leakedMeta } = sanitizeGuideAgentMessage(message.message);
              if (!nextMessage) {
                console.warn("[Guide Agent] Dropped leaked meta response", message.message);
                return;
              }

              if (leakedMeta) {
                console.warn("[Guide Agent] Sanitized leaked meta response", message.message);
              }

              const nextFingerprint = normalizeGuideMessageFingerprint(nextMessage);
              const now = Date.now();
              if (
                nextFingerprint &&
                nextFingerprint === lastAcceptedMessageFingerprintRef.current &&
                now - lastAcceptedMessageAtRef.current < DUPLICATE_MESSAGE_WINDOW_MS
              ) {
                console.warn("[Guide Agent] Dropped duplicate response", nextMessage);
                return;
              }

              lastAcceptedMessageFingerprintRef.current = nextFingerprint;
              lastAcceptedMessageAtRef.current = now;
              aiMessageSeqRef.current += 1;
              agentBusyUntilRef.current = 0;
              speechGuardUntilRef.current = Math.max(
                speechGuardUntilRef.current,
                Date.now() + estimateSpeechDurationMs(nextMessage),
              );
              setLastMessage(nextMessage);
            }
          },
          onAgentTyping: () => {
            agentBusyUntilRef.current = Date.now() + 3_000;
          },
          onError: (message) => {
            finishSession();
            setLastMessage(guideIdlePrompt(sessionLanguage, GUIDE_DEMO_MODE));
            setLocalError(formatGuideError(normalizeGuideErrorMessage(message), sessionLanguage));
          },
        });
      } catch (error) {
        finishSession();
        setLastMessage(guideIdlePrompt(sessionLanguage, GUIDE_DEMO_MODE));
        setLocalError(formatGuideError(normalizeGuideErrorMessage(error), sessionLanguage));
      }
    },
    [
      agentId,
      clearStartupTimer,
      connected,
      connecting,
      finishSession,
      isTourRunCurrent,
      language,
      resetSceneSync,
      runGuidedTour,
      scheduleStartupTimeout,
      scheduleTourKickoff,
      startSession,
      stopSessionAfterStall,
    ],
  );

  const handleLanguageChange = useCallback(
    (nextLanguage: GuideLanguage) => {
      if (nextLanguage === language || tourActive) {
        return;
      }

      onLanguageChange(nextLanguage);
      setLastMessage(guideIdlePrompt(nextLanguage, GUIDE_DEMO_MODE));
    },
    [language, onLanguageChange, tourActive],
  );

  const handleStartTour = useCallback(() => {
    void beginSession();
  }, [beginSession]);

  const handleEndTour = useCallback(async () => {
    try {
      endSession();
    } catch (error) {
      console.warn("[Guide Agent] endSession failed", error);
    }

    finishSession();
    clearTourHighlights();
    clearTourSectionActive();
    await waitForGuideDisconnect(() => statusRef.current);
    setLastMessage(guideIdlePrompt(language, GUIDE_DEMO_MODE));
    setLocalError(null);
  }, [endSession, finishSession, language]);

  useConversationClientTool("scrollToSection", async (parameters) => {
    if (GUIDE_DEMO_MODE) {
      return "El recorrido demo ya esta controlado por el cliente. No llames tools ni narres por tu cuenta; espera el siguiente mensaje SECCION_VISIBLE.";
    }

    const section = String(parameters.section ?? "");
    if (!isLandingTourSectionId(section)) {
      return `Sección desconocida "${section}". Secciones válidas: hero, problem, how-it-works, agents, pipeline, approval, automation, demo, audience, guide, cta.`;
    }

    return runSceneStep(() => scrollToLandingSectionAsync(section, isAgentPresenting));
  });

  useConversationClientTool("highlightElement", async (parameters) => {
    if (GUIDE_DEMO_MODE) {
      return "El recorrido demo ya esta controlado por el cliente. No llames tools ni narres por tu cuenta; espera el siguiente mensaje SECCION_VISIBLE.";
    }

    const target = String(parameters.target ?? parameters.element ?? "");
    const durationMs = parameters.durationMs != null ? Number(parameters.durationMs) : undefined;

    if (!target) {
      return 'Falta el parámetro "target" con el id del elemento a resaltar.';
    }

    if (!isTourHighlightId(target)) {
      return `Target "${target}" no es válido. Usa ids como hero-wordmark, agent-brand, pipeline-copy, demo-ad-headline, etc.`;
    }

    return runSceneStep(() =>
      highlightTourTargetAsync(target, {
        durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
        dwellMs: getTourHighlightDwellMs(),
        isSpeaking: isAgentPresenting,
      }),
    );
  });

  useEffect(() => {
    return () => {
      clearKickoffTimer();
      clearStartupTimer();
    };
  }, [clearKickoffTimer, clearStartupTimer]);

  useEffect(() => {
    if (!tourActive) {
      setLastMessage(guideIdlePrompt(language, GUIDE_DEMO_MODE));
    }
  }, [language, tourActive]);

  useEffect(() => {
    const onStartTour = () => {
      void beginSession();
    };

    window.addEventListener(GUIDE_TOUR_START_EVENT, onStartTour);
    return () => window.removeEventListener(GUIDE_TOUR_START_EVENT, onStartTour);
  }, [beginSession]);

  const statusLabel = connecting
    ? "…"
    : speaking
      ? "NAR"
      : connected
        ? GUIDE_DEMO_MODE
          ? "DEMO"
          : "ON"
        : "VO";

  return (
    <>
      {GUIDE_DEMO_MODE && (
        <span
          style={{
            ...monoLabel,
            fontSize: 9,
            alignSelf: "flex-start",
            background: ACID,
            padding: "3px 8px",
            border: `2px solid ${INK}`,
          }}
        >
          MODO DEMO
        </span>
      )}

      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.45,
          fontWeight: 500,
          color: "rgba(10,10,10,0.85)",
        }}
      >
        {lastMessage}
      </p>

      {!GUIDE_DEMO_MODE && (
        <div style={{ display: "flex", gap: 8 }}>
          {(["es", "en"] as const).map((option) => {
            const active = language === option;
            return (
              <button
                key={option}
                type="button"
                className={active ? undefined : "hov-accent"}
                disabled={tourActive || connecting}
                onClick={() => handleLanguageChange(option)}
                style={{
                  flex: 1,
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "8px 10px",
                  border: `2px solid ${INK}`,
                  background: active ? ACID : PAPER,
                  cursor: tourActive || connecting ? "not-allowed" : "pointer",
                  opacity: tourActive || connecting ? 0.65 : 1,
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {!tourActive ? (
        <button
          type="button"
          className="nb-press hov-accent"
          disabled={connecting}
          onClick={handleStartTour}
          style={{
            width: "100%",
            fontFamily: FONT_SANS,
            fontWeight: 800,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            background: ACID,
            color: INK,
            border: `3px solid ${INK}`,
            padding: "14px 16px",
            cursor: connecting ? "wait" : "pointer",
          }}
        >
          {connecting ? "…" : guideStartTourLabel(language)}
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: PAPER,
              border: `2px solid ${INK}`,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: 26,
                opacity: playing ? 1 : 0.35,
              }}
            >
              {heights.slice(0, 18).map((h, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    background: landingSignal(i),
                    border: `1px solid ${INK}`,
                    transformOrigin: "bottom",
                    animation: playing ? `pv-bar ${0.4 + (i % 5) * 0.08}s ease-in-out infinite` : undefined,
                  }}
                />
              ))}
            </div>
            <span style={{ ...monoLabel, fontSize: 9, color: "rgba(10,10,10,0.45)" }}>{statusLabel}</span>
          </div>

          <button
            type="button"
            className="hov-coral"
            disabled={connecting}
            onClick={() => void handleEndTour()}
            style={{
              width: "100%",
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              background: CORAL,
              color: INK,
              border: `2px solid ${INK}`,
              padding: "10px 12px",
              cursor: connecting ? "wait" : "pointer",
            }}
          >
            {guideEndTourLabel(language)}
          </button>
        </div>
      )}

      {error && (
        <p
          style={{
            margin: 0,
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: "0.04em",
            color: CORAL,
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}

      {!GUIDE_DEMO_MODE && (
        <p
          style={{
            margin: 0,
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: "0.06em",
            color: "rgba(10,10,10,0.45)",
            lineHeight: 1.4,
          }}
        >
          {language === "es"
            ? "El agente recorre cada sección de la landing con narración continua."
            : "The agent walks each landing section with continuous narration."}
        </p>
      )}
    </>
  );
}
