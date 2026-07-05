"use client";

import Link from "next/link";

import {
  ACID,
  CARD,
  AGENT_DEFS,
  CORAL,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  GOAL,
  INK,
  monoLabel,
  PAPER,
  VOLT,
} from "@/components/labs/defs";
import { BrandWordmarkLinkFooter, useBrandHomeHref } from "@/components/labs/brand-wordmark-link";

import { LANDING_STATUS_STYLE, landingSignal, landingSignalInk } from "./landing-colors";
import StartTourCta from "./start-tour-cta";

import {
  Card,
  LandingSection,
  PrimaryCta,
  SectionLabel,
  SectionLead,
  SectionTitle,
  SecondaryCta,
} from "./landing-primitives";
import { motion, MotionGroup, revealVariants, staggerVariants } from "./landing-motion";

const PROBLEM_ITEMS = [
  {
    tag: "01",
    tourId: "problem-tools",
    title: "Herramientas por todos lados",
    body: "ChatGPT para el copy. Canva para lo visual. Meta Ads Manager para publicar. Nada se habla entre sí.",
  },
  {
    tag: "02",
    tourId: "problem-drift",
    title: "Marca que se desvía",
    body: "Cada pieza se ve y suena distinta. Tu voz se pierde entre canales y freelancers.",
  },
  {
    tag: "03",
    tourId: "problem-blind",
    title: "Publicar a ciegas",
    body: "Los outputs de IA salen sin revisión de coherencia. Un anuncio fuera de marca puede quemar confianza rápido.",
  },
] as const;

const FLOW_STEPS = [
  {
    n: "01",
    tourId: "flow-workspace",
    tag: "MARCA",
    title: "Crea tu workspace",
    body: "Un workspace por marca. Nombre, descripción, mercados objetivo — los agentes leen todo lo que pongas aquí.",
    active: true,
    accent: ACID,
  },
  {
    n: "02",
    tourId: "flow-brandkit",
    tag: "BRAND KIT",
    title: "Genera identidad",
    body: "Logo, paleta, voz y tono, persona, propuesta de valor y reglas visuales — exportados como v1.",
    active: false,
    accent: VOLT,
  },
  {
    n: "03",
    tourId: "flow-campaign",
    tag: "CAMPAÑA",
    title: "Despliega agentes",
    body: "Define un objetivo. Ocho agentes construyen estrategia, audiencias, copy, creativos, guiones de video y locuciones.",
    active: false,
    accent: CORAL,
  },
] as const;

const LANDING_KIT_SAMPLES = [
  {
    tourId: "demo-kit-logo",
    tag: "LOGO CONCEPT",
    title: 'Monograma "Signal block"',
    body: "Marca cuadrada, lista para grabar en dispositivo, favicon-safe.",
    bg: VOLT,
    ink: CARD,
  },
  {
    tourId: "demo-kit-palette",
    tag: "PALETA",
    title: "Carbon · Acid · Volt · Cyan · Bone",
    body: "Alto contraste, sin degradados. Producto oscuro, acentos eléctricos.",
    bg: ACID,
    ink: INK,
  },
  {
    tourId: "demo-kit-voice",
    tag: "VOZ Y TONO",
    title: "Directo, seguro, irreverente.",
    body: "Bilingüe ES/EN. Beneficios antes que fichas técnicas. Sin urgencia falsa.",
    bg: CORAL,
    ink: INK,
  },
] as const;

const ASSET_PIPELINE = [
  { id: "strategy", label: "Estrategia", status: "approved" as const },
  { id: "audiences", label: "Audiencias", status: "approved" as const },
  { id: "copy", label: "Copy", status: "review" as const },
  { id: "creatives", label: "Creativos", status: "generating" as const },
  { id: "video", label: "Video", status: "draft" as const },
  { id: "voice", label: "Voz", status: "draft" as const },
] as const;

const LANDING_PIPE_STEPS = [
  {
    n: "01",
    tourId: "auto-trigger",
    title: "Disparador: campaña aprobada",
    desc: "Los seis assets firmados por el dueño.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "02",
    tourId: "auto-supabase",
    title: "Sincronizar a Supabase",
    desc: "Assets, variantes de copy y audiencias escritos en la base de datos.",
    tag: "SUPABASE",
    tagBg: VOLT,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "03",
    tourId: "auto-package",
    title: "Empaquetar creativos",
    desc: "Estáticos renderizados a 1080×1080 + 9:16, locución adjunta.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: ACID,
    pulse: false,
    hasLine: true,
  },
  {
    n: "04",
    tourId: "auto-meta",
    title: "Subida borrador Meta Ads",
    desc: "Campaña, conjuntos de anuncios y ads creados en modo borrador.",
    tag: "META API",
    tagBg: VOLT,
    nodeBg: VOLT,
    pulse: true,
    hasLine: true,
  },
  {
    n: "05",
    tourId: "auto-notify",
    title: "Notificar al dueño",
    desc: "WhatsApp + email con links de preview para publicación final.",
    tag: "N8N",
    tagBg: CORAL,
    nodeBg: CARD,
    pulse: false,
    hasLine: false,
  },
] as const;

const AGENT_TOUR_IDS = [
  "agent-brand",
  "agent-strategy",
  "agent-meta",
  "agent-creative",
  "agent-video",
  "agent-voice",
  "agent-automation",
  "agent-approval",
] as const;

const AGENT_STATUS_ES: Record<string, string> = {
  IDLE: "INACTIVO",
  ACTIVE: "ACTIVO",
  STANDBY: "EN ESPERA",
};

const AGENT_COPY_ES = [
  { name: "Agente Brand", role: "Construye identidad visual y verbal — el Brand Kit que leen todos los agentes." },
  { name: "Agente Estrategia", role: "Define objetivo, audiencia y ángulo comercial." },
  { name: "Agente Meta Ads", role: "Estructura de campaña, copies, CTAs y variantes A/B." },
  { name: "Agente Creative", role: "Imágenes con IA y conceptos visuales dentro del sistema de marca." },
  { name: "Agente Video", role: "Guiones cortos para ads — formatos Reels y Stories." },
  { name: "Agente Voz", role: "Locuciones bilingües generadas desde guiones aprobados." },
  { name: "Agente Automatización", role: "Conecta n8n, Supabase y exportación a Meta Ads." },
  { name: "Agente Aprobación", role: "Valida coherencia vs brand kit; bloquea publicación hasta tu visto bueno." },
] as const;

const AUDIENCE_CARDS = [
  {
    tourId: "audience-startups",
    tag: "DUEÑOS DE MARCA",
    title: "Startups y DTC",
    body: "Un workspace, stack completo. Del brand kit al borrador en Meta Ads sin contratar un equipo.",
  },
  {
    tourId: "audience-agencies",
    tag: "AGENCIAS",
    title: "Operación multi-cliente",
    body: "Aísla cada cliente en su propio workspace. Mismos agentes, output consistente, tu puerta de aprobación.",
  },
  {
    tourId: "audience-latam",
    tag: "EQUIPOS LATAM",
    title: "Bilingüe por defecto",
    body: "Copy, locuciones y campañas ES/EN pensadas para México, Colombia, Argentina y más.",
  },
] as const;

const DEMO_COPY = {
  headline: "Cancela el ruido. Enciende tu día.",
  sub: "36h de batería · ANC adaptativo · garantía 2 años",
  cta: "Comprar ahora →",
};

const HERO_SIGNAL_LANES = [
  { tag: "BRAND KIT", label: "voz + paleta", color: ACID },
  { tag: "COPY", label: "variantes ES/EN", color: VOLT },
  { tag: "CREATIVOS", label: "1080×1080 + 9:16", color: CORAL },
  { tag: "META ADS", label: "borrador listo", color: ACID },
] as const;

export function LandingHeader() {
  const homeHref = useBrandHomeHref();
  const navLinks = [
    { href: "#how-it-works", label: "Cómo funciona" },
    { href: "#agents", label: "Agentes" },
    { href: "#demo", label: "Demo" },
    { href: "#guide", label: "Guía" },
  ];

  return (
    <motion.header
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: -24 }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px clamp(20px, 5vw, 48px)",
        background: PAPER,
        borderBottom: `3px solid ${INK}`,
      }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <Link href={homeHref} style={{ textDecoration: "none", color: INK }}>
        <motion.div
          style={{ display: "flex", alignItems: "baseline" }}
          whileHover={{ x: -2, y: -1, rotate: -0.35 }}
        >
          <span style={{ fontFamily: FONT_BLACK, fontSize: 18, letterSpacing: "-0.02em" }}>POLYEDRO</span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 14,
              fontWeight: 700,
              background: ACID,
              padding: "0 5px",
              border: `2px solid ${INK}`,
              marginLeft: 6,
            }}
          >
            /abs
          </span>
        </motion.div>
      </Link>

      <motion.nav
        animate="visible"
        initial="hidden"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(12px, 3vw, 28px)",
        }}
        aria-label="Secciones de la landing"
        variants={staggerVariants}
      >
        {navLinks.map((link) => (
          <motion.a
            key={link.href}
            href={link.href}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "rgba(10,10,10,0.65)",
              textDecoration: "none",
              display: "none",
            }}
            className="landing-nav-link"
            variants={revealVariants}
            whileHover={{ color: INK, x: -1, y: -1 }}
          >
            {link.label}
          </motion.a>
        ))}
        <PrimaryCta href="/dashboard" style={{ padding: "10px 16px", fontSize: 11 }}>
          Crear workspace →
        </PrimaryCta>
      </motion.nav>

      <style>{`
        @media (min-width: 768px) {
          .landing-nav-link { display: inline !important; }
        }
      `}</style>
    </motion.header>
  );
}

export function HeroSection() {
  const homeHref = useBrandHomeHref();

  return (
    <motion.section
      animate="visible"
      id="hero"
      initial="hidden"
      style={{
        padding: "clamp(64px, 12vw, 120px) clamp(20px, 5vw, 48px) clamp(48px, 8vw, 80px)",
        textAlign: "center",
      }}
      variants={staggerVariants}
    >
      <motion.div style={{ maxWidth: 900, margin: "0 auto" }} variants={staggerVariants}>
        <motion.div
          data-tour-id="hero-wordmark"
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.12em",
          }}
          variants={revealVariants}
          whileHover={{ scale: 1.012, rotate: -0.2 }}
        >
          <Link
            href={homeHref}
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.12em",
              textDecoration: "none",
              color: INK,
            }}
          >
            <span
              style={{
                fontFamily: FONT_BLACK,
                fontSize: "clamp(3rem, 14vw, 9rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              POLYEDRO
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: "clamp(2.25rem, 10vw, 6.5rem)",
                fontWeight: 700,
                background: ACID,
                padding: "0.06em 0.14em",
                border: `0.06em solid ${INK}`,
                lineHeight: 1,
              }}
            >
              /abs
            </span>
          </Link>
        </motion.div>

        <motion.p
          data-tour-id="hero-tagline"
          style={{
            fontFamily: FONT_MONO,
            fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)",
            letterSpacing: "0.12em",
            color: "rgba(10,10,10,0.5)",
            marginTop: "0.85em",
          }}
          variants={revealVariants}
        >
          EL LAB DE MARKETING CON IA
        </motion.p>

        <motion.h1
          data-tour-id="hero-headline"
          style={{
            fontFamily: FONT_BLACK,
            fontSize: "clamp(1.5rem, 4.5vw, 2.5rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            marginTop: 28,
            marginBottom: 0,
          }}
          variants={revealVariants}
        >
          Un workspace. Ocho agentes.
          <br />
          Tú apruebas — ellos ejecutan.
        </motion.h1>

        <motion.p
          data-tour-id="hero-description"
          style={{
            fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
            fontWeight: 500,
            color: "rgba(10,10,10,0.6)",
            marginTop: 16,
            marginBottom: 0,
            lineHeight: 1.5,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
          variants={revealVariants}
        >
          Brand kit, campañas, copy, creativos y locuciones — construidos por agentes de IA especializados en un
          workspace por marca.
        </motion.p>

        <motion.div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            marginTop: 32,
          }}
          variants={staggerVariants}
        >
          <PrimaryCta href="/dashboard" tourId="hero-cta-create">
            Crear workspace →
          </PrimaryCta>
          <StartTourCta />
          <SecondaryCta href="#how-it-works">Ver cómo funciona ↓</SecondaryCta>
        </motion.div>

        <HeroSignalMap />
      </motion.div>
    </motion.section>
  );
}

function HeroSignalMap() {
  return (
    <motion.div
      data-tour-id="hero-system-map"
      style={{
        position: "relative",
        maxWidth: 780,
        minHeight: 178,
        margin: "42px auto 0",
        background: CARD,
        border: `3px solid ${INK}`,
        boxShadow: `8px 8px 0 ${INK}`,
        overflow: "hidden",
        textAlign: "left",
      }}
      variants={revealVariants}
      whileHover={{ rotate: -0.25, scale: 1.008, boxShadow: `11px 11px 0 ${INK}` }}
    >
      <motion.div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(198,244,50,0.18) 44%, rgba(69,216,232,0.2) 52%, transparent 100%)",
          borderLeft: `2px solid ${INK}`,
          pointerEvents: "none",
          width: "38%",
        }}
        animate={{ x: ["-45%", "185%"] }}
        transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.7 }}
      />

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          padding: 16,
        }}
      >
        {HERO_SIGNAL_LANES.map((lane, i) => (
          <motion.div
            key={lane.tag}
            style={{
              minHeight: 92,
              padding: "14px 14px 12px",
              background: i % 2 === 0 ? PAPER : CARD,
              border: `2px solid ${INK}`,
              color: INK,
              overflow: "hidden",
            }}
            animate={{ y: [0, -7, 0], rotate: [0, i % 2 === 0 ? -0.7 : 0.7, 0] }}
            transition={{
              duration: 3 + i * 0.25,
              ease: "easeInOut",
              repeat: Infinity,
              delay: i * 0.16,
            }}
          >
            <span
              style={{
                ...monoLabel,
                display: "inline-block",
                background: lane.color,
                color: landingSignalInk(lane.color),
                border: `2px solid ${INK}`,
                padding: "3px 7px",
                fontSize: 8,
              }}
            >
              {lane.tag}
            </span>
            <div style={{ fontFamily: FONT_BLACK, fontSize: 17, marginTop: 12, lineHeight: 1.05 }}>{lane.label}</div>
            <motion.div
              style={{
                height: 8,
                marginTop: 14,
                background: INK,
                transformOrigin: "left",
              }}
              animate={{ scaleX: [0.18, 1, 0.42, 0.88] }}
              transition={{ duration: 2.8, ease: "easeInOut", repeat: Infinity, delay: i * 0.22 }}
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          background: INK,
          color: PAPER,
          borderTop: `3px solid ${INK}`,
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: "0.08em",
        }}
      >
        <span>AGENTES SINCRONIZADOS</span>
        <motion.span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            background: ACID,
            border: `2px solid ${PAPER}`,
          }}
          animate={{ scale: [1, 1.5, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
}

export function ProblemSection() {
  return (
    <LandingSection id="problem" alt>
      <SectionLabel accent={CORAL}>EL PROBLEMA</SectionLabel>
      <SectionTitle>Los stacks de marketing no se hablan.</SectionTitle>
      <SectionLead>
        Los equipos pegan una docena de herramientas. La consistencia de marca se rompe. Los outputs de IA salen sin revisión.
      </SectionLead>

      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginTop: 36,
        }}
      >
        {PROBLEM_ITEMS.map((item, i) => (
          <Card key={item.tag} tourId={item.tourId} style={{ padding: "22px 24px" }}>
            <span
              style={{
                ...monoLabel,
                background: landingSignal(i),
                border: `2px solid ${INK}`,
                padding: "2px 8px",
                color: landingSignalInk(landingSignal(i)),
              }}
            >
              {item.tag}
            </span>
            <div
              style={{
                fontFamily: FONT_BLACK,
                fontSize: 20,
                letterSpacing: "-0.01em",
                marginTop: 8,
                lineHeight: 1.1,
              }}
            >
              {item.title}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 10, marginBottom: 0, color: "rgba(10,10,10,0.7)" }}>
              {item.body}
            </p>
          </Card>
        ))}
      </MotionGroup>
    </LandingSection>
  );
}

export function HowItWorksSection() {
  return (
    <LandingSection id="how-it-works">
      <SectionLabel accent={VOLT}>CÓMO FUNCIONA</SectionLabel>
      <SectionTitle>Marca → Kit → Campaña.</SectionTitle>
      <SectionLead>Tres pasos para ir de cero a un pipeline de campaña completo — el mismo flujo dentro de la app.</SectionLead>

      <MotionGroup style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 0 }}>
        {FLOW_STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "0 24px",
              position: "relative",
            }}
            variants={revealVariants}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <motion.div
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: step.active ? step.accent : CARD,
                  color: step.active ? landingSignalInk(step.accent) : INK,
                  border: `3px solid ${INK}`,
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  fontWeight: 700,
                }}
                animate={step.active ? { scale: [1, 1.1, 1], rotate: [0, -4, 0] } : undefined}
                transition={step.active ? { duration: 1.8, ease: "easeInOut", repeat: Infinity } : undefined}
                whileHover={{ scale: 1.12, rotate: -4 }}
              >
                {step.n}
              </motion.div>
              {i < FLOW_STEPS.length - 1 && (
                <motion.div
                  style={{
                    width: 3,
                    flex: 1,
                    minHeight: 40,
                    background: INK,
                    margin: "4px 0",
                  }}
                  initial={{ scaleY: 0, transformOrigin: "top" }}
                  whileInView={{ scaleY: 1 }}
                  transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 + i * 0.08 }}
                  viewport={{ once: true, amount: 0.5 }}
                />
              )}
            </div>

            <Card tourId={step.tourId} style={{ padding: "20px 24px", marginBottom: i < FLOW_STEPS.length - 1 ? 16 : 0 }}>
              <span
                style={{
                  ...monoLabel,
                  border: `2px solid ${INK}`,
                  background: step.active ? step.accent : CARD,
                  color: step.active ? landingSignalInk(step.accent) : INK,
                  padding: "3px 10px",
                  display: "inline-block",
                }}
              >
                {step.tag}
              </span>
              <div
                style={{
                  fontFamily: FONT_BLACK,
                  fontSize: 22,
                  letterSpacing: "-0.01em",
                  marginTop: 10,
                  lineHeight: 1.1,
                }}
              >
                {step.title}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 8, marginBottom: 0, color: "rgba(10,10,10,0.7)" }}>
                {step.body}
              </p>
            </Card>
          </motion.div>
        ))}
      </MotionGroup>
    </LandingSection>
  );
}

export function AgentsSection() {
  return (
    <LandingSection id="agents" alt>
      <SectionLabel accent={ACID}>8 AGENTES ESPECIALIZADOS</SectionLabel>
      <SectionTitle>No es un chatbot. Es un lab.</SectionTitle>
      <SectionLead>
        Cada agente tiene un pedazo del pipeline — estrategia, ads, creative, video, voz, automatización y aprobación.
      </SectionLead>

      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
          marginTop: 36,
        }}
      >
        {AGENT_DEFS.map((agent, i) => {
          const copy = AGENT_COPY_ES[i]!;
          return (
            <Card key={agent.name} tourId={AGENT_TOUR_IDS[i]} style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <motion.span
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: landingSignal(i),
                    color: landingSignalInk(landingSignal(i)),
                    border: `2px solid ${INK}`,
                    fontFamily: FONT_BLACK,
                    fontSize: 15,
                  }}
                  animate={agent.pulse ? { scale: [1, 1.12, 1], rotate: [0, -7, 0] } : undefined}
                  transition={agent.pulse ? { duration: 1.9, ease: "easeInOut", repeat: Infinity } : undefined}
                  whileHover={{ scale: 1.18, rotate: -8 }}
                >
                  {agent.glyph}
                </motion.span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT_BLACK, fontSize: 14, letterSpacing: "-0.01em" }}>{copy.name}</span>
                    <span
                      style={{
                        ...monoLabel,
                        fontSize: 8,
                        background: agent.pulse ? VOLT : CARD,
                        color: agent.pulse ? CARD : INK,
                        border: `1px solid ${INK}`,
                        padding: "2px 6px",
                        animation: agent.pulse ? "pv-pulse 1s ease-in-out infinite" : undefined,
                      }}
                    >
                      {AGENT_STATUS_ES[agent.status] ?? agent.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, lineHeight: 1.4, marginTop: 6, marginBottom: 8, color: "rgba(10,10,10,0.7)" }}>
                    {copy.role}
                  </p>
                  <span
                    style={{
                      ...monoLabel,
                      fontSize: 8,
                      background: landingSignal(i + 1),
                      color: landingSignalInk(landingSignal(i + 1)),
                      border: `1px solid ${INK}`,
                      padding: "2px 6px",
                    }}
                  >
                    {agent.tool}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </MotionGroup>
    </LandingSection>
  );
}

export function PipelineSection() {
  return (
    <LandingSection id="pipeline">
      <SectionLabel accent={CORAL}>OUTPUT DE CAMPAÑA</SectionLabel>
      <SectionTitle>Seis assets. Un pipeline.</SectionTitle>
      <SectionLead>
        Cada campaña produce estrategia, audiencias, copy, creativos, video y voz — cada uno con un estado claro.
      </SectionLead>

      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12,
          marginTop: 36,
        }}
      >
        {ASSET_PIPELINE.map((asset) => {
          const st = LANDING_STATUS_STYLE[asset.status];
          return (
            <Card key={asset.id} tourId={`pipeline-${asset.id}`} style={{ padding: "16px 18px" }}>
              <span style={{ ...monoLabel, fontSize: 9, color: "rgba(10,10,10,0.45)" }}>{asset.id.toUpperCase()}</span>
              <div style={{ fontFamily: FONT_BLACK, fontSize: 16, marginTop: 6 }}>{asset.label}</div>
              <span
                style={{
                  ...monoLabel,
                  fontSize: 8,
                  display: "inline-block",
                  marginTop: 10,
                  background: st.bg,
                  color: landingSignalInk(st.bg),
                  border: `2px solid ${INK}`,
                  padding: "3px 8px",
                  animation: st.anim,
                }}
              >
                {st.label}
              </span>
            </Card>
          );
        })}
      </MotionGroup>
    </LandingSection>
  );
}

export function ApprovalSection() {
  return (
    <LandingSection id="approval" alt>
      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 32,
          alignItems: "center",
        }}
      >
        <motion.div variants={revealVariants}>
          <SectionLabel accent={VOLT}>HUMANO EN EL LOOP</SectionLabel>
          <SectionTitle>Nada se publica sin ti.</SectionTitle>
          <SectionLead>
            El Agente de Aprobación revisa cada asset contra tu Brand Kit — voz, visuales, claims. Los outputs fuera de
            marca se bloquean hasta que des el visto bueno.
          </SectionLead>
        </motion.div>

        <Card tourId="approval-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <motion.span
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: CORAL,
                border: `2px solid ${INK}`,
                fontFamily: FONT_BLACK,
                fontSize: 18,
              }}
              animate={{ rotate: [0, -7, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
            >
              ✓
            </motion.span>
            <div>
              <div style={{ fontFamily: FONT_BLACK, fontSize: 18 }}>Agente de Aprobación</div>
              <span style={{ ...monoLabel, fontSize: 9, color: "rgba(10,10,10,0.5)" }}>REVISIÓN DE COHERENCIA · ACTIVO</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { tourId: "approval-blocked", line: "Variante B de copy — tono no coincide con brand kit" },
              { tourId: "approval-ok-copy", line: "Creative 1080×1080 — paleta ok" },
              { tourId: "approval-ok-voice", line: "Locución ES — guion aprobado" },
            ].map((row, i) => (
              <motion.div
                key={row.line}
                data-tour-id={row.tourId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: i === 0 ? CORAL : i === 2 ? ACID : VOLT,
                  color: landingSignalInk(i === 0 ? CORAL : i === 2 ? ACID : VOLT),
                  border: `2px solid ${INK}`,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                variants={revealVariants}
                whileHover={{ x: -3, y: -1 }}
              >
                <span style={{ fontFamily: FONT_MONO, fontSize: 10 }}>{i === 0 ? "✗" : "✓"}</span>
                {row.line}
              </motion.div>
            ))}
          </div>
        </Card>
      </MotionGroup>
    </LandingSection>
  );
}

export function AutomationSection() {
  return (
    <LandingSection id="automation">
      <SectionLabel accent={ACID}>AUTOMATIZACIÓN</SectionLabel>
      <SectionTitle>Aprobado → en vivo en Meta Ads.</SectionTitle>
      <SectionLead>
        Una vez que das el visto bueno, el Agente de Automatización sube assets a Supabase, empaqueta creativos y crea
        borradores en Meta Ads vía n8n.
      </SectionLead>

      <MotionGroup style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 0 }}>
        {LANDING_PIPE_STEPS.map((step) => (
          <motion.div key={step.n} style={{ display: "flex", gap: 16, alignItems: "stretch" }} variants={revealVariants}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 44 }}>
              <motion.div
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: step.nodeBg,
                  color: landingSignalInk(step.nodeBg),
                  border: `3px solid ${INK}`,
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  animation: step.pulse ? "pv-pulse 1s ease-in-out infinite" : undefined,
                }}
                animate={step.pulse ? { scale: [1, 1.12, 1], rotate: [0, 6, 0] } : undefined}
                transition={step.pulse ? { duration: 1.7, ease: "easeInOut", repeat: Infinity } : undefined}
                whileHover={{ scale: 1.12, rotate: -5 }}
              >
                {step.n}
              </motion.div>
              {step.hasLine && (
                <motion.div
                  style={{ width: 3, flex: 1, minHeight: 24, background: INK, margin: "4px 0", transformOrigin: "top" }}
                  initial={{ scaleY: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  viewport={{ once: true, amount: 0.5 }}
                  whileInView={{ scaleY: 1 }}
                />
              )}
            </div>
            <Card tourId={step.tourId} style={{ flex: 1, padding: "16px 20px", marginBottom: step.hasLine ? 12 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT_BLACK, fontSize: 16 }}>{step.title}</span>
                <span
                  style={{
                    ...monoLabel,
                    fontSize: 8,
                    background: step.tagBg,
                    border: `1px solid ${INK}`,
                    padding: "2px 8px",
                    color: landingSignalInk(step.tagBg),
                  }}
                >
                  {step.tag}
                </span>
              </div>
              <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: "rgba(10,10,10,0.65)" }}>{step.desc}</p>
            </Card>
          </motion.div>
        ))}
      </MotionGroup>
    </LandingSection>
  );
}

export function DemoSection() {
  const kitSample = LANDING_KIT_SAMPLES;

  return (
    <LandingSection id="demo" alt>
      <SectionLabel accent={VOLT}>DEMO EN VIVO</SectionLabel>
      <SectionTitle>Signal Audio — lanzamiento LatAm.</SectionTitle>
      <SectionLead>{GOAL}</SectionLead>

      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          marginTop: 36,
        }}
      >
        <Card tourId="demo-brandkit" style={{ padding: 20 }}>
          <span style={monoLabel}>BRAND KIT · V1</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {kitSample.map((kit) => (
              <motion.div
                key={kit.tag}
                data-tour-id={kit.tourId}
                style={{
                  padding: "12px 14px",
                  background: kit.bg,
                  color: kit.ink,
                  border: `2px solid ${INK}`,
                }}
                variants={revealVariants}
                whileHover={{ x: -3, y: -2, rotate: -0.4 }}
              >
                <span style={{ ...monoLabel, fontSize: 8, opacity: 0.7 }}>{kit.tag}</span>
                <div style={{ fontFamily: FONT_BLACK, fontSize: 14, marginTop: 4 }}>{kit.title}</div>
                <p style={{ fontSize: 11, marginTop: 4, marginBottom: 0, opacity: 0.85 }}>{kit.body}</p>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card tourId="demo-ad" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "10px 16px",
              background: INK,
              fontFamily: FONT_MONO,
              fontSize: 10,
              color: "rgba(244,242,236,0.7)",
              letterSpacing: "0.06em",
            }}
          >
            META AD · 1080×1080 · COPY A
          </div>
          <div style={{ padding: 24, background: INK, color: PAPER, minHeight: 180 }}>
            <div
              data-tour-id="demo-ad-headline"
              style={{
                fontFamily: FONT_BLACK,
                fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              {DEMO_COPY.headline}
            </div>
            <p
              data-tour-id="demo-ad-specs"
              style={{ fontFamily: FONT_MONO, fontSize: 11, marginTop: 12, opacity: 0.7, letterSpacing: "0.04em" }}
            >
              {DEMO_COPY.sub}
            </p>
            <motion.span
              style={{
                display: "inline-block",
                marginTop: 20,
                fontFamily: FONT_SANS,
                fontWeight: 800,
                fontSize: 12,
                background: ACID,
                color: INK,
                border: `2px solid ${PAPER}`,
                padding: "8px 14px",
              }}
              animate={{ x: [0, 3, 0], y: [0, -2, 0] }}
              transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
            >
              {DEMO_COPY.cta}
            </motion.span>
          </div>
        </Card>
      </MotionGroup>
    </LandingSection>
  );
}

export function AudienceSection() {
  return (
    <LandingSection id="audience">
      <SectionLabel accent={CORAL}>PARA QUIÉN ES</SectionLabel>
      <SectionTitle>Hecho para equipos que lanzan.</SectionTitle>
      <SectionLead>Ya seas founder solo o agencia multi-cliente — un workspace por marca.</SectionLead>

      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginTop: 36,
        }}
      >
        {AUDIENCE_CARDS.map((card, i) => (
          <Card key={card.tag} tourId={card.tourId} style={{ padding: "22px 24px" }}>
            <span
              style={{
                ...monoLabel,
                background: landingSignal(i),
                color: landingSignalInk(landingSignal(i)),
                border: `2px solid ${INK}`,
                padding: "3px 10px",
                display: "inline-block",
              }}
            >
              {card.tag}
            </span>
            <div style={{ fontFamily: FONT_BLACK, fontSize: 20, marginTop: 12, letterSpacing: "-0.01em" }}>
              {card.title}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 10, marginBottom: 0, color: "rgba(10,10,10,0.7)" }}>
              {card.body}
            </p>
          </Card>
        ))}
      </MotionGroup>
    </LandingSection>
  );
}

export function GuideSection() {
  return (
    <LandingSection id="guide" alt>
      <MotionGroup
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 32,
          alignItems: "center",
        }}
      >
        <motion.div data-tour-id="guide-intro" variants={revealVariants}>
          <SectionLabel accent={ACID}>AGENTE GUÍA · ELEVENLABS</SectionLabel>
          <SectionTitle>Una voz que te acompaña.</SectionTitle>
          <SectionLead>
            Modo demo: pulsa «Iniciar recorrido» y el agente ElevenLabs narra toda la landing sin interrupciones,
            haciendo scroll automático sección por sección.
          </SectionLead>
          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <StartTourCta />
            <PrimaryCta href="/dashboard">Empezar con workspace →</PrimaryCta>
          </div>
        </motion.div>

        <Card tourId="guide-capabilities" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <motion.span
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: VOLT,
                color: CARD,
                border: `3px solid ${INK}`,
                fontFamily: FONT_BLACK,
                fontSize: 20,
              }}
              animate={{ y: [0, -4, 0], rotate: [0, -6, 0] }}
              transition={{ duration: 2.1, ease: "easeInOut", repeat: Infinity }}
            >
              G
            </motion.span>
            <div>
              <div style={{ fontFamily: FONT_BLACK, fontSize: 18 }}>Agente guía</div>
              <span style={{ ...monoLabel, fontSize: 9, color: "rgba(10,10,10,0.5)" }}>ELEVENLABS · RECORRIDO DE PLATAFORMA</span>
            </div>
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[
              "Narra las secciones de la landing al hacer scroll",
              "Guía el onboarding paso a paso",
              "Explica los roles de cada agente dentro del lab",
              "Lee los outputs de campaña en voz alta (ES/EN)",
            ].map((item, i) => (
              <motion.li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: CARD,
                  border: `2px solid ${INK}`,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                variants={revealVariants}
                whileHover={{ x: -3, y: -1 }}
              >
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    color: landingSignalInk(landingSignal(i)),
                    background: landingSignal(i),
                    padding: "2px 6px",
                    border: `1px solid ${INK}`,
                  }}
                >
                  →
                </span>
                {item}
              </motion.li>
            ))}
          </ul>
        </Card>
      </MotionGroup>
    </LandingSection>
  );
}

export function CtaFooterSection() {
  return (
    <LandingSection id="cta">
      <div style={{ textAlign: "center" }}>
        <SectionTitle>
          <span data-tour-id="cta-headline">¿Listo para abrir tu lab?</span>
        </SectionTitle>
        <p
          style={{
            fontSize: "clamp(0.95rem, 2vw, 1.05rem)",
            fontWeight: 500,
            color: "rgba(10,10,10,0.6)",
            marginTop: 12,
            marginBottom: 0,
            maxWidth: 560,
            lineHeight: 1.5,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Crea un workspace por marca. Los agentes hacen el resto — tú mantienes el control.
        </p>
        <div style={{ marginTop: 28 }}>
          <PrimaryCta href="/dashboard" tourId="cta-button">
            Crear workspace →
          </PrimaryCta>
        </div>
      </div>
    </LandingSection>
  );
}

export function LandingFooter() {
  return (
    <motion.footer
      style={{
        padding: "24px clamp(20px, 5vw, 48px)",
        borderTop: `3px solid ${INK}`,
        background: INK,
        color: PAPER,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
      initial={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.4 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <motion.div style={{ display: "inline-flex" }} whileHover={{ x: -2, y: -1 }}>
        <BrandWordmarkLinkFooter titleSize={16} suffixSize={12} />
      </motion.div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.1em", opacity: 0.55 }}>
        LAB DE MARKETING CON IA · V0.4
      </span>
    </motion.footer>
  );
}
