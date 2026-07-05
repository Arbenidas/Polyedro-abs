"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

import {
  ACID,
  CARD,
  CORAL,
  eyebrowStyle,
  FONT_MONO,
  FONT_SANS,
  INK,
  markerStyle,
  RADIUS_PILL,
  RADIUS_SM,
  STONE,
  SUN,
  waveColor,
} from "./defs";

export function Eyebrow({ children, tone }: { children: ReactNode; tone?: "acid" | "ink" | "paper" }) {
  const background = tone === "acid" ? ACID : tone === "ink" ? INK : eyebrowStyle.background;
  const color = tone === "ink" ? CARD : INK;
  return <span style={{ ...eyebrowStyle, background, color }}>{children}</span>;
}

export function Marker({ children }: { children: ReactNode }) {
  return <span style={markerStyle}>{children}</span>;
}

export function VoiceStatePill({
  listening,
  labelListening,
  labelIdle,
}: {
  listening: boolean;
  labelListening: string;
  labelIdle: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 10px",
        borderRadius: RADIUS_PILL,
        border: `2px solid ${INK}`,
        background: CARD,
        fontFamily: FONT_MONO,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: listening ? CORAL : STONE,
          border: `1.5px solid ${INK}`,
          animation: listening ? "pv-pulse 1.1s ease-in-out infinite" : "none",
        }}
      />
      {listening ? labelListening : labelIdle}
    </span>
  );
}

export function WaveBars({ count = 4, mini = false }: { count?: number; mini?: boolean }) {
  const barWidth = mini ? 3 : 4;
  const barHeight = mini ? 18 : 26;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: mini ? 3 : 4, height: barHeight }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: 999,
            background: waveColor(i),
            border: `1.5px solid ${INK}`,
            animation: `pv-bar ${0.6 + (i % 3) * 0.2}s ease-in-out ${i * 0.08}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function MicGlyph({ mini }: { mini?: boolean }) {
  const width = mini ? 11 : 15;
  const height = mini ? 16 : 22;
  return (
    <div
      style={{
        width,
        height,
        border: `${mini ? 2 : 3}px solid ${INK}`,
        borderRadius: width,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -(mini ? 6 : 9),
          transform: "translateX(-50%)",
          width: mini ? 2 : 3,
          height: mini ? 4 : 6,
          background: INK,
        }}
      />
    </div>
  );
}

export type MicOrbPhase = "idle" | "recording" | "uploading" | "unsupported" | "error";

const PHASE_BG: Record<MicOrbPhase, string> = {
  idle: ACID,
  recording: CORAL,
  uploading: SUN,
  unsupported: STONE,
  error: CORAL,
};

/**
 * Circular voice-record button shared by the real brief recorder (NewCampaignView)
 * and the simulated command bar (campaign-view). Only visuals live here — callers
 * own the actual recording/command logic and pass it in via `phase`/`onClick`.
 */
export function MicOrb({
  size = "big",
  phase,
  onClick,
  ariaLabel,
  disabled,
  ringColor,
}: {
  size?: "big" | "mini";
  phase: MicOrbPhase;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  ringColor?: string;
}) {
  const active = phase === "recording" || phase === "uploading";
  const mini = size === "mini";
  const dim = mini ? 44 : 72;
  const border = mini ? 2.5 : 3;
  const shadow = mini ? 3 : 4;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`nb-press${phase === "recording" ? " mic-ring" : ""}${phase === "idle" ? " mic-bounce" : ""}`}
      style={
        {
          "--sx": `${shadow}px`,
          "--ring-color": ringColor ?? INK,
          width: dim,
          height: dim,
          flex: "none",
          borderRadius: "50%",
          border: `${border}px solid ${INK}`,
          background: PHASE_BG[phase],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: disabled ? "wait" : "pointer",
          opacity: disabled ? 0.85 : 1,
        } as CSSProperties
      }
    >
      {active ? <WaveBars count={mini ? 3 : 4} mini={mini} /> : <MicGlyph mini={mini} />}
    </button>
  );
}

const monoLabelStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(10,10,10,0.55)",
};

/**
 * Sticky "voice guide" side panel: mirrors a real mic session (phase/onClick passed
 * in by the caller), plus a self-contained running list of campaign-context notes
 * (memory) captured either via a quick "capture context" action or manual typing.
 */
export function VoicePanel({
  question,
  prompt,
  micPhase,
  onMicClick,
  micDisabled,
  onCapture,
}: {
  question: string;
  prompt: string;
  micPhase: MicOrbPhase;
  onMicClick: () => void;
  micDisabled?: boolean;
  onCapture?: () => string;
}) {
  const [memory, setMemory] = useState<string[]>([
    "La voz debe sonar cálida, premium y segura.",
    "Si una opción no encaja, guárdala como contexto de campaña.",
  ]);
  const [manualText, setManualText] = useState("");

  const addToMemory = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setMemory((m) => [...m, trimmed]);
  };

  return (
    <aside
      style={{
        position: "sticky",
        top: 96,
        display: "grid",
        gap: 12,
        padding: 16,
        border: `3px solid ${INK}`,
        borderRadius: RADIUS_SM,
        background: "linear-gradient(180deg, #fff8d9 0%, #fffefa 100%)",
        boxShadow: `6px 6px 0 ${INK}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 16 }}>Guía de voz</span>
        <VoiceStatePill listening={micPhase === "recording"} labelListening="Escuchando" labelIdle="Pausada" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          gap: 12,
          alignItems: "center",
          padding: 12,
          border: `3px solid ${INK}`,
          borderRadius: RADIUS_SM,
          background: CARD,
          boxShadow: `4px 4px 0 ${INK}`,
        }}
      >
        <MicOrb size="mini" phase={micPhase} onClick={onMicClick} disabled={micDisabled} ariaLabel={question} />
        <div>
          <div style={{ fontWeight: 900, fontSize: 13.5, lineHeight: 1.2 }}>{question}</div>
          <div style={{ fontSize: 12, color: "rgba(10,10,10,0.65)", fontWeight: 700, marginTop: 4, lineHeight: 1.4 }}>
            {prompt}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <WaveBars mini />
        </div>
      </div>

      <button
        type="button"
        onClick={() => addToMemory(onCapture?.() ?? "Contexto de voz capturado para la campaña.")}
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
            padding: 11,
            cursor: "pointer",
            "--sx": "3px",
          } as CSSProperties
        }
      >
        Capturar contexto de voz
      </button>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={monoLabelStyle}>Instrucción para la campaña</span>
          <textarea
            rows={2}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Ej. Mi audiencia real son dueños de restaurantes premium."
            style={{
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 600,
              border: `2px solid ${INK}`,
              borderRadius: RADIUS_SM,
              padding: "9px 11px",
              background: CARD,
              resize: "none",
              lineHeight: 1.4,
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            addToMemory(manualText);
            setManualText("");
          }}
          className="nb-press"
          style={
            {
              fontFamily: FONT_SANS,
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: "uppercase",
              background: ACID,
              border: `3px solid ${INK}`,
              borderRadius: RADIUS_SM,
              padding: 10,
              cursor: "pointer",
              "--sx": "3px",
            } as CSSProperties
          }
        >
          Agregar al background
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <span style={monoLabelStyle}>Memoria activa</span>
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 92, overflow: "auto", margin: 0, padding: 0, listStyle: "none" }}>
          {memory.slice(-4).map((item, i) => (
            <li
              key={i}
              title={item}
              style={{
                padding: "6px 9px",
                border: `2px solid ${INK}`,
                borderRadius: RADIUS_PILL,
                background: CARD,
                fontSize: 11,
                fontWeight: 800,
                maxWidth: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
