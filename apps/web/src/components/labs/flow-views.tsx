"use client";

import type { CSSProperties } from "react";

import type { BrandKit } from "@/lib/api";

import {
  ACID,
  ACCENT,
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
  RUN_DEFS,
  STONE,
  SUN,
  textOnSignal,
} from "./defs";
import { buildKitCards, PLACEHOLDER_CARDS } from "./kit-cards";
import { BrandWordmarkLink } from "./brand-wordmark-link";
import { SignOutButton } from "./sign-out-button";
import type { AudioTranscriptionPhase } from "./use-audio-transcription";

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        backgroundImage: gridBg(0.045),
      }}
    >
      <header
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px" }}
      >
        <BrandWordmarkLink />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SignOutButton />
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", color: "rgba(10,10,10,0.55)" }}>
            AI MARKETING LAB · v0.4
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 640 }}>
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
            <span style={{ border: `2px solid ${INK}`, background: ACID, padding: "5px 12px" }}>01 · BRAND</span>
            <span
              style={{
                border: `2px solid ${INK}`,
                borderLeft: "none",
                background: CARD,
                color: "rgba(10,10,10,0.4)",
                padding: "5px 12px",
              }}
            >
              02 · BRAND KIT
            </span>
            <span
              style={{
                border: `2px solid ${INK}`,
                borderLeft: "none",
                background: CARD,
                color: "rgba(10,10,10,0.4)",
                padding: "5px 12px",
              }}
            >
              03 · CAMPAIGN
            </span>
          </div>

          <div style={{ background: CARD, border: `3px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}` }}>
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
                  Create your brand workspace.
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 8 }}>
                  One workspace per brand. Agents read everything you put here.
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={monoLabel}>BRAND NAME</span>
                <input
                  value={brandInput}
                  onChange={(e) => onBrandInput(e.target.value)}
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 16,
                    fontWeight: 700,
                    border: `3px solid ${INK}`,
                    borderRadius: 0,
                    padding: "12px 14px",
                    background: PAPER,
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={monoLabel}>WHAT DO YOU SELL?</span>
                <textarea
                  rows={2}
                  value={descInput}
                  onChange={(e) => onDescInput(e.target.value)}
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 13.5,
                    fontWeight: 500,
                    border: `3px solid ${INK}`,
                    borderRadius: 0,
                    padding: "12px 14px",
                    background: PAPER,
                    resize: "none",
                    lineHeight: 1.5,
                  }}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={monoLabel}>MARKET</span>
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
                Initialize workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ KIT GENERATION (step 02) ═══════════ */

export function KitgenView({
  brandKit,
  steps,
  loading,
  error,
  goNewCampaign,
}: {
  brandKit: BrandKit | null;
  steps: string[];
  loading: boolean;
  error: string | null;
  goNewCampaign: () => void;
}) {
  const kitAllDone = !loading && !error && !!brandKit;
  const kitCards = brandKit ? buildKitCards(brandKit) : [];
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontFamily: FONT_BLACK, fontSize: 24 }}>Brand Agent is building your kit</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 4 }}>
            Identity, voice and persona — generated once, reused by every agent.
          </div>
        </div>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            border: `2px solid ${INK}`,
            padding: "4px 10px",
            background: error ? CORAL : SUN,
            animation: kitAllDone || error ? "none" : "pv-pulse 1s ease-in-out infinite",
          }}
        >
          {error ? "ERROR" : kitAllDone ? "READY ✓" : "GENERATING"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(kitCards.length ? kitCards : PLACEHOLDER_CARDS).map((kc) => {
            const done = kitAllDone;
            return (
              <div
                key={kc.tag}
                style={{
                  background: kc.bg,
                  color: kc.ink,
                  border: `3px solid ${INK}`,
                  boxShadow: `5px 5px 0 ${INK}`,
                  padding: 18,
                  minHeight: 118,
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  opacity: done ? 1 : 0.55,
                  animation: done ? "pv-rise 0.4s ease both" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em" }}>
                    {kc.tag}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700 }}>{done ? "✓" : "…"}</span>
                </div>
                {done ? (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.25 }}>{kc.title}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.45, opacity: 0.75 }}>{kc.body}</div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        border: `3px solid ${kc.ink}`,
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "pv-spin0 0.8s linear infinite",
                        opacity: 0.4,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Terminal log */}
        <div
          style={{
            background: INK,
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${ACID}`,
            padding: "16px 18px",
            fontFamily: FONT_MONO,
            fontSize: 11,
            lineHeight: 1.9,
            color: ACID,
            minHeight: 280,
            position: "sticky",
            top: 86,
          }}
        >
          <div
            style={{
              color: "rgba(244,242,236,0.5)",
              borderBottom: "1px solid rgba(244,242,236,0.2)",
              paddingBottom: 8,
              marginBottom: 10,
            }}
          >
            brand_agent.log
          </div>
          {loading && <div style={{ animation: "pv-rise 0.3s ease both" }}>contacting brand agent…</div>}
          {error && (
            <div style={{ color: CORAL, animation: "pv-rise 0.3s ease both" }}>error: {error}</div>
          )}
          {steps.map((step, i) => (
            <div key={i} style={{ animation: "pv-rise 0.3s ease both" }}>
              {step}
            </div>
          ))}
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 13,
              background: ACID,
              animation: "pv-blink 1s step-end infinite",
              verticalAlign: -2,
            }}
          />
        </div>
      </div>

      {kitAllDone && (
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", animation: "pv-rise 0.4s ease both" }}>
          <button
            onClick={goNewCampaign}
            className="nb-press"
            style={
              {
                fontFamily: FONT_SANS,
                fontSize: 15,
                fontWeight: 800,
                textTransform: "uppercase",
                background: ACID,
                border: `3px solid ${INK}`,
                padding: "16px 34px",
                cursor: "pointer",
                "--sx": "6px",
              } as CSSProperties
            }
          >
            Brand kit ready — create first campaign →
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════ NEW CAMPAIGN (step 03) ═══════════ */

const DELIVERABLES = ["Strategy", "Meta audiences", "Copy ES/EN + A/B", "Static creatives", "Video script", "Voiceover ES/EN"];

export function NewCampaignView({
  goalInput,
  onGoalInput,
  goalPhase,
  goalMessage,
  goalTranscriptionId,
  goalOrbClick,
  deployAgents,
}: {
  goalInput: string;
  onGoalInput: (v: string) => void;
  goalPhase: AudioTranscriptionPhase;
  goalMessage: string;
  goalTranscriptionId: string | null;
  goalOrbClick: () => void;
  deployAgents: () => void;
}) {
  const recording = goalPhase === "recording";
  const uploading = goalPhase === "uploading";
  return (
    <div style={{ maxWidth: 760, margin: "24px auto 0" }}>
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
          01 · BRAND ✓
        </span>
        <span
          style={{
            border: `2px solid ${INK}`,
            borderLeft: "none",
            background: CARD,
            color: "rgba(10,10,10,0.4)",
            padding: "5px 12px",
          }}
        >
          02 · BRAND KIT ✓
        </span>
        <span style={{ border: `2px solid ${INK}`, borderLeft: "none", background: ACID, padding: "5px 12px" }}>
          03 · CAMPAIGN
        </span>
      </div>

      <div
        style={{
          background: CARD,
          border: `3px solid ${INK}`,
          boxShadow: `8px 8px 0 ${INK}`,
          padding: "30px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div>
          <div style={{ fontFamily: FONT_BLACK, fontSize: 28, letterSpacing: "-0.01em", lineHeight: 1.05 }}>
            What are we selling?
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 8 }}>
            Type it or say it. The agents take it from here.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <textarea
            rows={3}
            value={goalInput}
            onChange={(e) => onGoalInput(e.target.value)}
            placeholder="e.g. Launch our noise-canceling earbuds for young professionals in LatAm…"
            style={{
              flex: 1,
              fontFamily: FONT_SANS,
              fontSize: 15,
              fontWeight: 600,
              border: `3px solid ${INK}`,
              borderRadius: 0,
              padding: "14px 16px",
              background: PAPER,
              resize: "none",
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={goalOrbClick}
            aria-label={recording ? "Stop recording and transcribe" : "Record your goal"}
            className="nb-press"
            disabled={uploading}
            style={
              {
                flex: "none",
                width: 72,
                border: `3px solid ${INK}`,
                cursor: uploading ? "wait" : "pointer",
                background: recording ? CORAL : uploading ? SUN : ACID,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: uploading ? 0.8 : 1,
                transition: "background 0.2s, transform 0.08s, box-shadow 0.08s",
                "--sx": "4px",
              } as CSSProperties
            }
          >
            {recording || uploading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, height: 26 }}>
                {[
                  "pv-bar 0.8s ease-in-out infinite",
                  "pv-bar 0.6s ease-in-out 0.12s infinite",
                  "pv-bar 1s ease-in-out 0.05s infinite",
                  "pv-bar 0.7s ease-in-out 0.2s infinite",
                ].map((animation, i) => (
                  <div key={i} style={{ width: 4, height: 26, background: INK, animation }} />
                ))}
              </div>
            ) : (
              <div style={{ width: 15, height: 22, border: `3px solid ${INK}`, borderRadius: 8, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -9,
                    transform: "translateX(-50%)",
                    width: 3,
                    height: 6,
                    background: INK,
                  }}
                />
              </div>
            )}
          </button>
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            fontWeight: 600,
            color: goalPhase === "error" || goalPhase === "unsupported" ? CORAL : "rgba(10,10,10,0.5)",
            lineHeight: 1.4,
            marginTop: -12,
          }}
        >
          {goalMessage}
        </div>
        {goalTranscriptionId && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: "rgba(10,10,10,0.45)", marginTop: -20 }}>
            BRIEF SAVED · {goalTranscriptionId.slice(0, 8)}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={monoLabel}>DELIVERABLES</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DELIVERABLES.map((d) => (
              <span key={d} style={{ fontSize: 11.5, fontWeight: 700, border: `2px solid ${INK}`, background: ACID, padding: "5px 10px" }}>
                {d}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={deployAgents}
          className="nb-press"
          style={
            {
              fontFamily: FONT_SANS,
              fontSize: 15,
              fontWeight: 800,
              textTransform: "uppercase",
              background: INK,
              color: ACID,
              border: `3px solid ${INK}`,
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
          Deploy agents
        </button>
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
        <div style={{ fontFamily: FONT_BLACK, fontSize: 24 }}>Agents deployed</div>
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
          {transport ? ` · transport: ${transport.toUpperCase()}` : ""}
          {error ? ` · ${error}` : ""}
        </div>
      </div>
    </div>
  );
}
