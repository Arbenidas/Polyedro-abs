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
  { tag: "CONCEPTO DE LOGO", title: "", body: "", bg: INK, ink: PAPER },
  { tag: "PALETA", title: "", body: "", bg: ACCENT, ink: INK },
  { tag: "VOZ Y TONO", title: "", body: "", bg: "#FFFFFF", ink: INK },
  { tag: "BUYER PERSONA", title: "", body: "", bg: "#FFFFFF", ink: INK },
  { tag: "PROPUESTA DE VALOR", title: "", body: "", bg: "#FFFFFF", ink: INK },
  { tag: "ESTILO VISUAL", title: "", body: "", bg: "#FFFFFF", ink: INK },
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
      tag: "CONCEPTO DE LOGO",
      title: brandKit.logoUrl ? "Logo generado" : "Concepto de logo redactado",
      body: brandKit.logoPrompt ?? "Todavía no hay prompt de logo disponible.",
      bg: INK,
      ink: PAPER,
    },
    {
      tag: "PALETA",
      title: palette ? [palette.primary, palette.secondary, palette.accent].join(" · ") : "Paleta pendiente",
      body: palette?.neutrals?.length ? `Neutros: ${palette.neutrals.join(", ")}` : "No se definieron neutros.",
      bg: ACCENT,
      ink: INK,
    },
    {
      tag: "VOZ Y TONO",
      title: tone?.es ?? "Tono de voz pendiente",
      body: tone?.en ?? "Todavía no hay tono de voz en inglés.",
      bg: "#FFFFFF",
      ink: INK,
    },
    {
      tag: "BUYER PERSONA",
      title: persona?.name ?? "Persona pendiente",
      body: persona
        ? [persona.occupation, persona.goals?.[0]].filter(Boolean).join(" — ")
        : "Todavía no hay buyer persona.",
      bg: "#FFFFFF",
      ink: INK,
    },
    {
      tag: "PROPUESTA DE VALOR",
      title: valueProp?.es ?? "Propuesta de valor pendiente",
      body: keyMessages?.es?.join(" · ") ?? "Todavía no hay mensajes clave.",
      bg: "#FFFFFF",
      ink: INK,
    },
    {
      tag: "ESTILO VISUAL",
      title: visualStyle?.mood ?? "Estilo visual pendiente",
      body: visualStyle?.imageryStyle ?? "Todavía no hay estilo de imagen.",
      bg: "#FFFFFF",
      ink: INK,
    },
  ];
}
