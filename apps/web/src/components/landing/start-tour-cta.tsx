"use client";

import { FONT_SANS, INK, PAPER } from "@/components/labs/defs";

import { requestGuideTourStart } from "./guide-tour-events";

export default function StartTourCta() {
  return (
    <button
      type="button"
      data-tour-id="hero-cta-tour"
      className="nb-press hov-accent"
      onClick={() => requestGuideTourStart()}
      style={{
        fontFamily: FONT_SANS,
        fontWeight: 700,
        fontSize: 14,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: PAPER,
        color: INK,
        border: `3px solid ${INK}`,
        padding: "14px 22px",
        cursor: "pointer",
      }}
    >
      Iniciar recorrido →
    </button>
  );
}
