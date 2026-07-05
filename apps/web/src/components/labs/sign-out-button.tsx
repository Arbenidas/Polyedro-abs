"use client";

import type { CSSProperties } from "react";

import { useAuth } from "../auth-provider";
import { CARD, FONT_MONO, INK } from "./defs";

export function SignOutButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { signOut } = useAuth();

  const style: CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: CARD,
    border: `2px solid ${INK}`,
    padding: fullWidth ? "6px 8px" : "8px 12px",
    cursor: "pointer",
    ...(fullWidth ? { width: "100%" } : {}),
  };

  return (
    <button type="button" onClick={() => void signOut()} className="hov-paper nb-press" style={style}>
      Cerrar sesión →
    </button>
  );
}
