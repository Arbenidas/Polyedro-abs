"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  ACCENT,
  ACID,
  CARD,
  CORAL,
  CYAN,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  GOAL,
  gridBg,
  INK,
  monoLabel,
  PAPER,
  RADIUS_PILL,
  RADIUS_SM,
  RUN_DEFS,
  STONE,
  SUN,
  textOnSignal,
} from "./defs";
import { BrandWordmarkLink } from "./brand-wordmark-link";
import { SignOutButton } from "./sign-out-button";
import type { AudioTranscriptionPhase } from "./use-audio-transcription";
import { Eyebrow, Marker, MicOrb, VoicePanel, VoiceStatePill } from "./voice-ui";

/* ═══════════ WIZARD SHELL (no dashboard sidebar) ═══════════ */

export function WizardShell({
  stepIndex,
  stepLabel,
  children,
}: {
  stepIndex: number;
  stepLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAPER,
        backgroundImage: `radial-gradient(480px circle at 100% 0%, ${CYAN}26 0%, transparent 60%), ${gridBg(0.035)}`,
        color: INK,
        fontFamily: FONT_SANS,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          padding: "14px 28px",
          borderBottom: `3px solid ${INK}`,
          background: CARD,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            className="nb-press"
            style={
              {
                width: 40,
                height: 40,
                flex: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: ACID,
                border: `3px solid ${INK}`,
                borderRadius: RADIUS_SM,
                transform: "rotate(-5deg)",
                fontFamily: FONT_BLACK,
                fontSize: 20,
                "--sx": "3px",
              } as CSSProperties
            }
          >
            /
          </div>
          <div>
            <BrandWordmarkLink titleSize={19} suffixSize={17} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.1em", color: "rgba(10,10,10,0.5)", marginTop: 2 }}>
              MOTOR DE MARKETING CON IA
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              border: `2px solid ${INK}`,
              borderRadius: RADIUS_PILL,
              padding: "7px 12px",
              background: CARD,
              boxShadow: `3px 3px 0 ${INK}`,
              whiteSpace: "nowrap",
            }}
          >
            {stepIndex + 1}/3 · {stepLabel}
          </span>
          <SignOutButton />
        </div>
      </header>
      <div style={{ padding: "28px 24px 80px" }}>{children}</div>
    </div>
  );
}

/* ═══════════ ONBOARDING ═══════════ */

export function OnboardingView({
  brandInput,
  onBrandInput,
  descInput,
  onDescInput,
  markets,
  toggleMarket,
  initWorkspace,
}: {
  brandInput: string;
  onBrandInput: (v: string) => void;
  descInput: string;
  onDescInput: (v: string) => void;
  markets: Record<string, boolean>;
  toggleMarket: (m: string) => void;
  initWorkspace: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div style={{ marginBottom: 22 }}>
          <Eyebrow tone="acid">01/03 · Marca</Eyebrow>
        </div>

        <div style={{ background: CARD, border: `3px solid ${INK}`, borderRadius: RADIUS_SM, boxShadow: `8px 8px 0 ${INK}`, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderBottom: `3px solid ${INK}`,
                background: INK,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: CORAL,
                  border: "1.5px solid rgba(244,242,236,0.4)",
                }}
              />
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: SUN,
                  border: "1.5px solid rgba(244,242,236,0.4)",
                }}
              />
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: ACID,
                  border: "1.5px solid rgba(244,242,236,0.4)",
                }}
              />
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: "rgba(244,242,236,0.7)", marginLeft: 8 }}>
                ~/new-workspace/init
              </span>
            </div>
            <div style={{ padding: "30px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontFamily: FONT_BLACK, fontSize: 30, letterSpacing: "-0.01em", lineHeight: 1.02 }}>
                  Crea tu <Marker>espacio de marca</Marker>.
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 8 }}>
                  Un espacio de trabajo por marca. Los agentes leen todo lo que pongas aquí.
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={monoLabel}>NOMBRE DE MARCA</span>
                <input
                  value={brandInput}
                  onChange={(e) => onBrandInput(e.target.value)}
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 16,
                    fontWeight: 700,
                    border: `3px solid ${INK}`,
                    borderRadius: RADIUS_SM,
                    padding: "12px 14px",
                    background: PAPER,
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={monoLabel}>¿QUÉ VENDES?</span>
                <textarea
                  rows={2}
                  value={descInput}
                  onChange={(e) => onDescInput(e.target.value)}
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 13.5,
                    fontWeight: 500,
                    border: `3px solid ${INK}`,
                    borderRadius: RADIUS_SM,
                    padding: "12px 14px",
                    background: PAPER,
                    resize: "none",
                    lineHeight: 1.5,
                  }}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={monoLabel}>MERCADO</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.keys(markets).map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMarket(m)}
                      className="hov-accent"
                      style={{
                        fontFamily: FONT_SANS,
                        fontSize: 12,
                        fontWeight: 700,
                        border: `2px solid ${INK}`,
                        borderRadius: RADIUS_PILL,
                        padding: "7px 13px",
                        cursor: "pointer",
                        background: markets[m] ? ACID : CARD,
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={initWorkspace}
                className="nb-press"
                style={
                  {
                    fontFamily: FONT_SANS,
                    fontSize: 15,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: ACID,
                    border: `3px solid ${INK}`,
                    borderRadius: RADIUS_SM,
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    "--sx": "5px",
                  } as CSSProperties
                }
              >
                <span style={{ display: "inline-block", width: 11, height: 11, background: INK, transform: "rotate(45deg)" }} />
                Inicializar espacio de trabajo
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

/* ═══════════ NEW CAMPAIGN (step 02) ═══════════ */

const DELIVERABLES = ["Estrategia", "Audiencias de Meta", "Copy ES/EN + A/B", "Creatividades estáticas", "Guion de video", "Voiceover ES/EN"];

export function NewCampaignView({
  goalInput,
  onGoalInput,
  goalPhase,
  goalMessage,
  goalTranscriptionId,
  goalOrbClick,
  deployAgents,
  goBack,
}: {
  goalInput: string;
  onGoalInput: (v: string) => void;
  goalPhase: AudioTranscriptionPhase;
  goalMessage: string;
  goalTranscriptionId: string | null;
  goalOrbClick: () => void;
  deployAgents: () => void;
  goBack: () => void;
}) {
  const recording = goalPhase === "recording";
  const uploading = goalPhase === "uploading";
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 22,
          fontFamily: FONT_MONO,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
        }}
      >
        <span style={{ border: `2px solid ${INK}`, background: CARD, color: "rgba(10,10,10,0.4)", padding: "5px 12px" }}>
          01 · MARCA ✓
        </span>
        <span style={{ border: `2px solid ${INK}`, borderLeft: "none", background: ACID, padding: "5px 12px" }}>
          02 · CAMPAÑA
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 22, alignItems: "start" }}>
        <div
          style={{
            background: CARD,
            border: `3px solid ${INK}`,
            borderRadius: RADIUS_SM,
            boxShadow: `8px 8px 0 ${INK}`,
            padding: "30px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div>
            <div style={{ marginBottom: 10 }}>
              <Eyebrow tone="ink">Brief inicial</Eyebrow>
            </div>
            <div style={{ fontFamily: FONT_BLACK, fontSize: 32, letterSpacing: "-0.01em", lineHeight: 1.03 }}>
              ¿Qué estamos vendiendo?
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 8 }}>
              Escríbelo o <Marker>dilo en voz alta</Marker>. Los agentes toman todo desde aquí.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr)",
              gap: 16,
              alignItems: "center",
              padding: 18,
              border: `3px solid ${INK}`,
              borderRadius: RADIUS_SM,
              background: `${SUN}26`,
            }}
          >
            <MicOrb
              size="big"
              phase={goalPhase}
              onClick={goalOrbClick}
              ariaLabel={recording ? "Detener grabación y transcribir" : "Grabar tu objetivo"}
              disabled={uploading}
              ringColor={ACID}
            />
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>
                {recording ? "Escuchando…" : goalInput ? "Brief capturado" : "Toca el micrófono para empezar"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(10,10,10,0.65)", marginTop: 4 }}>
                La voz rellena el brief de abajo. Pausa el micrófono cuando quieras escribir.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <VoiceStatePill
              listening={recording}
              labelListening="Grabando…"
              labelIdle={uploading ? "Transcribiendo…" : "Micrófono listo"}
            />
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                fontWeight: 600,
                color: goalPhase === "error" || goalPhase === "unsupported" ? CORAL : "rgba(10,10,10,0.5)",
                lineHeight: 1.4,
              }}
            >
              {goalMessage}
            </span>
          </div>
          {goalTranscriptionId && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: "rgba(10,10,10,0.45)" }}>
              BRIEF GUARDADO · {goalTranscriptionId.slice(0, 8)}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={() => onGoalInput(GOAL)}
              className="nb-press"
              style={
                {
                  fontFamily: FONT_SANS,
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: CORAL,
                  border: `3px solid ${INK}`,
                  borderRadius: RADIUS_SM,
                  padding: "10px 16px",
                  cursor: "pointer",
                  "--sx": "3px",
                } as CSSProperties
              }
            >
              Usar ejemplo
            </button>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontFamily: FONT_MONO,
                fontSize: 11,
                fontWeight: 800,
                border: `2px solid ${INK}`,
                borderRadius: RADIUS_PILL,
                padding: "0 12px",
                background: CARD,
              }}
            >
              La escritura manual siempre está disponible
            </span>
          </div>

          <div style={{ borderTop: `3px dashed ${INK}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={monoLabel}>BRIEF DE CAMPAÑA</span>
            <textarea
              rows={3}
              value={goalInput}
              onChange={(e) => onGoalInput(e.target.value)}
              placeholder="Ej. Lanzamiento de audífonos con cancelación de ruido para jóvenes profesionales en LatAm…"
              style={{
                fontFamily: FONT_SANS,
                fontSize: 15,
                fontWeight: 600,
                border: `3px solid ${INK}`,
                borderRadius: RADIUS_SM,
                padding: "14px 16px",
                background: PAPER,
                resize: "none",
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={monoLabel}>ENTREGABLES</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DELIVERABLES.map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    border: `2px solid ${INK}`,
                    borderRadius: RADIUS_PILL,
                    background: ACID,
                    padding: "5px 10px",
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={goBack}
              className="nb-press"
              style={
                {
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: CARD,
                  border: `3px solid ${INK}`,
                  borderRadius: RADIUS_SM,
                  padding: "14px 20px",
                  cursor: "pointer",
                  "--sx": "4px",
                } as CSSProperties
              }
            >
              Volver
            </button>
            <button
              onClick={deployAgents}
              className="nb-press"
              style={
                {
                  flex: 1,
                  fontFamily: FONT_SANS,
                  fontSize: 15,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: INK,
                  color: ACID,
                  border: `3px solid ${INK}`,
                  borderRadius: RADIUS_SM,
                  padding: 17,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  "--sx": "5px",
                  "--sc": ACID,
                } as CSSProperties
              }
            >
              <span style={{ display: "inline-block", width: 11, height: 11, background: ACID, transform: "rotate(45deg)" }} />
              Desplegar agentes
            </button>
          </div>
        </div>

        <VoicePanel
          question="Cuéntame tu idea en una frase."
          prompt="La voz rellena el brief. Pausa el micrófono si quieres escribir."
          micPhase={goalPhase}
          onMicClick={goalOrbClick}
          micDisabled={uploading}
          onCapture={() => `Brief detectado: ${goalInput || "marca en exploración"} necesita una campaña clara, visual y accionable.`}
        />
      </div>
    </div>
  );
}

/* ═══════════ LIVE GENERATION ═══════════ */

export type LiveGenerationStep = {
  name: string;
  glyph: string;
  color: string;
  task: string;
  state: "queued" | "running" | "done" | "failed";
};

export function GenliveView({
  runIdx,
  goalEcho,
  steps,
  campaignLabel = "CMP-004",
  transport,
  error,
}: {
  runIdx: number;
  goalEcho: string;
  steps?: LiveGenerationStep[];
  campaignLabel?: string;
  transport?: string;
  error?: string | null;
}) {
  const rows =
    steps ??
    RUN_DEFS.map((rr, i) => ({
      ...rr,
      state: (i < runIdx ? "done" : i === runIdx ? "running" : "queued") as LiveGenerationStep["state"],
    }));

  return (
    <div style={{ maxWidth: 860, margin: "12px auto 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontFamily: FONT_BLACK, fontSize: 24 }}>Agentes desplegados</div>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            border: `2px solid ${INK}`,
            padding: "4px 10px",
            background: SUN,
            animation: "pv-pulse 1s ease-in-out infinite",
          }}
        >
          {error ? "ERROR" : "GENERATING"} · {campaignLabel}
        </span>
      </div>
      <div style={{ background: CARD, border: `3px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}` }}>
        {rows.map((rr) => {
          const state = rr.state;
          return (
            <div
              key={rr.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 20px",
                borderBottom: `2px solid ${INK}`,
                background: state === "running" ? "#FFF9E0" : state === "done" ? CARD : state === "failed" ? "#FFE8E2" : PAPER,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  flex: "none",
                  border: `2.5px solid ${INK}`,
                  background: rr.color,
                  color: textOnSignal(rr.color),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_BLACK,
                  fontSize: 12,
                }}
              >
                {rr.glyph}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{rr.name}</div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10.5,
                    color: "rgba(10,10,10,0.6)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {rr.task}
                </div>
              </div>
              {state === "running" && (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    flex: "none",
                    border: `3px solid ${INK}`,
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "pv-spin0 0.7s linear infinite",
                  }}
                />
              )}
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  fontWeight: 700,
                  border: `2px solid ${INK}`,
                  padding: "3px 8px",
                  background: state === "done" ? ACID : state === "running" ? CYAN : state === "failed" ? CORAL : STONE,
                  flex: "none",
                }}
              >
                {state === "done" ? "DONE ✓" : state === "running" ? "RUNNING" : state === "failed" ? "FAILED" : "QUEUED"}
              </span>
            </div>
          );
        })}
        <div style={{ padding: "12px 20px", fontFamily: FONT_MONO, fontSize: 10.5, color: "rgba(10,10,10,0.55)" }}>
          brief: &quot;{goalEcho || GOAL}&quot;
          {transport ? ` · transporte: ${transport.toUpperCase()}` : ""}
          {error ? ` · ${error}` : ""}
        </div>
      </div>
    </div>
  );
}
