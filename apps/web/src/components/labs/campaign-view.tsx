"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  bodyStyle,
  children,
}: {
  dotColor: string;
  agentLabel: string;
  status: AssetStatus;
  onApprove: () => void;
  onRegen: () => void;
  canRegen?: boolean;
  regenLabel?: string;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}) {
  const chip = chipFor(status);
  const canApprove = status === "review";
  const approved = status === "approved";
  return (
    <div
      style={{
        ...cardShell,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderWidth: approved ? 2 : 3,
        boxShadow: approved ? `3px 3px 0 ${INK}` : cardShell.boxShadow,
        background: approved ? "#FFFEFA" : CARD,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 16px",
          borderBottom: `${approved ? 1.5 : 2}px solid ${INK}`,
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
      <div style={{ ...bodyStyle, flex: 1, minHeight: 0 }}>{children}</div>
      <div style={{ display: "flex", borderTop: `${approved ? 1.5 : 2}px solid ${INK}` }}>
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
            padding: approved ? 9 : 11,
            border: "none",
            borderRight: `2px solid ${INK}`,
            background: status === "approved" ? ACID : CARD,
            cursor: canApprove ? "pointer" : "default",
            color: canApprove || approved ? INK : "rgba(10,10,10,0.48)",
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
            padding: approved ? 9 : 11,
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

type CreativeVariant = {
  label: "A" | "B";
  accent: string;
  asset?: CampaignCreativeAsset;
};

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

function CreativePreviewModal({
  variants,
  selected,
  brandName,
  status,
  onSelect,
  onClose,
  onApprove,
  onRegen,
}: {
  variants: CreativeVariant[];
  selected: CreativeVariant;
  brandName: string;
  status: AssetStatus;
  onSelect: (variant: CreativeVariant) => void;
  onClose: () => void;
  onApprove: () => void;
  onRegen: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const canApprove = status === "review";
  const imageUrl = selected.asset?.imageUrl;
  const metadata = selected.asset?.metadata ?? {};
  const provider = typeof metadata.provider === "string" ? metadata.provider : null;
  const dimensions =
    typeof metadata.width === "number" && typeof metadata.height === "number"
      ? `${metadata.width}×${metadata.height}`
      : "1080×1080";

  useEffect(() => {
    setImageReady(!imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      const selectedIndex = variants.findIndex((variant) => variant.label === selected.label);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (selectedIndex + direction + variants.length) % variants.length;
      const nextVariant = variants[nextIndex];

      if (nextVariant) {
        setZoomed(false);
        onSelect(nextVariant);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, selected.label, variants]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview creatividad ${selected.label}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(10,10,10,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(1240px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          background: PAPER,
          border: `3px solid ${INK}`,
          boxShadow: `8px 8px 0 ${ACID}`,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 280px",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            minHeight: 0,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: CARD,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em" }}>
                CREATIVIDAD ESTÁTICA · VAR {selected.label}
              </div>
              <div style={{ fontFamily: FONT_BLACK, fontSize: 24, marginTop: 4 }}>{brandName}</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar preview"
              style={{
                width: 38,
                height: 38,
                border: `2px solid ${INK}`,
                background: CARD,
                fontFamily: FONT_BLACK,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              flex: "0 1 auto",
              minHeight: 0,
              width: "min(100%, calc(100vh - 245px), 840px)",
              aspectRatio: "1 / 1",
              alignSelf: "center",
              border: `2px solid ${INK}`,
              background: INK,
              position: "relative",
              display: "flex",
              alignItems: zoomed ? "flex-start" : "center",
              justifyContent: zoomed ? "flex-start" : "center",
              overflow: "auto",
              padding: zoomed ? 0 : 12,
            }}
          >
            {imageUrl ? (
              <>
                {!imageReady ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: CARD,
                      color: "rgba(10,10,10,0.6)",
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Cargando preview…
                  </div>
                ) : null}
                <img
                  src={imageUrl}
                  alt={selected.asset?.altText ?? `Creatividad ${selected.label}`}
                  onLoad={() => setImageReady(true)}
                  onError={() => setImageReady(true)}
                  style={{
                    width: zoomed ? 1080 : "100%",
                    height: zoomed ? 1080 : "100%",
                    maxWidth: zoomed ? "none" : "100%",
                    maxHeight: zoomed ? "none" : "100%",
                    objectFit: "contain",
                    background: CARD,
                    opacity: imageReady ? 1 : 0,
                    transition: "opacity 0.16s ease",
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  aspectRatio: "1 / 1",
                  width: "min(100%, 560px)",
                  background: selected.accent,
                  color: textOnSignal(selected.accent),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                Imagen pendiente
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setZoomed((value) => !value)}
              style={{
                border: `2px solid ${INK}`,
                background: zoomed ? ACID : CARD,
                padding: "8px 12px",
                fontFamily: FONT_MONO,
                fontSize: 10,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {zoomed ? "AJUSTAR A PANTALLA" : "VER 100%"}
            </button>
            {imageUrl ? (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: `2px solid ${INK}`,
                  background: CARD,
                  padding: "8px 12px",
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 800,
                  color: INK,
                  textDecoration: "none",
                }}
              >
                ABRIR ORIGINAL
              </a>
            ) : null}
          </div>
        </div>
        <aside
          style={{
            borderLeft: `3px solid ${INK}`,
            background: PAPER,
            padding: 14,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 10 }}>
            COMPARAR VARIANTES
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {variants.map((variant) => (
              <button
                key={variant.label}
                onClick={() => {
                  setZoomed(false);
                  onSelect(variant);
                }}
                style={{
                  border: `2px solid ${selected.label === variant.label ? ACID : INK}`,
                  background: selected.label === variant.label ? INK : CARD,
                  color: selected.label === variant.label ? ACID : INK,
                  padding: 8,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    aspectRatio: "1 / 1",
                    maxHeight: 168,
                    border: `1.5px solid ${selected.label === variant.label ? ACID : INK}`,
                    background: variant.accent,
                    marginBottom: 8,
                    overflow: "hidden",
                  }}
                >
                  {variant.asset?.imageUrl ? (
                    <img
                      src={variant.asset.imageUrl}
                      alt={variant.asset.altText ?? `Creatividad ${variant.label}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 800 }}>VAR {variant.label}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 7, fontSize: 12, fontWeight: 600 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "rgba(10,10,10,0.55)" }}>Formato</span>
              <b>{dimensions}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ color: "rgba(10,10,10,0.55)" }}>Estado</span>
              <b>{chipFor(status).label}</b>
            </div>
            {provider ? (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ color: "rgba(10,10,10,0.55)" }}>Provider</span>
                <b>{provider}</b>
              </div>
            ) : null}
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <button
              onClick={onApprove}
              disabled={!canApprove}
              style={{
                border: `2px solid ${INK}`,
                background: canApprove ? ACID : STONE,
                color: canApprove ? INK : "rgba(10,10,10,0.45)",
                padding: "10px 12px",
                fontFamily: FONT_SANS,
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                cursor: canApprove ? "pointer" : "default",
              }}
            >
              ✓ Aprobar creatividades
            </button>
            <button
              onClick={onRegen}
              style={{
                border: `2px solid ${INK}`,
                background: CARD,
                padding: "10px 12px",
                fontFamily: FONT_SANS,
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              ↻ Regenerar lote
            </button>
          </div>
        </aside>
      </div>
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
  const pendingLabels = dashboard?.progress.pending ?? [];
  const pendingCount = Math.max(totalCount - approvedCount, pendingLabels.length);
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
  const creativeVariants = useMemo<CreativeVariant[]>(
    () => [
      { label: "A", accent: INK, asset: assetA },
      { label: "B", accent: ACID, asset: assetB },
    ],
    [assetA, assetB],
  );
  const [previewVariant, setPreviewVariant] = useState<CreativeVariant | null>(null);
  const [voiceDockOpen, setVoiceDockOpen] = useState(false);
  const voiceDockExpanded = voiceDockOpen || cmdPhase !== "idle" || !!cmdText;

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
          alignItems: "flex-end",
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
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700 }}>
              {approvedCount}/{totalCount} APROBADOS
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(10,10,10,0.55)", marginTop: 3 }}>
              {pendingCount > 0
                ? `Siguiente: ${(pendingLabels[0] ?? `${pendingCount} pendientes`).toString()}`
                : "Listo para publicar"}
            </div>
          </div>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
          marginBottom: 18,
        }}
      >
        {(
          [
            ["strategy", "Estrategia"],
            ["audiences", "Audiencias"],
            ["copy", "Copy"],
            ["creatives", "Creativos"],
            ["video", "Video"],
            ["voice", "Voz"],
          ] as Array<[AssetId, string]>
        ).map(([key, label]) => {
          const chip = chipFor(statuses[key]);
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                border: `2px solid ${INK}`,
                background: statuses[key] === "approved" ? "#FFFEFA" : CARD,
                padding: "8px 10px",
                boxShadow: statuses[key] === "review" ? `3px 3px 0 ${SUN}` : "none",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800 }}>{label}</span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  fontWeight: 800,
                  background: chip.bg,
                  color: chip.color,
                  border: `1.5px solid ${INK}`,
                  padding: "2px 6px",
                }}
              >
                {chip.label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px), 1fr))", gap: 18 }}>
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
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Creatividades estáticas · 1080×1080</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(10,10,10,0.58)", marginTop: 3 }}>
                  Click en una variante para revisar a tamaño completo.
                </div>
              </div>
              <button
                onClick={() => setPreviewVariant(creativeVariants.find((variant) => variant.asset?.imageUrl) ?? creativeVariants[0])}
                disabled={!assetA?.imageUrl && !assetB?.imageUrl}
                style={{
                  border: `2px solid ${INK}`,
                  background: assetA?.imageUrl || assetB?.imageUrl ? ACID : STONE,
                  color: assetA?.imageUrl || assetB?.imageUrl ? INK : "rgba(10,10,10,0.45)",
                  padding: "7px 10px",
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: assetA?.imageUrl || assetB?.imageUrl ? "pointer" : "default",
                  flex: "none",
                }}
              >
                VER PREVIEW
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {creativeVariants.map((variant) => {
                const imageUrl = variant.asset?.imageUrl;
                return (
                  <button
                    key={variant.label}
                    onClick={() => setPreviewVariant(variant)}
                    disabled={!imageUrl}
                    style={{
                      aspectRatio: "1 / 1",
                      background: variant.label === "A" ? INK : ACID,
                      color: variant.label === "A" ? ACID : INK,
                      border: `2px solid ${INK}`,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      overflow: "hidden",
                      cursor: imageUrl ? "zoom-in" : "default",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: FONT_MONO,
                        fontSize: 8.5,
                        letterSpacing: "0.14em",
                        opacity: 0.9,
                      }}
                    >
                      <span>{brandUpper}</span>
                      <span>{variant.label}</span>
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={variant.asset?.altText ?? `Variante creativa ${variant.label}`}
                        style={{
                          flex: 1,
                          minHeight: 0,
                          margin: "8px 0",
                          width: "100%",
                          objectFit: "cover",
                          border: `1.5px solid ${variant.label === "A" ? ACID : INK}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          margin: "8px 0",
                          border: `1.5px dashed ${variant.label === "A" ? ACID : INK}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: FONT_MONO,
                          fontSize: 8.5,
                          fontWeight: 800,
                        }}
                      >
                        PENDIENTE
                      </div>
                    )}
                    <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 800 }}>
                      {imageUrl ? "Ver 1080×1080" : variant.asset?.prompt?.slice(0, 54) ?? "Esperando creatividad"}
                    </div>
                  </button>
                );
              })}
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

      {previewVariant ? (
        <CreativePreviewModal
          variants={creativeVariants}
          selected={previewVariant}
          brandName={brandName}
          status={statuses.creatives}
          onSelect={setPreviewVariant}
          onClose={() => setPreviewVariant(null)}
          onApprove={() => approve("creatives")}
          onRegen={() => regen("creatives")}
        />
      ) : null}

      {/* Voice command dock */}
      {voiceDockExpanded ? (
        <div
          style={{
            position: "fixed",
            right: 26,
            bottom: 22,
            zIndex: 20,
            width: "min(720px, calc(100vw - 302px))",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: INK,
            color: PAPER,
            border: `3px solid ${INK}`,
            borderRadius: RADIUS_SM,
            padding: "10px 12px",
            boxShadow: `5px 5px 0 ${ACID}`,
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
              fontSize: 13,
              fontWeight: 600,
              color: cmdText || cmdPhase !== "idle" ? PAPER : "rgba(244,242,236,0.58)",
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
          <button
            onClick={() => setVoiceDockOpen(false)}
            aria-label="Contraer comandos de voz"
            style={{
              border: "2px solid rgba(244,242,236,0.35)",
              borderRadius: RADIUS_PILL,
              background: "transparent",
              color: PAPER,
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 800,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            OCULTAR
          </button>
        </div>
      ) : (
        <div
          style={{
            position: "fixed",
            right: 26,
            bottom: 22,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: INK,
            color: PAPER,
            border: `3px solid ${INK}`,
            borderRadius: RADIUS_PILL,
            padding: "8px 12px 8px 8px",
            boxShadow: `4px 4px 0 ${ACID}`,
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
          }}
        >
          <MicOrb
            size="mini"
            phase="idle"
            onClick={voiceCmdClick}
            ariaLabel="Comando de voz"
            ringColor={CORAL}
          />
          <button
            onClick={() => setVoiceDockOpen(true)}
            style={{
              border: "none",
              background: "transparent",
              color: PAPER,
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              cursor: "pointer",
              padding: "7px 2px",
            }}
          >
            VOZ
          </button>
        </div>
      )}
    </div>
  );
}
