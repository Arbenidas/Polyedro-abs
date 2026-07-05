import type { CSSProperties } from "react";

/** Ground — structural layer */
export const PAPER = "#F4F2EC";
export const INK = "#0A0A0A";
export const CARD = "#FFFFFF";
export const STONE = "#EDEAE0";

/** Signals — semantic layer */
export const ACID = "#C6F432"; // primary accent, CTAs, approved
export const VOLT = "#2F5CE5"; // agents, Push-to-Meta
export const CYAN = "#45D8E8"; // generating / in-progress
export const CORAL = "#FF6B57"; // regen / errors
export const SUN = "#FFD02F"; // review / warnings

/** @deprecated Use ACID */
export const ACCENT = ACID;

/** Readable text on signal backgrounds — white on Volt blue, ink elsewhere */
export function textOnSignal(bg: string): string {
  return bg === VOLT ? CARD : INK;
}

export const FONT_SANS = "var(--font-archivo), system-ui, sans-serif";
export const FONT_BLACK = "var(--font-archivo-black), sans-serif";
export const FONT_MONO = "var(--font-plex-mono), monospace";

export const gridBg = (alpha: number): string =>
  `repeating-linear-gradient(0deg, rgba(10,10,10,${alpha}) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(10,10,10,${alpha}) 0 1px, transparent 1px 32px)`;

export const monoLabel: CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
};

export const cardShell: CSSProperties = {
  background: CARD,
  border: `3px solid ${INK}`,
  boxShadow: `5px 5px 0 ${INK}`,
};

/** Rounded-corner tokens for the voice-UI refresh (mic orbs, pills, chips). */
export const RADIUS_PILL = 999;
export const RADIUS_SM = 10;

export const eyebrowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: RADIUS_PILL,
  border: `2px solid ${INK}`,
  background: CARD,
  fontFamily: FONT_MONO,
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const markerStyle: CSSProperties = {
  background: SUN,
  padding: "0 6px",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
} as CSSProperties;

/** Bar colors cycled across a wave visualizer, matching the reference demo. */
export const WAVE_COLORS = [VOLT, ACID, CORAL, CYAN];

export function waveColor(i: number): string {
  return WAVE_COLORS[i % WAVE_COLORS.length]!;
}

export type AssetId = "strategy" | "audiences" | "copy" | "creatives" | "video" | "voice";
export type AssetStatus = "draft" | "generating" | "review" | "approved";
export type Statuses = Record<AssetId, AssetStatus>;

export const STATUS_STYLE: Record<AssetStatus, { bg: string; label: string; anim?: string }> = {
  draft: { bg: STONE, label: "DRAFT" },
  generating: { bg: CYAN, label: "GENERATING", anim: "pv-pulse 1s ease-in-out infinite" },
  review: { bg: SUN, label: "REVIEW" },
  approved: { bg: ACID, label: "APPROVED ✓" },
};

export type View =
  | "onboard"
  | "newcampaign"
  | "genlive"
  | "campaign"
  | "brandkit"
  | "agents"
  | "automation";

export const GOAL =
  "Lanzamiento de audífonos inalámbricos con cancelación de ruido para jóvenes profesionales y estudiantes en LatAm.";
export const CMD = "Regenera el titular en español con más urgencia para estudiantes.";

export const RUN_DEFS = [
  { name: "Agente de Estrategia", glyph: "S", color: VOLT, task: "objetivo · split de funnel · ángulo comercial" },
  { name: "Agente de Meta Ads", glyph: "M", color: VOLT, task: "segmentos de audiencia · ubicaciones · estructura de campaña" },
  { name: "Agente de Meta Ads · copy", glyph: "M", color: VOLT, task: "copies ES/EN · CTAs · variantes A/B" },
  { name: "Agente Creativo", glyph: "C", color: VOLT, task: "creatividades estáticas 1080×1080 · mood boards" },
  { name: "Agente de Video", glyph: "V", color: VOLT, task: "guion de Reels de 15s · beats del storyboard" },
  { name: "Agente de Voz", glyph: "W", color: VOLT, task: "voiceover ElevenLabs ES/EN a partir del guion" },
  { name: "Agente de Aprobación", glyph: "✓", color: VOLT, task: "chequeo de coherencia vs brand kit → cola de revisión" },
] as const;

export const NAV_DEFS = [
  { id: "campaign", label: "Campañas", icon: "▸", badge: "04" },
  { id: "brandkit", label: "Brand Kit", icon: "◆", badge: "V1" },
  { id: "agents", label: "Agentes", icon: "⚙", badge: "8" },
  { id: "automation", label: "Automatización", icon: "⟶", badge: "ON" },
] as const;

export const AGENT_DEFS = [
  {
    name: "Agente de Marca",
    glyph: "B",
    color: ACID,
    role: "Construye la identidad visual y verbal — el Brand Kit que lee cada agente.",
    tool: "CLAUDE",
    runs: 12,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Agente de Estrategia",
    glyph: "S",
    color: VOLT,
    role: "Define objetivo, audiencia y ángulo comercial.",
    tool: "CLAUDE",
    runs: 9,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Agente de Meta Ads",
    glyph: "M",
    color: VOLT,
    role: "Estructura de campaña, copies, CTAs y variantes A/B.",
    tool: "META API",
    runs: 17,
    status: "ACTIVE",
    dot: CYAN,
    pulse: true,
  },
  {
    name: "Agente Creativo",
    glyph: "C",
    color: VOLT,
    role: "Imágenes y conceptos visuales generados con IA dentro del sistema de marca.",
    tool: "CLAUDE + IMG",
    runs: 31,
    status: "ACTIVE",
    dot: CYAN,
    pulse: true,
  },
  {
    name: "Agente de Video",
    glyph: "V",
    color: VOLT,
    role: "Guiones cortos para anuncios — formatos Reels y Stories.",
    tool: "CLAUDE",
    runs: 8,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Agente de Voz",
    glyph: "W",
    color: VOLT,
    role: "Voiceovers bilingües generados a partir de guiones aprobados.",
    tool: "ELEVENLABS",
    runs: 6,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Agente de Automatización",
    glyph: "A",
    color: VOLT,
    role: "Conecta n8n, Supabase y la exportación a Meta Ads.",
    tool: "N8N + SUPABASE",
    runs: 14,
    status: "STANDBY",
    dot: SUN,
    pulse: false,
  },
  {
    name: "Agente de Aprobación",
    glyph: "✓",
    color: VOLT,
    role: "Valida la coherencia contra el brand kit; bloquea la publicación hasta el visto bueno.",
    tool: "INTERNAL",
    runs: 44,
    status: "ACTIVE",
    dot: SUN,
    pulse: true,
  },
] as const;

export const PIPE_STEPS = [
  {
    n: "01",
    title: "Disparador: campaña aprobada",
    desc: "Los seis assets fueron aprobados por el dueño.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "02",
    title: "Sincroniza con Supabase",
    desc: "Assets, variantes de copy y audiencias escritos en la base de datos.",
    tag: "SUPABASE",
    tagBg: VOLT,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "03",
    title: "Empaqueta las creatividades",
    desc: "Estáticos renderizados en 1080×1080 + 9:16, con voiceover adjunto.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "04",
    title: "Carga borrador en Meta Ads",
    desc: "Campaña, conjuntos de anuncios y anuncios creados en modo borrador.",
    tag: "META API",
    tagBg: VOLT,
    nodeBg: VOLT,
    pulse: true,
    hasLine: true,
  },
  {
    n: "05",
    title: "Notifica al dueño",
    desc: "WhatsApp + email con links de previsualización para la publicación final.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: CARD,
    pulse: false,
    hasLine: false,
  },
] as const;

const WAVE_HEIGHTS = [10, 18, 24, 14, 22, 8, 16, 26, 12, 20, 9, 17, 25, 13, 21, 11, 19, 23, 15, 7, 18, 24, 10, 16];

export function wave(seed: number): number[] {
  return WAVE_HEIGHTS.map((h, i) => (seed === 2 ? WAVE_HEIGHTS[(i + 5) % WAVE_HEIGHTS.length]! : h));
}
