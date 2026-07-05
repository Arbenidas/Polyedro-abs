"use client";

import type { CSSProperties } from "react";

import type { Brand, BrandKit, CampaignDashboard } from "@/lib/api";

import {
  ACID,
  CARD,
  AGENT_DEFS,
  cardShell,
  CORAL,
  CYAN,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  INK,
  PAPER,
  PIPE_STEPS,
  STONE,
  SUN,
  textOnSignal,
  VOLT,
} from "./defs";

const viewHeading: CSSProperties = { fontFamily: FONT_BLACK, fontSize: 24 };
const viewSub: CSSProperties = { fontSize: 13, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 4 };
const kitTag: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  marginBottom: 14,
};

/* ═══════════ BRAND KIT ═══════════ */

export function BrandkitView({ brand, brandKit }: { brand: Brand | null; brandKit: BrandKit | null }) {
  const brandName = brand?.name ?? "Tu marca";

  if (!brandKit) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <div style={viewHeading}>Brand Kit</div>
          <div style={viewSub}>Todavía no se generó el brand kit — primero completa el onboarding.</div>
        </div>
      </div>
    );
  }

  const palette = brandKit.colorPalette;
  const paletteSwatches = palette
    ? [
        { label: "PRIMARIO", color: palette.primary },
        { label: "SECUNDARIO", color: palette.secondary },
        { label: "ACENTO", color: palette.accent },
        ...(palette.neutrals ?? []).slice(0, 2).map((color, i) => ({ label: `NEUTRO ${i + 1}`, color })),
      ]
    : [];

  return (
    <div>
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
          <div style={viewHeading}>Brand Kit</div>
          <div style={viewSub}>Generado por el Agente de Marca · estado: {brandKit.status}</div>
        </div>
        <button
          onClick={onRegenerate}
          disabled={!onRegenerate || regenerating}
          className="nb-press"
          style={
            {
              fontFamily: FONT_SANS,
              fontSize: 12.5,
              fontWeight: 800,
              textTransform: "uppercase",
              background: CARD,
              border: `3px solid ${INK}`,
              padding: "9px 16px",
              cursor: !onRegenerate || regenerating ? "not-allowed" : "pointer",
              opacity: !onRegenerate || regenerating ? 0.55 : 1,
              "--sx": "4px",
            } as CSSProperties
          }
        >
          ↻ Regenerar kit
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 20 }}>
        <div
          style={{
            background: INK,
            color: PAPER,
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${INK}`,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div style={{ ...kitTag, marginBottom: 0, color: ACID }}>CONCEPTO DE LOGO</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: ACID,
                border: `3px solid ${PAPER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_BLACK,
                fontSize: 30,
                color: INK,
              }}
            >
              {brandName[0]?.toUpperCase()}
            </div>
            <div style={{ fontFamily: FONT_BLACK, fontSize: 26, letterSpacing: "0.02em", textTransform: "uppercase" }}>
              {brandName}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(244,242,236,0.7)", lineHeight: 1.5 }}>
            {brandKit.logoPrompt ?? "Todavía no hay prompt de logo disponible."}
          </div>
        </div>

        <div style={{ ...cardShell, padding: 22 }}>
          <div style={{ ...kitTag, marginBottom: 16 }}>PALETA</div>
          {paletteSwatches.length ? (
            <>
              <div style={{ display: "flex", gap: 0, border: `2px solid ${INK}`, height: 74 }}>
                {paletteSwatches.map((s, i) => (
                  <div
                    key={s.label}
                    style={{ flex: 1, background: s.color, borderLeft: i === 0 ? "none" : `2px solid ${INK}` }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  marginTop: 8,
                  color: "rgba(10,10,10,0.6)",
                }}
              >
                {paletteSwatches.map((s) => (
                  <span key={s.label}>{s.label}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "rgba(10,10,10,0.6)" }}>Todavía no se generó la paleta.</div>
          )}
        </div>

        <div style={{ ...cardShell, padding: 22 }}>
          <div style={kitTag}>VOZ Y TONO · BILINGÜE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, fontWeight: 500 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  fontWeight: 700,
                  background: INK,
                  color: PAPER,
                  padding: "2px 6px",
                  flex: "none",
                }}
              >
                ES
              </span>
              {brandKit.toneOfVoice?.es ?? "Todavía no se generó el tono de voz."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  fontWeight: 700,
                  background: INK,
                  color: PAPER,
                  padding: "2px 6px",
                  flex: "none",
                }}
              >
                EN
              </span>
              {brandKit.toneOfVoice?.en ?? "Todavía no se generó el tono de voz."}
            </div>
          </div>
        </div>

        <div style={{ ...cardShell, padding: 22 }}>
          <div style={kitTag}>BUYER PERSONA</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
            {brandKit.buyerPersona?.name ?? "Todavía no se generó la persona"}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.55, color: "rgba(10,10,10,0.75)" }}>
            {[
              brandKit.buyerPersona?.occupation,
              brandKit.buyerPersona?.age && `Edad ${brandKit.buyerPersona.age}`,
              ...(brandKit.buyerPersona?.goals ?? []),
              ...(brandKit.buyerPersona?.painPoints ?? []),
              brandKit.buyerPersona?.notes,
            ]
              .filter(Boolean)
              .join(". ")}
          </div>
        </div>

        <div style={{ ...cardShell, background: ACID, padding: 22 }}>
          <div style={kitTag}>PROPUESTA DE VALOR</div>
          <div style={{ fontFamily: FONT_BLACK, fontSize: 20, lineHeight: 1.15 }}>
            {brandKit.valueProposition?.es ?? "Todavía no se generó la propuesta de valor."}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
            {(brandKit.keyMessages?.es ?? []).map((t) => (
              <span key={t} style={{ fontSize: 11.5, fontWeight: 700, border: `2px solid ${INK}`, background: PAPER, padding: "4px 9px" }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ ...cardShell, padding: 22 }}>
          <div style={kitTag}>ESTILO VISUAL</div>
          <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.6, color: "rgba(10,10,10,0.75)" }}>
            {[brandKit.visualStyle?.mood, brandKit.visualStyle?.imageryStyle, brandKit.visualStyle?.typography]
              .filter(Boolean)
              .join(" ")  || "Todavía no se generó el estilo visual."}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ AGENTS ═══════════ */

type AgentLive = { status: string; dot: string; pulse: boolean; count: number };

const isApproved = (status?: string | null) => status === "approved" || status === "ready_to_publish";

/** Deriva estado real por agente desde el dashboard de la campaña activa.
 *  Devuelve null cuando no hay dashboard → la vista cae al mock estático. */
function agentLiveState(name: string, d: CampaignDashboard): AgentLive | null {
  const a = d.agents;
  const single = (present: boolean, approved: boolean): AgentLive =>
    present
      ? approved
        ? { status: "READY", dot: ACID, pulse: false, count: 1 }
        : { status: "REVIEW", dot: SUN, pulse: true, count: 1 }
      : { status: "IDLE", dot: STONE, pulse: false, count: 0 };
  const collection = <T extends { status: string }>(items: T[]): AgentLive => {
    if (items.length === 0) return { status: "IDLE", dot: STONE, pulse: false, count: 0 };
    const approved = items.filter((i) => isApproved(i.status)).length;
    return approved === items.length
      ? { status: "READY", dot: ACID, pulse: false, count: items.length }
      : { status: "REVIEW", dot: SUN, pulse: true, count: items.length };
  };

  switch (name) {
    case "Brand Agent":
      return single(!!d.brandKit, isApproved(d.brandKit?.status));
    case "Strategy Agent":
      return single(!!a.strategy, isApproved(a.strategy?.status));
    case "Meta Ads Agent":
      return collection(a.adCopies);
    case "Creative Agent":
      return collection(a.visualAssets);
    case "Video Agent":
      return collection(a.videoScripts);
    case "Voice Agent":
      return collection(a.voiceovers);
    case "Automation Agent": {
      const ex = d.latestExport;
      if (!ex) return { status: "STANDBY", dot: SUN, pulse: false, count: 0 };
      return ex.exportStatus === "sent"
        ? { status: "SENT", dot: ACID, pulse: false, count: 1 }
        : ex.exportStatus === "failed"
          ? { status: "FAILED", dot: CORAL, pulse: false, count: 1 }
          : { status: "PENDING", dot: CYAN, pulse: true, count: 1 };
    }
    case "Approval Agent":
      return {
        status: d.progress.readyToPublish ? "READY" : d.progress.approved > 0 ? "ACTIVE" : "IDLE",
        dot: d.progress.readyToPublish ? ACID : d.progress.approved > 0 ? CYAN : STONE,
        pulse: !d.progress.readyToPublish && d.progress.approved > 0,
        count: d.progress.approved,
      };
    default:
      return null;
  }
}

export function AgentsView({ dashboard = null }: { dashboard?: CampaignDashboard | null }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={viewHeading}>Agentes</div>
        <div style={viewSub}>8 colaboradores especializados. Tú apruebas; ellos ejecutan.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 18 }}>
        {AGENT_DEFS.map((ag) => {
          const live = dashboard ? agentLiveState(ag.name, dashboard) : null;
          const status = live?.status ?? ag.status;
          const dot = live?.dot ?? ag.dot;
          const pulse = live?.pulse ?? ag.pulse;
          return (
            <div key={ag.name} style={{ ...cardShell, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    background: ag.color,
                    color: textOnSignal(ag.color),
                    border: `2px solid ${INK}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_BLACK,
                    fontSize: 13,
                  }}
                >
                  {ag.glyph}
                </div>
                <span
                  style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700 }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: dot,
                      border: `1.5px solid ${INK}`,
                      animation: pulse ? "pv-pulse 1.4s ease-in-out infinite" : "none",
                    }}
                  />
                  {status}
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{ag.name}</div>
              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, color: "rgba(10,10,10,0.65)" }}>{ag.role}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  color: "rgba(10,10,10,0.55)",
                  borderTop: `2px solid ${INK}`,
                  paddingTop: 9,
                  marginTop: 2,
                }}
              >
                <span>{ag.tool}</span>
                <span>{live ? `${live.count} ASSETS` : `${ag.runs} RUNS`}</span>
              </div>
              <span
                style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: ag.dot,
                    border: `1.5px solid ${INK}`,
                    animation: ag.pulse ? "pv-pulse 1.4s ease-in-out infinite" : "none",
                  }}
                />
                {ag.status}
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{ag.name}</div>
            <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, color: "rgba(10,10,10,0.65)" }}>{ag.role}</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: FONT_MONO,
                fontSize: 9.5,
                color: "rgba(10,10,10,0.55)",
                borderTop: `2px solid ${INK}`,
                paddingTop: 9,
                marginTop: 2,
              }}
            >
              <span>{ag.tool}</span>
              <span>{ag.runs} EJECUCIONES</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ AUTOMATION ═══════════ */

const EXPORT_TAG: Record<string, { label: string; bg: string }> = {
  pending: { label: "PENDING", bg: CYAN },
  sent: { label: "SENT ✓", bg: ACID },
  failed: { label: "FAILED", bg: CORAL },
};

export function AutomationView({ dashboard = null }: { dashboard?: CampaignDashboard | null }) {
  const exp = dashboard?.latestExport ?? null;
  const tag = exp ? (EXPORT_TAG[exp.exportStatus] ?? EXPORT_TAG.pending!) : null;

  // Estado por paso derivado del export real: 'done' | 'active' | 'error' | null (estático).
  const stepNode = (i: number): { bg: string; pulse: boolean } | null => {
    if (!exp) return null;
    if (exp.exportStatus === "sent") return { bg: ACID, pulse: false };
    if (i <= 2) return { bg: ACID, pulse: false };
    if (i === 3) return exp.exportStatus === "failed" ? { bg: CORAL, pulse: false } : { bg: VOLT, pulse: true };
    return { bg: CARD, pulse: false };
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={viewHeading}>Pipeline de automatización</div>
        <div style={viewSub}>
          n8n + Supabase → Meta Ads. Se activa cuando una campaña llega a{" "}
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              background: VOLT,
              color: CARD,
              padding: "1px 6px",
              border: `1.5px solid ${INK}`,
            }}
          >
            READY_TO_PUBLISH
          </span>
        </div>
      </div>

      {exp && tag && (
        <div
          style={{
            ...cardShell,
            maxWidth: 660,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: FONT_MONO, fontSize: 10.5 }}>
            <span style={{ fontWeight: 700 }}>LATEST EXPORT · {dashboard?.campaign.name}</span>
            <span style={{ color: "rgba(10,10,10,0.6)" }}>
              {exp.n8nExecutionId ? `exec ${exp.n8nExecutionId}` : "no execution id"}
              {exp.completedAt ? ` · ${new Date(exp.completedAt).toLocaleString()}` : ""}
            </span>
            {exp.errorMessage && <span style={{ color: CORAL }}>{exp.errorMessage}</span>}
          </div>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              border: `2px solid ${INK}`,
              padding: "4px 10px",
              background: tag.bg,
              color: textOnSignal(tag.bg),
              flex: "none",
            }}
          >
            {tag.label}
          </span>
        </div>
      )}

      <div style={{ maxWidth: 660, display: "flex", flexDirection: "column" }}>
        {PIPE_STEPS.map((ps, i) => {
          const node = stepNode(i);
          const nodeBg = node?.bg ?? ps.nodeBg;
          const nodePulse = node?.pulse ?? ps.pulse;
          return (
          <div key={ps.n} style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 34 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  border: `3px solid ${INK}`,
                  background: nodeBg,
                  color: textOnSignal(nodeBg),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  animation: nodePulse ? "pv-pulse 1.2s ease-in-out infinite" : "none",
                }}
              >
                {ps.n}
              </div>
              {ps.hasLine && <div style={{ width: 3, flex: 1, background: INK, minHeight: 26 }} />}
            </div>
            <div
              style={{
                background: CARD,
                border: `3px solid ${INK}`,
                boxShadow: `4px 4px 0 ${INK}`,
                padding: "14px 18px",
                flex: 1,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{ps.title}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 3 }}>{ps.desc}</div>
              </div>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  fontWeight: 700,
                  border: `2px solid ${INK}`,
                  padding: "3px 8px",
                  background: ps.tagBg,
                  color: textOnSignal(ps.tagBg),
                  flex: "none",
                }}
              >
                {ps.tag}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
