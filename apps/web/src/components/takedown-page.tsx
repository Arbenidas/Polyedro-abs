import type { CSSProperties } from "react";

const INK = "#0A0A0A";
const PAPER = "#F4F2EC";
const ACID = "#C6F432";
const CARD = "#FFFFFF";
const FONT_SANS = "var(--font-archivo), system-ui, sans-serif";
const FONT_BLACK = "var(--font-archivo-black), system-ui, sans-serif";
const FONT_MONO = "var(--font-plex-mono), monospace";

const grid: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(10,10,10,0.045) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(10,10,10,0.045) 0 1px, transparent 1px 32px)",
};

export default function TakedownPage() {
  return (
    <main
      style={{
        ...grid,
        minHeight: "100dvh",
        backgroundColor: PAPER,
        color: INK,
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: FONT_SANS,
      }}
    >
      <section
        style={{
          width: "min(720px, 100%)",
          background: CARD,
          border: `4px solid ${INK}`,
          boxShadow: `10px 10px 0 ${INK}`,
          padding: "34px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ fontFamily: FONT_BLACK, fontSize: 28, letterSpacing: "-0.02em" }}>POLYEDRO</div>
          <div
            style={{
              border: `3px solid ${INK}`,
              background: ACID,
              padding: "3px 9px",
              fontFamily: FONT_BLACK,
              fontSize: 22,
            }}
          >
            /abs
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: `2px solid ${INK}`,
            background: ACID,
            padding: "6px 10px",
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          Demo offline
        </div>
        <h1
          style={{
            fontFamily: FONT_BLACK,
            fontSize: "clamp(34px, 6vw, 64px)",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Hackathon ended.
        </h1>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.45,
            fontWeight: 600,
            margin: "20px 0 0",
            maxWidth: 560,
          }}
        >
          This Polyedro demo is no longer available. Thanks for checking it out during the hackathon.
        </p>
      </section>
    </main>
  );
}
