import type { BrandKit } from "@/lib/api";

import { ACCENT, INK, PAPER } from "./defs";

export type KitCard = {
  tag: string;
  title: string;
  body: string;
  bg: string;
  ink: string;
};

export const PLACEHOLDER_CARDS: KitCard[] = [
  { tag: "LOGO CONCEPT", title: "", body: "", bg: INK, ink: PAPER },
  { tag: "PALETTE", title: "", body: "", bg: ACCENT, ink: INK },
  { tag: "VOICE & TONE", title: "", body: "", bg: "#FFFFFF", ink: INK },
  { tag: "BUYER PERSONA", title: "", body: "", bg: "#FFFFFF", ink: INK },
  { tag: "VALUE PROP", title: "", body: "", bg: "#FFFFFF", ink: INK },
  { tag: "VISUAL STYLE", title: "", body: "", bg: "#FFFFFF", ink: INK },
];

export function buildKitCards(brandKit: BrandKit): KitCard[] {
  const palette = brandKit.colorPalette;
  const tone = brandKit.toneOfVoice;
  const persona = brandKit.buyerPersona;
  const valueProp = brandKit.valueProposition;
  const keyMessages = brandKit.keyMessages;
  const visualStyle = brandKit.visualStyle;

  return [
    {
      tag: "LOGO CONCEPT",
      title: brandKit.logoUrl ? "Logo generated" : "Logo concept drafted",
      body: brandKit.logoPrompt ?? "No logo prompt available yet.",
      bg: INK,
      ink: PAPER,
    },
    {
      tag: "PALETTE",
      title: palette ? [palette.primary, palette.secondary, palette.accent].join(" · ") : "Palette pending",
      body: palette?.neutrals?.length ? `Neutrals: ${palette.neutrals.join(", ")}` : "No neutrals defined.",
      bg: ACCENT,
      ink: INK,
    },
    {
      tag: "VOICE & TONE",
      title: tone?.es ?? "Tone of voice pending",
      body: tone?.en ?? "No English tone of voice yet.",
      bg: "#FFFFFF",
      ink: INK,
    },
    {
      tag: "BUYER PERSONA",
      title: persona?.name ?? "Persona pending",
      body: persona
        ? [persona.occupation, persona.goals?.[0]].filter(Boolean).join(" — ")
        : "No buyer persona yet.",
      bg: "#FFFFFF",
      ink: INK,
    },
    {
      tag: "VALUE PROP",
      title: valueProp?.es ?? "Value proposition pending",
      body: keyMessages?.es?.join(" · ") ?? "No key messages yet.",
      bg: "#FFFFFF",
      ink: INK,
    },
    {
      tag: "VISUAL STYLE",
      title: visualStyle?.mood ?? "Visual style pending",
      body: visualStyle?.imageryStyle ?? "No imagery style yet.",
      bg: "#FFFFFF",
      ink: INK,
    },
  ];
}
