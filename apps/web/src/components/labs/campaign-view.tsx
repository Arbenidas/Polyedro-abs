"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { CampaignAdCopy, CampaignCreativeAsset, CampaignDashboard } from "@/lib/api";
import {
  ACID,
  type AssetId,
  type AssetStatus,
  CARD,
  cardShell,
  CORAL,
  CYAN,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  INK,
  PAPER,
  RADIUS_PILL,
  RADIUS_SM,
  STATUS_STYLE,
  type Statuses,
  STONE,
  SUN,
  textOnSignal,
  VOLT,
  wave,
} from "./defs";
import { MicOrb, VoiceStatePill } from "./voice-ui";

function chipFor(st: AssetStatus) {
  const style = STATUS_STYLE[st];
  return {
    bg: style.bg,
    label: style.label,
    anim: style.anim ?? "none",
    color: textOnSignal(style.bg),
  };
}

function AssetCard({
  dotColor,
  agentLabel,
  status,
  onApprove,
  onRegen,
  canRegen = true,
  regenLabel = "↻ Regenerar",
  children,
}: {
  dotColor: string;
  agentLabel: string;
  status: AssetStatus;
  onApprove: () => void;
  onRegen: () => void;
  canRegen?: boolean;
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
            color: chip.color,
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
            background: status === "approved" ? ACID : CARD,
            cursor: canApprove ? "pointer" : "default",
          }}
        >
          {status === "approved"
            ? "✓ Aprobado"
            : status === "generating"
              ? "Generando…"
              : status === "draft"
                ? "Esperando asset"
                : "✓ Aprobar"}
        </button>
        <button
          onClick={onRegen}
          disabled={!canRegen}
          className="hov-coral"
          style={{
            flex: 1,
            fontFamily: FONT_SANS,
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            padding: 11,
            border: "none",
            background: CARD,
            cursor: canRegen ? "pointer" : "default",
            opacity: canRegen ? 1 : 0.45,
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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const joinList = (value: unknown, fallback: string) => {
  const items = asStringArray(value);
  return items.length > 0 ? items.join(" · ") : fallback;
};

const getVariantCopy = (
  copies: CampaignAdCopy[],
  language: "es" | "en",
  copyVar: "A" | "B",
) => copies.find((copy) => copy.language === language && copy.variant === copyVar.toLowerCase());

const getVariantAsset = (assets: CampaignCreativeAsset[], variant: "a" | "b") =>
  assets.find((asset) => asset.variant === variant);

const hasRealAssets = (dashboard: CampaignDashboard | null | undefined, key: AssetId) => {
  if (!dashboard) return true;
  switch (key) {
    case "strategy":
    case "audiences":
      return !!dashboard.agents.strategy;
    case "copy":
      return dashboard.agents.adCopies.length > 0;
    case "creatives":
      return dashboard.agents.visualAssets.length > 0;
    case "video":
      return dashboard.agents.videoScripts.length > 0;
    case "voice":
      // Se puede generar/regenerar la voz en cuanto existe un guion de video
      // (el Voice Agent lo necesita como fuente de la narración).
      return dashboard.agents.videoScripts.length > 0;
  }
};

function WaveRow({
  playing,
  onToggle,
  heights,
  meta,
  src,
}: {
  playing: boolean;
  onToggle: () => void;
  heights: number[];
  meta: string;
  /** URL del audio real (ElevenLabs). Null cuando el voiceover es fallback sin audio. */
  src: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = !!src;

  // El estado de reproducción vive en el padre (playEs/playEn, exclusivos entre
  // sí); acá solo sincronizamos el <audio> real con ese flag. Incluye `src` en
  // deps para re-disparar tras regenerar (mismo id, nueva URL, aún "playing").
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [playing, src]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, border: `2px solid ${INK}`, padding: "10px 12px" }}>
      <button
        onClick={onToggle}
        disabled={!hasAudio}
        title={hasAudio ? undefined : "Audio pendiente — configurá ELEVENLABS_API_KEY en el server"}
        style={{
          width: 34,
          height: 34,
          flex: "none",
          border: `2px solid ${INK}`,
          background: playing ? ACID : CARD,
          cursor: hasAudio ? "pointer" : "not-allowed",
          opacity: hasAudio ? 1 : 0.45,
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
      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, flex: "none" }}>
        {hasAudio ? meta : `${meta} · NO AUDIO`}
      </div>
      {hasAudio ? (
        // onEnded/onError togglean el flag del padre de vuelta a "no
        // reproduciendo" (evita que el botón quede trabado si el audio falla).
        <audio
          ref={audioRef}
          src={src}
          preload="none"
          onEnded={onToggle}
          onError={() => {
            if (playing) onToggle();
          }}
        />
      ) : null}
    </div>
  );
}

export function CampaignView({
  dashboard,
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
  actionMessage,
  cmdPhase,
  cmdText,
  voiceCmdClick,
}: {
  dashboard?: CampaignDashboard | null;
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
  actionMessage?: string | null;
  cmdPhase: "idle" | "listening" | "typing";
  cmdText: string;
  voiceCmdClick: () => void;
}) {
  const approvedCount = dashboard?.progress.approved ?? Object.values(statuses).filter((x) => x === "approved").length;
  const totalCount = dashboard?.progress.total ?? 6;
  const brandUpper = brandName.toUpperCase();
  const strategy = dashboard?.agents.strategy;
  const audience = asRecord(strategy?.audience);
  const segmentation = asRecord(strategy?.segmentation);
  const esCopy = getVariantCopy(dashboard?.agents.adCopies ?? [], "es", copyVar);
  const enCopy = getVariantCopy(dashboard?.agents.adCopies ?? [], "en", copyVar);
  const assetA = getVariantAsset(dashboard?.agents.visualAssets ?? [], "a");
  const assetB = getVariantAsset(dashboard?.agents.visualAssets ?? [], "b");
  const videoScript = dashboard?.agents.videoScripts[0];
  const voiceovers = dashboard?.agents.voiceovers ?? [];

  const copyEsHeadline =
    esCopy?.headline ??
    (copyVar === "B"
      ? "36 horas de batería. Cero excusas."
      : copyUrgent
        ? "Últimos días: tu enfoque no puede esperar."
        : "Tu tramo del metro, en silencio total.");
  const copyEsBody =
    esCopy?.primaryText ??
    (copyVar === "B"
      ? "ANC adaptativo para estudiar, viajar y trabajar. Pre-ordena con 20% off."
      : copyUrgent
        ? `Audífonos ANC ${brandName} — 36h de batería. Pre-ordena antes del viernes y llévate 20% off.`
        : `Audífonos ${brandName} con cancelación de ruido adaptativa y 36h de batería. Pre-ordena con 20% off.`);
  const copyEnHeadline =
    enCopy?.headline ?? (copyVar === "B" ? "36 hours of battery. Zero excuses." : "Your commute just went quiet.");
  const copyEnBody =
    enCopy?.primaryText ??
    (copyVar === "B"
      ? "Adaptive ANC for studying, commuting and deep work. Pre-order and save 20%."
      : `${brandName} ANC earbuds — 36h battery, adaptive noise canceling. Pre-order and save 20%.`);
  const campaignTitle = dashboard
    ? `${dashboard.campaign.id.slice(0, 8).toUpperCase()} · ${dashboard.campaign.name}`
    : "CMP-004 · Lanzamiento de Audífonos — LatAm";
  const campaignSubtitle = dashboard
    ? dashboard.campaign.objective
    : "Audífonos con cancelación de ruido · profesionales jóvenes y estudiantes · MX / CO / CL · ES/EN";

  return (
    <div>
      {actionMessage && (
        <div
          style={{
            background: "#FFE8E2",
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${INK}`,
            padding: "12px 16px",
            marginBottom: 18,
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 700,
            color: INK,
          }}
        >
          {actionMessage}
        </div>
      )}

      {pushed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: VOLT,
            color: textOnSignal(VOLT),
            border: `3px solid ${INK}`,
            boxShadow: `5px 5px 0 ${INK}`,
            padding: "14px 18px",
            marginBottom: 22,
            animation: "pv-rise 0.4s ease both",
          }}
        >
          <div style={{ width: 14, height: 14, background: ACID, border: `2px solid ${INK}`, animation: "pv-spin 1.2s linear infinite" }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600 }}>
            READY_TO_PUBLISH → pipeline de n8n en cola · empaquetando assets → Supabase → borrador subido a Meta Ads
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
          <div style={{ fontFamily: FONT_BLACK, fontSize: 24, letterSpacing: "-0.01em" }}>{campaignTitle}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 4 }}>
            {campaignSubtitle}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600 }}>{approvedCount}/{totalCount} APPROVED</div>
          <div style={{ width: 150, height: 14, border: `2px solid ${INK}`, background: CARD }}>
            <div
              style={{
                height: "100%",
                background: ACID,
                width: `${Math.round((approvedCount / totalCount) * 100)}%`,
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
          agentLabel="AGENTE DE ESTRATEGIA"
          status={statuses.strategy}
          onApprove={() => approve("strategy")}
          onRegen={() => regen("strategy")}
          canRegen={hasRealAssets(dashboard, "strategy")}
        >
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Estrategia de lanzamiento</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 500 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={specTag}>OBJETIVO</span> {dashboard?.campaign.objective ?? "Conversiones — preventas de audífonos, ráfaga de 3 semanas"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={specTag}>FUNNEL</span> {strategy?.notes ?? "60% alcance frío · 25% retargeting · 15% lookalike"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={specTag}>ÁNGULO</span> {strategy?.commercialAngle ?? "\"Silencia tu trayecto\" — foco y productividad, no specs"}
              </div>
            </div>
          </div>
        </AssetCard>

        {/* AUDIENCES */}
        <AssetCard
          dotColor={VOLT}
          agentLabel="AGENTE DE META ADS"
          status={statuses.audiences}
          onApprove={() => approve("audiences")}
          onRegen={() => regen("audiences")}
          canRegen={hasRealAssets(dashboard, "audiences")}
        >
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Segmentación de audiencia</div>
            <div style={{ border: `2px solid ${INK}`, padding: "10px 12px", background: PAPER }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                SEG A · {typeof audience.ageRange === "string" ? audience.ageRange : "PROFESIONALES JÓVENES 24-32"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {typeof audience.description === "string"
                  ? audience.description
                  : "MX · CO · CL — traslados, apps de productividad, trabajo remoto. Alcance est. 2.1M"}
              </div>
            </div>
            <div style={{ border: `2px solid ${INK}`, padding: "10px 12px", background: PAPER }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                SEGMENTACIÓN META
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {joinList(segmentation.locations, "música de estudio, audio gaming, tech económica")} ·{" "}
                {joinList(segmentation.interests, "Alcance est. 3.4M")}
              </div>
            </div>
          </div>
        </AssetCard>

        {/* COPY */}
        <AssetCard
          dotColor={VOLT}
          agentLabel="AGENTE DE META ADS · COPY"
          status={statuses.copy}
          onApprove={() => approve("copy")}
          onRegen={() => regen("copy")}
          canRegen={hasRealAssets(dashboard, "copy")}
        >
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Copy del anuncio</div>
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
                    background: copyVar === "A" ? ACID : CARD,
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
                    background: copyVar === "B" ? ACID : CARD,
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
          dotColor={VOLT}
          agentLabel="AGENTE CREATIVO · ESTÁTICOS"
          status={statuses.creatives}
          onApprove={() => approve("creatives")}
          onRegen={() => regen("creatives")}
          canRegen={hasRealAssets(dashboard, "creatives")}
        >
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Creatividades estáticas · 1080×1080</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: INK,
                  color: ACID,
                  border: `2px solid ${INK}`,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  overflow: "hidden",
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
                {assetA?.imageUrl ? (
                  <img
                    src={assetA.imageUrl}
                    alt={assetA.altText ?? "Variante creativa A"}
                    style={{ flex: 1, minHeight: 0, margin: "10px 0", width: "100%", objectFit: "cover", border: `1.5px solid ${ACID}` }}
                  />
                ) : (
                  <div
                    style={{
                      flex: 1,
                      margin: "10px 0",
                      border: `1.5px dashed ${ACID}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.9,
                      background:
                        "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(198,244,50,0.08) 6px, rgba(198,244,50,0.08) 7px)",
                    }}
                  >
                    <span style={{ fontFamily: FONT_MONO, fontSize: 8.5 }}>[ esperando creatividad ]</span>
                  </div>
                )}
                <div style={{ fontFamily: FONT_BLACK, fontSize: 15, lineHeight: 1.05, textTransform: "uppercase" }}>
                  {assetA?.prompt?.slice(0, 48) ?? "Silencia tu trayecto."}
                </div>
              </div>
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: ACID,
                  color: INK,
                  border: `2px solid ${INK}`,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  overflow: "hidden",
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
                {assetB?.imageUrl ? (
                  <img
                    src={assetB.imageUrl}
                    alt={assetB.altText ?? "Variante creativa B"}
                    style={{ flex: 1, minHeight: 0, margin: "10px 0", width: "100%", objectFit: "cover", border: `1.5px solid ${INK}` }}
                  />
                ) : (
                  <div style={{ fontFamily: FONT_BLACK, fontSize: 26, lineHeight: 0.95 }}>
                    36H
                    <br />
                    BATERÍA.
                  </div>
                )}
                <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600 }}>
                  {assetB?.prompt?.slice(0, 54) ?? "AUDÍFONOS ANC — PREVENTA -20%"}
                </div>
              </div>
            </div>
          </div>
        </AssetCard>

        {/* VIDEO SCRIPT */}
        <AssetCard
          dotColor={VOLT}
          agentLabel="AGENTE DE VIDEO"
          status={statuses.video}
          onApprove={() => approve("video")}
          onRegen={() => regen("video")}
          canRegen={hasRealAssets(dashboard, "video")}
        >
          <div style={{ padding: 16, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
              {videoScript?.title ?? "Guion corto de video · Reels de 15s"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 500 }}>
              {(videoScript?.scenes && videoScript.scenes.length > 0
                ? videoScript.scenes.map((scene, index) => [
                    `SC ${scene.sceneNumber ?? index + 1}`,
                    [scene.description, scene.dialogue].filter(Boolean).join(" — "),
                  ])
                : [
                    ["0:00-03", "Sonido caótico del metro — close-up: se coloca el audífono. Silencio repentino."],
                    ["0:03-09", 'Tomas divididas: estudiando, viajando, trabajo profundo. En pantalla: "36h. Cero ruido."'],
                    ["0:09-15", 'Giro de producto + tarjeta de precio. CTA de voz + "Pre-ordena hoy — 20% off."'],
                  ]
              ).map(([t, s]) => (
                <div key={`${t}-${s}`} style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, flex: "none", width: 52 }}>{t}</span>
                  <span>{s || "Escena pendiente de contenido."}</span>
                </div>
              ))}
            </div>
          </div>
        </AssetCard>

        {/* VOICEOVER */}
        <AssetCard
          dotColor={VOLT}
          agentLabel="AGENTE DE VOZ · ELEVENLABS"
          status={statuses.voice}
          onApprove={() => approve("voice")}
          onRegen={() => regen("voice")}
          canRegen={hasRealAssets(dashboard, "voice")}
          regenLabel={statuses.voice === "draft" ? "Generar" : "↻ Regenerar"}
        >
          <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Voiceovers</div>
            {voiceovers.length === 0 ? (
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
                Todavía no hay voiceover. Genéralo a partir del guion de video aprobado.
              </div>
            ) : (
              <>
                {voiceovers.slice(0, 2).map((voiceover, index) => (
                  <WaveRow
                    key={voiceover.id}
                    playing={voiceover.language === "es" ? playEs : playEn}
                    onToggle={voiceover.language === "es" ? togglePlayEs : togglePlayEn}
                    src={voiceover.audioUrl}
                    heights={wave(index + 1)}
                    meta={`${voiceover.language.toUpperCase()} · ${voiceover.voiceId.slice(0, 16).toUpperCase()} · 0:${String(
                      voiceover.durationSeconds ?? 0,
                    ).padStart(2, "0")}`}
                  />
                ))}
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
          borderRadius: RADIUS_SM,
          padding: "11px 13px",
          boxShadow: `6px 6px 0 ${ACID}`,
        }}
      >
        <MicOrb
          size="mini"
          phase={cmdPhase === "listening" ? "recording" : "idle"}
          onClick={voiceCmdClick}
          ariaLabel="Comando de voz"
          ringColor={CORAL}
        />
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
            ? "Escuchando…"
            : cmdText || "Comando de voz — prueba “regenera el titular en español con más urgencia”"}
        </div>
        <VoiceStatePill listening={cmdPhase === "listening"} labelListening="Escuchando" labelIdle="Inactivo" />
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            border: "2px solid rgba(244,242,236,0.35)",
            borderRadius: RADIUS_PILL,
            padding: "5px 10px",
            flex: "none",
          }}
        >
          COMANDOS DE VOZ · ES/EN
        </div>
      </div>
    </div>
  );
}
