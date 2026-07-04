"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  ACCENT,
  type AssetId,
  type AssetStatus,
  cardShell,
  CORAL,
  CYAN,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  INK,
  PAPER,
  type Statuses,
  STONE,
  SUN,
  VOLT,
  wave,
} from "./defs";

function chipFor(st: AssetStatus) {
  switch (st) {
    case "generating":
      return { bg: SUN, label: "GENERATING", anim: "pv-pulse 1s ease-in-out infinite" };
    case "review":
      return { bg: CORAL, label: "REVIEW", anim: "none" };
    case "approved":
      return { bg: ACCENT, label: "APPROVED ✓", anim: "none" };
    default:
      return { bg: STONE, label: "DRAFT", anim: "none" };
  }
}

function AssetCard({
  dotColor,
  agentLabel,
  status,
  onApprove,
  onRegen,
  regenLabel = "↻ Regenerate",
  children,
}: {
  dotColor: string;
  agentLabel: string;
  status: AssetStatus;
  onApprove: () => void;
  onRegen: () => void;
  regenLabel?: string;
  children: ReactNode;
}) {
  const chip = chipFor(status);
  const canApprove = status === "review";
  return (
    <div style={{ ...cardShell, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 16px",
          borderBottom: `2px solid ${INK}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 10, height: 10, background: dotColor, border: `1.5px solid ${INK}` }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>{agentLabel}</span>
        </div>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9.5,
            fontWeight: 700,
            border: `2px solid ${INK}`,
            padding: "3px 8px",
            background: chip.bg,
            animation: chip.anim,
          }}
        >
          {chip.label}
        </span>
      </div>
      {children}
      <div style={{ display: "flex", borderTop: `2px solid ${INK}` }}>
        <button
          onClick={onApprove}
          disabled={!canApprove}
          className="hov-accent"
          style={{
            flex: 1,
            fontFamily: FONT_SANS,
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            padding: 11,
            border: "none",
            borderRight: `2px solid ${INK}`,
            background: status === "approved" ? ACCENT : "#FFFFFF",
            cursor: canApprove ? "pointer" : "default",
          }}
        >
          {status === "approved"
            ? "✓ Approved"
            : status === "generating"
              ? "Generating…"
              : status === "draft"
                ? "Awaiting asset"
                : "✓ Approve"}
        </button>
        <button
          onClick={onRegen}
          className="hov-sun"
          style={{
            flex: 1,
            fontFamily: FONT_SANS,
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            padding: 11,
            border: "none",
            background: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          {regenLabel}
        </button>
      </div>
    </div>
  );
}

const specTag: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  background: PAPER,
  border: `1.5px solid ${INK}`,
  padding: "2px 6px",
  flex: "none",
};

const langTag: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 700,
  background: INK,
  color: PAPER,
  display: "inline-block",
  padding: "1px 6px",
  marginBottom: 7,
};

function WaveRow({
  playing,
  onToggle,
  heights,
  meta,
}: {
  playing: boolean;
  onToggle: () => void;
  heights: number[];
  meta: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, border: `2px solid ${INK}`, padding: "10px 12px" }}>
      <button
        onClick={onToggle}
        style={{
          width: 34,
          height: 34,
          flex: "none",
          border: `2px solid ${INK}`,
          background: playing ? ACCENT : "#FFFFFF",
          cursor: "pointer",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2.5, height: 26 }}>
        {heights.map((h, i) => (
          <div
            key={i}
            style={{
              width: 3.5,
              height: h,
              background: INK,
              animation: playing
                ? `pv-bar ${(0.6 + (i % 5) * 0.13).toFixed(2)}s ease-in-out ${(i * 0.04).toFixed(2)}s infinite`
                : "none",
            }}
          />
        ))}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, flex: "none" }}>{meta}</div>
    </div>
  );
}

export function CampaignView({
  statuses,
  approve,
  regen,
  copyVar,
  setCopyVar,
  copyUrgent,
  brandName,
  playEs,
  playEn,
  togglePlayEs,
  togglePlayEn,
  pushed,
  cmdPhase,
  cmdText,
  voiceCmdClick,
}: {
  statuses: Statuses;
  approve: (id: AssetId) => void;
  regen: (id: AssetId) => void;
  copyVar: "A" | "B";
  setCopyVar: (v: "A" | "B") => void;
  copyUrgent: boolean;
  brandName: string;
  playEs: boolean;
  playEn: boolean;
  togglePlayEs: () => void;
  togglePlayEn: () => void;
  pushed: boolean;
  cmdPhase: "idle" | "listening" | "typing";
  cmdText: string;
  voiceCmdClick: () => void;
}) {
  const approvedCount = Object.values(statuses).filter((x) => x === "approved").length;
  const brandUpper = brandName.toUpperCase();

  const copyEsHeadline =
    copyVar === "B"
      ? "36 horas de batería. Cero excusas."
      : copyUrgent
        ? "Últimos días: tu enfoque no puede esperar."
        : "Tu tramo del metro, en silencio total.";
  const copyEsBody =
    copyVar === "B"
      ? "ANC adaptativo para estudiar, viajar y trabajar. Pre-ordena con 20% off."
      : copyUrgent
        ? `Audífonos ANC ${brandName} — 36h de batería. Pre-ordena antes del viernes y llévate 20% off.`
        : `Audífonos ${brandName} con cancelación de ruido adaptativa y 36h de batería. Pre-ordena con 20% off.`;
  const copyEnHeadline = copyVar === "B" ? "36 hours of battery. Zero excuses." : "Your commute just went quiet.";
  const copyEnBody =
    copyVar === "B"
      ? "Adaptive ANC for studying, commuting and deep work. Pre-order and save 20%."
      : `${brandName} ANC earbuds — 36h battery, adaptive noise canceling. Pre-order and save 20%.`;

  return (
    <div>
      {pushed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: VOLT,
            color: "#FFFFFF",
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${INK}`,
            padding: "14px 18px",
            marginBottom: 22,
            animation: "pv-rise 0.4s ease both",
          }}
        >
          <div style={{ width: 14, height: 14, background: ACCENT, border: `2px solid ${INK}`, animation: "pv-spin 1.2s linear infinite" }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600 }}>
            READY_TO_PUBLISH → n8n pipeline queued · packaging assets → Supabase → Meta Ads draft upload
          </div>
        </div>
      )}

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
          <div style={{ fontFamily: FONT_BLACK, fontSize: 24, letterSpacing: "-0.01em" }}>CMP-004 · Earbuds Launch — LatAm</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 4 }}>
            Noise-canceling earbuds · young professionals &amp; students · MX / CO / CL · ES/EN
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600 }}>{approvedCount}/6 APPROVED</div>
          <div style={{ width: 150, height: 14, border: `2px solid ${INK}`, background: "#FFFFFF" }}>
            <div
              style={{
                height: "100%",
                background: ACCENT,
                width: `${Math.round((approvedCount / 6) * 100)}%`,
                transition: "width 0.4s",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(370px, 1fr))", gap: 20 }}>
        {/* STRATEGY */}
        <AssetCard
          dotColor={VOLT}
          agentLabel="STRATEGY AGENT"
          status={statuses.strategy}
          onApprove={() => approve("strategy")}
          onRegen={() => regen("strategy")}
        >
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Launch strategy</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 500 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={specTag}>OBJECTIVE</span> Conversions — earbuds pre-orders, 3-week burst
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={specTag}>FUNNEL</span> 60% cold reach · 25% retargeting · 15% lookalike
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={specTag}>ANGLE</span> &quot;Silence the commute&quot; — focus &amp; productivity, not specs
              </div>
            </div>
          </div>
        </AssetCard>

        {/* AUDIENCES */}
        <AssetCard
          dotColor={CYAN}
          agentLabel="META ADS AGENT"
          status={statuses.audiences}
          onApprove={() => approve("audiences")}
          onRegen={() => regen("audiences")}
        >
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Audience segmentation</div>
            <div style={{ border: `2px solid ${INK}`, padding: "10px 12px", background: PAPER }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                SEG A · YOUNG PROFESSIONALS 24–32
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                MX · CO · CL — commuting, productivity apps, remote work. Est. reach 2.1M
              </div>
            </div>
            <div style={{ border: `2px solid ${INK}`, padding: "10px 12px", background: PAPER }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                SEG B · UNI STUDENTS 18–24
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>study music, gaming audio, budget tech. Est. reach 3.4M</div>
            </div>
          </div>
        </AssetCard>

        {/* COPY */}
        <AssetCard
          dotColor={CORAL}
          agentLabel="META ADS AGENT · COPY"
          status={statuses.copy}
          onApprove={() => approve("copy")}
          onRegen={() => regen("copy")}
        >
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Ad copy</div>
              <div style={{ display: "flex", gap: 0 }}>
                <button
                  onClick={() => setCopyVar("A")}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    border: `2px solid ${INK}`,
                    padding: "3px 10px",
                    cursor: "pointer",
                    background: copyVar === "A" ? ACCENT : "#FFFFFF",
                  }}
                >
                  VAR A
                </button>
                <button
                  onClick={() => setCopyVar("B")}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    border: `2px solid ${INK}`,
                    borderLeft: "none",
                    padding: "3px 10px",
                    cursor: "pointer",
                    background: copyVar === "B" ? ACCENT : "#FFFFFF",
                  }}
                >
                  VAR B
                </button>
              </div>
            </div>
            <div style={{ border: `2px solid ${INK}`, padding: "10px 12px" }}>
              <div style={langTag}>ES</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{copyEsHeadline}</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 5, color: "rgba(10,10,10,0.7)" }}>{copyEsBody}</div>
            </div>
            <div style={{ border: `2px solid ${INK}`, padding: "10px 12px" }}>
              <div style={langTag}>EN</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{copyEnHeadline}</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 5, color: "rgba(10,10,10,0.7)" }}>{copyEnBody}</div>
            </div>
          </div>
        </AssetCard>

        {/* CREATIVES */}
        <AssetCard
          dotColor={CORAL}
          agentLabel="CREATIVE AGENT · STATICS"
          status={statuses.creatives}
          onApprove={() => approve("creatives")}
          onRegen={() => regen("creatives")}
        >
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Static creatives · 1080×1080</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: INK,
                  color: ACCENT,
                  border: `2px solid ${INK}`,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: FONT_MONO,
                    fontSize: 8.5,
                    letterSpacing: "0.14em",
                    opacity: 0.8,
                  }}
                >
                  <span>{brandUpper}</span>
                  <span>A</span>
                </div>
                <div
                  style={{
                    flex: 1,
                    margin: "10px 0",
                    border: `1.5px dashed ${ACCENT}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.9,
                    background:
                      "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(198,244,50,0.08) 6px, rgba(198,244,50,0.08) 7px)",
                  }}
                >
                  <span style={{ fontFamily: FONT_MONO, fontSize: 8.5 }}>[ earbuds shot ]</span>
                </div>
                <div style={{ fontFamily: FONT_BLACK, fontSize: 15, lineHeight: 1.05, textTransform: "uppercase" }}>
                  Silence the commute.
                </div>
              </div>
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: ACCENT,
                  color: INK,
                  border: `2px solid ${INK}`,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: FONT_MONO,
                    fontSize: 8.5,
                    letterSpacing: "0.14em",
                  }}
                >
                  <span>{brandUpper}</span>
                  <span>B</span>
                </div>
                <div style={{ fontFamily: FONT_BLACK, fontSize: 26, lineHeight: 0.95 }}>
                  36H
                  <br />
                  BATTERY.
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600 }}>ANC EARBUDS — PRE-ORDER −20%</div>
              </div>
            </div>
          </div>
        </AssetCard>

        {/* VIDEO SCRIPT */}
        <AssetCard
          dotColor={SUN}
          agentLabel="VIDEO AGENT"
          status={statuses.video}
          onApprove={() => approve("video")}
          onRegen={() => regen("video")}
        >
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Short video script · 15s Reels</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 500 }}>
              {[
                ["0:00–03", "Chaotic metro sounds — close-up: earbud goes in. Sudden silence."],
                ["0:03–09", 'Split shots: studying, commuting, deep work. On-screen: "36h. Zero ruido."'],
                ["0:09–15", 'Product spin + price card. VO CTA + "Pre-ordena hoy — 20% off."'],
              ].map(([t, s]) => (
                <div key={t} style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, flex: "none", width: 52 }}>{t}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </AssetCard>

        {/* VOICEOVER */}
        <AssetCard
          dotColor={ACCENT}
          agentLabel="VOICE AGENT · ELEVENLABS"
          status={statuses.voice}
          onApprove={() => approve("voice")}
          onRegen={() => regen("voice")}
          regenLabel={statuses.voice === "draft" ? "⚡ Generate" : "↻ Regenerate"}
        >
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Voiceovers</div>
            {statuses.voice === "draft" ? (
              <div
                style={{
                  border: `2px dashed ${INK}`,
                  padding: 18,
                  textAlign: "center",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "rgba(10,10,10,0.55)",
                }}
              >
                No voiceover yet. Generate from the approved video script.
              </div>
            ) : (
              <>
                <WaveRow playing={playEs} onToggle={togglePlayEs} heights={wave(1)} meta="ES · VALENTINA · 0:14" />
                <WaveRow playing={playEn} onToggle={togglePlayEn} heights={wave(2)} meta="EN · NOAH · 0:15" />
              </>
            )}
          </div>
        </AssetCard>
      </div>

      {/* Voice command bar */}
      <div
        style={{
          position: "fixed",
          left: "calc(250px + 26px)",
          right: 26,
          bottom: 22,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: INK,
          color: PAPER,
          border: `3px solid ${INK}`,
          padding: "11px 13px",
          boxShadow: `6px 6px 0 ${ACCENT}`,
        }}
      >
        <button
          onClick={voiceCmdClick}
          aria-label="Voice command"
          style={{
            flex: "none",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `2.5px solid ${PAPER}`,
            cursor: "pointer",
            background: cmdPhase === "listening" ? CORAL : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cmdPhase === "listening" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3, height: 18 }}>
              {[
                "pv-bar 0.8s ease-in-out infinite",
                "pv-bar 0.6s ease-in-out 0.12s infinite",
                "pv-bar 1s ease-in-out 0.05s infinite",
              ].map((animation, i) => (
                <div key={i} style={{ width: 3, height: 18, background: PAPER, animation }} />
              ))}
            </div>
          ) : (
            <div style={{ width: 11, height: 17, border: `2.5px solid ${PAPER}`, borderRadius: 7 }} />
          )}
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13.5,
            fontWeight: 600,
            color: cmdText || cmdPhase !== "idle" ? PAPER : "rgba(244,242,236,0.5)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {cmdPhase === "listening"
            ? "Listening…"
            : cmdText || "Voice command — try “regenerate the Spanish headline with more urgency”"}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            border: "2px solid rgba(244,242,236,0.35)",
            padding: "5px 10px",
            flex: "none",
          }}
        >
          VOICE COMMANDS · ES/EN
        </div>
      </div>
    </div>
  );
}
