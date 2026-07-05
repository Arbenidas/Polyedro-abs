"use client";

import { ConversationProvider } from "@elevenlabs/react";
import { env } from "@Polyedro-abs/env/web";
import { useEffect, useState } from "react";

import {
  ACID,
  CARD,
  FONT_BLACK,
  FONT_MONO,
  INK,
  PAPER,
} from "@/components/labs/defs";

import { GuideAgentErrorBoundary } from "./guide-agent-error-boundary";
import { GUIDE_DEMO_MODE } from "./guide-agent-session";
import { GUIDE_TOUR_START_EVENT } from "./guide-tour-events";
import GuideAgentInner from "./guide-agent-inner";
import {
  DEFAULT_GUIDE_LANGUAGE,
  guideIdlePrompt,
  type GuideLanguage,
} from "./landing-tour-sections";

const GUIDE_AGENT_ID = env.NEXT_PUBLIC_ELEVENLABS_GUIDE_AGENT_ID;

export default function GuideAgentShell() {
  const [expanded, setExpanded] = useState(true);
  const [language, setLanguage] = useState<GuideLanguage>(DEFAULT_GUIDE_LANGUAGE);
  const configured = Boolean(GUIDE_AGENT_ID);

  useEffect(() => {
    const expandForTour = () => setExpanded(true);
    window.addEventListener(GUIDE_TOUR_START_EVENT, expandForTour);
    return () => window.removeEventListener(GUIDE_TOUR_START_EVENT, expandForTour);
  }, []);

  // LiveKit/ElevenLabs may reject with a raw Event on abrupt WebSocket close (code 1006).
  // Next.js dev overlay surfaces that as "[object Event]" unless we mark it handled.
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const isTransportEvent =
        (typeof Event !== "undefined" && reason instanceof Event) ||
        (typeof reason === "object" &&
          reason !== null &&
          "isTrusted" in reason &&
          !("message" in reason));

      if (!isTransportEvent) {
        return;
      }

      event.preventDefault();
      console.warn("[Guide Agent] Suppressed LiveKit transport rejection", reason);
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  return (
    <div
      aria-label="Agente guía — recorrido de la landing Polyedro"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        width: expanded ? "min(340px, calc(100vw - 48px))" : 56,
        transition: "width 0.2s ease",
      }}
    >
      <div
        style={{
          background: CARD,
          border: `3px solid ${INK}`,
          boxShadow: `6px 6px 0 ${INK}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: expanded ? "10px 14px" : 10,
            borderBottom: expanded ? `3px solid ${INK}` : "none",
            background: INK,
            cursor: "pointer",
          }}
          onClick={() => setExpanded((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setExpanded((value) => !value);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
        >
          <span
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: ACID,
              border: `2px solid ${INK}`,
              fontFamily: FONT_BLACK,
              fontSize: 16,
            }}
          >
            G
          </span>
          {expanded && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONT_BLACK,
                    fontSize: 13,
                    color: PAPER,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Agente guía
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "rgba(244,242,236,0.55)",
                  }}
                >
                  {configured
                    ? GUIDE_DEMO_MODE
                      ? "ELEVENLABS · DEMO"
                      : "ELEVENLABS · EN VIVO"
                    : "ELEVENLABS · CONFIGURACIÓN PENDIENTE"}
                </div>
              </div>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  color: "rgba(244,242,236,0.5)",
                }}
              >
                −
              </span>
            </>
          )}
        </div>

        {expanded && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {configured && GUIDE_AGENT_ID ? (
              <ConversationProvider isMuted={GUIDE_DEMO_MODE}>
                <GuideAgentErrorBoundary language={language}>
                  <GuideAgentInner
                    agentId={GUIDE_AGENT_ID}
                    language={language}
                    onLanguageChange={setLanguage}
                  />
                </GuideAgentErrorBoundary>
              </ConversationProvider>
            ) : (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    fontWeight: 500,
                    color: "rgba(10,10,10,0.85)",
                  }}
                >
                  {guideIdlePrompt(language, GUIDE_DEMO_MODE)}
                </p>
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
                  Agrega{" "}
                  <code style={{ fontFamily: FONT_MONO, fontSize: 9 }}>NEXT_PUBLIC_ELEVENLABS_GUIDE_AGENT_ID</code>{" "}
                  en <code style={{ fontFamily: FONT_MONO, fontSize: 9 }}>apps/web/.env.local</code> después de crear
                  el agente en ElevenLabs.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
