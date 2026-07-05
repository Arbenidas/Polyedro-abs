"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

import { useAuth } from "../auth-provider";
import { BrandWordmarkLink } from "./brand-wordmark-link";
import {
  ACCENT,
  CARD,
  CORAL,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  gridBg,
  INK,
  monoLabel,
  PAPER,
  SUN,
} from "./defs";

const inputStyle: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 15,
  fontWeight: 600,
  border: `3px solid ${INK}`,
  borderRadius: 0,
  padding: "12px 14px",
  background: PAPER,
};

export function LoginView() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);

    const { error: authError } =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password);

    setBusy(false);

    if (authError) {
      setError(authError);
    } else if (mode === "signup") {
      // Con email confirmation activada no hay sesión inmediata tras signUp;
      // si está desactivada, onAuthStateChange desmonta esta vista solo.
      setNotice("Cuenta creada — revisa tu bandeja de entrada si se requiere confirmación.");
    }
  };

  return (
    <div
      className="lab-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        fontFamily: FONT_SANS,
        backgroundImage: gridBg(0.045),
      }}
    >
      <header
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px" }}
      >
        <BrandWordmarkLink />
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", color: "rgba(10,10,10,0.55)" }}>
          LAB DE MARKETING CON IA · v0.4
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ background: "#FFFFFF", border: `3px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}` }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderBottom: `3px solid ${INK}`,
                background: INK,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: CORAL, border: "1.5px solid rgba(244,242,236,0.4)" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: SUN, border: "1.5px solid rgba(244,242,236,0.4)" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, border: "1.5px solid rgba(244,242,236,0.4)" }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: "rgba(244,242,236,0.7)", marginLeft: 8 }}>
                ~/auth/{mode === "signin" ? "iniciar-sesion" : "registro"}
              </span>
            </div>

            <form onSubmit={submit} style={{ padding: "30px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontFamily: FONT_BLACK, fontSize: 28, letterSpacing: "-0.01em", lineHeight: 1.05 }}>
                  {mode === "signin" ? "Entra a tu lab." : "Crea tu cuenta."}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(10,10,10,0.6)", marginTop: 8 }}>
                  {mode === "signin"
                    ? "Tus marcas y campañas viven detrás de esta puerta."
                    : "Una cuenta, todos tus espacios de marca."}
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={monoLabel}>EMAIL</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={monoLabel}>CONTRASEÑA</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    border: `2px solid ${INK}`,
                    background: showPassword ? ACCENT : CARD,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: INK,
                  }}
                >
                  {showPassword ? "✓" : ""}
                </span>
                <span style={{ ...monoLabel, cursor: "pointer" }}>MOSTRAR CONTRASEÑA</span>
              </label>

              {error && (
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: `2px solid ${INK}`,
                    background: CORAL,
                    color: "#FFFFFF",
                    padding: "9px 12px",
                  }}
                >
                  ✗ {error}
                </div>
              )}
              {notice && (
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: `2px solid ${INK}`,
                    background: SUN,
                    padding: "9px 12px",
                  }}
                >
                  ✓ {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="nb-press"
                style={
                  {
                    fontFamily: FONT_SANS,
                    fontSize: 14,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: busy ? SUN : ACCENT,
                    border: `3px solid ${INK}`,
                    padding: "13px 16px",
                    cursor: busy ? "wait" : "pointer",
                    "--sx": "4px",
                  } as CSSProperties
                }
              >
                {busy ? "Autenticando…" : mode === "signin" ? "Iniciar sesión →" : "Crear cuenta →"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === "signin" ? "signup" : "signin"));
                  setError(null);
                  setNotice(null);
                }}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(10,10,10,0.6)",
                  textDecoration: "underline",
                  alignSelf: "center",
                }}
              >
                {mode === "signin" ? "¿Todavía no tienes cuenta? Crea una" : "¿Ya tienes cuenta? Inicia sesión"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
