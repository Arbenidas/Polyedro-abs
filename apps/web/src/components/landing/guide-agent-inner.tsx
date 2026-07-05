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

const RECENT_SPEECH_HOLD_MS = 900;
const MIN_ESTIMATED_SPEECH_MS = 1_500;
const MAX_ESTIMATED_SPEECH_MS = 18_000;
const WORD_MS_AT_NORMAL_SPEED = 430;
const PUNCTUATION_PAUSE_MS = 120;

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

export default function GuideAgentInner({
  agentId,
  language,
  onLanguageChange,
}: GuideAgentInnerProps) {
  const { startSession, endSession, sendUserMessage } = useConversationControls();
  const { status, message: statusMessage } = useConversationStatus();
  const { mode } = useConversationMode();
  const [lastMessage, setLastMessage] = useState(() => guideIdlePrompt(language, GUIDE_DEMO_MODE));
  const [localError, setLocalError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  const lastSpeakingAtRef = useRef(0);
  const speechGuardUntilRef = useRef(0);
  const sceneQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const aiMessageSeqRef = useRef(0);
  const tourRunIdRef = useRef(0);
  const kickoffTimerRef = useRef<number | null>(null);
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

  const scheduleTourKickoff = useCallback(
    (sessionLanguage: GuideLanguage) => {
      clearKickoffTimer();
      kickoffTimerRef.current = window.setTimeout(() => {
        kickoffTimerRef.current = null;
        if (statusRef.current !== "connected") {
          return;
        }

        try {
          sendUserMessage(tourKickoffMessage(sessionLanguage));
        } catch {
          /* Session ended before kickoff — ignore. */
        }
      }, GUIDE_DEMO_MODE ? 1400 : 900);
    },
    [clearKickoffTimer, sendUserMessage],
  );

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
    lastSpeakingAtRef.current = 0;
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

    // Tool calls can arrive before the browser starts playing queued TTS.
    return now < speechGuardUntilRef.current;
  }, []);

  const runSceneStep = useCallback((step: () => Promise<string>) => {
    const queuedStep = sceneQueueRef.current.then(step, step);
    sceneQueueRef.current = queuedStep.then(
      () => undefined,
      () => undefined,
    );

    return queuedStep;
  }, []);

  const waitForNarrationToFinish = useCallback(
    async (messageSeqBefore: number, runId: number) => {
      const deadline = Date.now() + 10_000;

      while (
        tourRunIdRef.current === runId &&
        statusRef.current === "connected" &&
        aiMessageSeqRef.current === messageSeqBefore &&
        !isAgentPresenting() &&
        Date.now() < deadline
      ) {
        await sleep(100);
      }

      if (tourRunIdRef.current !== runId || statusRef.current !== "connected") {
        return;
      }

      await waitForAgentSpeechToFinish(isAgentPresenting);
      await sleep(450);
    },
    [isAgentPresenting],
  );

  const runGuidedTour = useCallback(
    async (sessionLanguage: GuideLanguage, runId: number) => {
      for (const sectionId of LANDING_TOUR_ORDER) {
        if (tourRunIdRef.current !== runId || statusRef.current !== "connected") {
          return;
        }

        await runSceneStep(() =>
          scrollToLandingSectionAsync(sectionId as LandingTourSectionId, isAgentPresenting),
        );

        if (tourRunIdRef.current !== runId || statusRef.current !== "connected") {
          return;
        }

        const messageSeqBefore = aiMessageSeqRef.current;
        sendUserMessage(guideSectionNarrationPrompt(sectionId, sessionLanguage));
        await waitForNarrationToFinish(messageSeqBefore, runId);
      }
    },
    [isAgentPresenting, runSceneStep, sendUserMessage, waitForNarrationToFinish],
  );

  const finishSession = useCallback(() => {
    clearKickoffTimer();
    resetSceneSync();
    startingRef.current = false;
    markGuideSessionInactive();
  }, [clearKickoffTimer, resetSceneSync]);

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

      startSession({
        agentId,
        userId: `landing-${sessionLanguage}${GUIDE_DEMO_MODE ? "-demo" : ""}`,
        ...getGuideSessionOptions(),
        onConnect: () => {
          statusRef.current = "connected";
          startingRef.current = false;
          if (GUIDE_DEMO_MODE) {
            void runGuidedTour(sessionLanguage, tourRunIdRef.current);
          } else {
            scheduleTourKickoff(sessionLanguage);
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
            const nextMessage = message.message.trim();
            aiMessageSeqRef.current += 1;
            speechGuardUntilRef.current = Math.max(
              speechGuardUntilRef.current,
              Date.now() + estimateSpeechDurationMs(nextMessage),
            );
            setLastMessage(nextMessage);
          }
        },
        onError: (message) => {
          finishSession();
          setLastMessage(guideIdlePrompt(sessionLanguage, GUIDE_DEMO_MODE));
          setLocalError(formatGuideError(normalizeGuideErrorMessage(message), sessionLanguage));
        },
      });
    },
    [
      agentId,
      connected,
      connecting,
      finishSession,
      language,
      resetSceneSync,
      runGuidedTour,
      scheduleTourKickoff,
      startSession,
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
    const section = String(parameters.section ?? "");
    if (!isLandingTourSectionId(section)) {
      return `Sección desconocida "${section}". Secciones válidas: hero, problem, how-it-works, agents, pipeline, approval, automation, demo, audience, guide, cta.`;
    }

    return runSceneStep(() => scrollToLandingSectionAsync(section, isAgentPresenting));
  });

  useConversationClientTool("highlightElement", async (parameters) => {
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
    };
  }, [clearKickoffTimer]);

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
          MODO DEMO · SIN MIC
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
        {GUIDE_DEMO_MODE
          ? language === "es"
            ? "El agente controla scroll (scrollToSection) y resalta elementos (highlightElement). Solo escucha."
            : "The agent controls scroll (scrollToSection) and highlights (highlightElement). Listen only."
          : language === "es"
            ? "El agente recorre cada sección de la landing y responde tus preguntas."
            : "The agent walks each landing section and answers your questions."}
      </p>
    </>
  );
}
