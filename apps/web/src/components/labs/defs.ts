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
  | "kitgen"
  | "newcampaign"
  | "genlive"
  | "campaign"
  | "brandkit"
  | "agents"
  | "automation";

export const GOAL =
  "Lanzamiento de audífonos inalámbricos con cancelación de ruido para jóvenes profesionales y estudiantes en LatAm.";
export const CMD = "Regenerate the Spanish headline with more urgency for students.";

export const KIT_LOGS: Array<[string, string]> = [
  ["00:01", "reading brand input… ok"],
  ["00:02", "naming + monogram → done"],
  ["00:04", "palette: carbon / acid / volt / cyan / bone"],
  ["00:06", "voice&tone (es/en) drafted"],
  ["00:08", 'persona: "Diego, 26, CDMX"'],
  ["00:10", "value prop + key messages locked"],
  ["00:12", "visual style rules exported"],
  ["00:12", "brand kit v1 → READY"],
];

export const KIT_DEFS = [
  {
    tag: "LOGO CONCEPT",
    title: '"Signal block" monogram',
    body: "Squared mark, engraved-device ready, favicon-safe.",
    bg: INK,
    ink: PAPER,
  },
  {
    tag: "PALETTE",
    title: "Carbon · Acid · Volt · Cyan · Bone",
    body: "High-contrast, no gradients. Dark product, electric accents.",
    bg: ACID,
    ink: INK,
  },
  {
    tag: "VOICE & TONE",
    title: "Directo, seguro, irreverente.",
    body: "ES/EN bilingual. Benefits over spec sheets. No fake urgency.",
    bg: CARD,
    ink: INK,
  },
  {
    tag: "BUYER PERSONA",
    title: '"Diego, 26 — hybrid analyst, CDMX"',
    body: "70-min commute, buys on Instagram, trigger = discount + reviews.",
    bg: CARD,
    ink: INK,
  },
  {
    tag: "VALUE PROP",
    title: "Flagship audio, mid-range LatAm price.",
    body: "36h battery · adaptive ANC · 2-yr warranty.",
    bg: CARD,
    ink: INK,
  },
  {
    tag: "VISUAL STYLE",
    title: "Carbon grids, hard edges.",
    body: "Condensed black caps for claims, mono for specs.",
    bg: CARD,
    ink: INK,
  },
] as const;

export const RUN_DEFS = [
  { name: "Strategy Agent", glyph: "S", color: VOLT, task: "objective · funnel split · commercial angle" },
  { name: "Meta Ads Agent", glyph: "M", color: VOLT, task: "audience segments · placements · campaign structure" },
  { name: "Meta Ads Agent · copy", glyph: "M", color: VOLT, task: "ES/EN copies · CTAs · A/B variants" },
  { name: "Creative Agent", glyph: "C", color: VOLT, task: "static creatives 1080×1080 · concept boards" },
  { name: "Video Agent", glyph: "V", color: VOLT, task: "15s Reels script · storyboard beats" },
  { name: "Voice Agent", glyph: "W", color: VOLT, task: "ElevenLabs voiceover ES/EN from script" },
  { name: "Approval Agent", glyph: "✓", color: VOLT, task: "coherence check vs brand kit → queue for review" },
] as const;

export const NAV_DEFS = [
  { id: "campaign", label: "Campaigns", icon: "▸", badge: "04" },
  { id: "brandkit", label: "Brand Kit", icon: "◆", badge: "V1" },
  { id: "agents", label: "Agents", icon: "⚙", badge: "8" },
  { id: "automation", label: "Automation", icon: "⟶", badge: "ON" },
] as const;

export const AGENT_DEFS = [
  {
    name: "Brand Agent",
    glyph: "B",
    color: ACID,
    role: "Builds visual and verbal identity — the Brand Kit every agent reads.",
    tool: "CLAUDE",
    runs: 12,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Strategy Agent",
    glyph: "S",
    color: VOLT,
    role: "Defines objective, audience and commercial angle.",
    tool: "CLAUDE",
    runs: 9,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Meta Ads Agent",
    glyph: "M",
    color: VOLT,
    role: "Campaign structure, copies, CTAs and A/B variants.",
    tool: "META API",
    runs: 17,
    status: "ACTIVE",
    dot: CYAN,
    pulse: true,
  },
  {
    name: "Creative Agent",
    glyph: "C",
    color: VOLT,
    role: "AI images and visual concepts in the brand system.",
    tool: "CLAUDE + IMG",
    runs: 31,
    status: "ACTIVE",
    dot: CYAN,
    pulse: true,
  },
  {
    name: "Video Agent",
    glyph: "V",
    color: VOLT,
    role: "Short scripts for ads — Reels and Stories formats.",
    tool: "CLAUDE",
    runs: 8,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Voice Agent",
    glyph: "W",
    color: VOLT,
    role: "Bilingual voiceovers generated from approved scripts.",
    tool: "ELEVENLABS",
    runs: 6,
    status: "IDLE",
    dot: STONE,
    pulse: false,
  },
  {
    name: "Automation Agent",
    glyph: "A",
    color: VOLT,
    role: "Connects n8n, Supabase and Meta Ads export.",
    tool: "N8N + SUPABASE",
    runs: 14,
    status: "STANDBY",
    dot: SUN,
    pulse: false,
  },
  {
    name: "Approval Agent",
    glyph: "✓",
    color: VOLT,
    role: "Validates coherence vs brand kit; blocks publishing until sign-off.",
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
    title: "Trigger: campaign approved",
    desc: "All six assets signed off by owner.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "02",
    title: "Sync to Supabase",
    desc: "Assets, copy variants and audiences written to DB.",
    tag: "SUPABASE",
    tagBg: VOLT,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "03",
    title: "Package creatives",
    desc: "Statics rendered at 1080×1080 + 9:16, VO attached.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "04",
    title: "Meta Ads draft upload",
    desc: "Campaign, ad sets and ads created in draft mode.",
    tag: "META API",
    tagBg: VOLT,
    nodeBg: VOLT,
    pulse: true,
    hasLine: true,
  },
  {
    n: "05",
    title: "Notify owner",
    desc: "WhatsApp + email with preview links for final publish.",
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
