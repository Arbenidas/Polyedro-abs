"use client";

import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import {
  ACID,
  CARD,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  INK,
  monoLabel,
  PAPER,
  textOnSignal,
} from "@/components/labs/defs";

import {
  cardVariants,
  motion,
  motionViewport,
  revealVariants,
  sectionShellVariants,
  staggerVariants,
} from "./landing-motion";

type LinkHref = ComponentProps<typeof Link>["href"];

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const titleSize =
    size === "lg" ? "clamp(3rem, 14vw, 11rem)" : size === "md" ? 20 : 16;
  const suffixSize =
    size === "lg" ? "clamp(2.25rem, 10vw, 8rem)" : size === "md" ? 18 : 14;

  return (
    <motion.div
      style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.12em" }}
      variants={revealVariants}
      whileHover={{ scale: 1.015, rotate: -0.4 }}
    >
      <span
        style={{
          fontFamily: FONT_BLACK,
          fontSize: titleSize,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        POLYEDRO
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: suffixSize,
          fontWeight: 700,
          background: ACID,
          padding: size === "lg" ? "0.06em 0.14em" : "0 5px",
          border: `${size === "lg" ? "0.06em" : "2px"} solid ${INK}`,
          lineHeight: 1,
          marginLeft: size === "lg" ? 0 : 6,
        }}
      >
        /abs
      </span>
    </motion.div>
  );
}

export function SectionLabel({
  children,
  accent = ACID,
}: {
  children: ReactNode;
  accent?: string;
}) {
  return (
    <motion.span
      style={{
        ...monoLabel,
        display: "inline-block",
        border: `2px solid ${INK}`,
        background: accent,
        color: textOnSignal(accent),
        padding: "5px 12px",
        marginBottom: 16,
      }}
      variants={revealVariants}
      whileHover={{ x: -2, y: -2, rotate: -1.2 }}
    >
      {children}
    </motion.span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <motion.h2
      style={{
        fontFamily: FONT_BLACK,
        fontSize: "clamp(1.75rem, 5vw, 2.75rem)",
        letterSpacing: "-0.02em",
        lineHeight: 1.05,
        margin: 0,
      }}
      variants={revealVariants}
    >
      {children}
    </motion.h2>
  );
}

export function SectionLead({ children }: { children: ReactNode }) {
  return (
    <motion.p
      style={{
        fontSize: "clamp(0.95rem, 2vw, 1.05rem)",
        fontWeight: 500,
        color: "rgba(10,10,10,0.6)",
        marginTop: 12,
        marginBottom: 0,
        maxWidth: 560,
        lineHeight: 1.5,
      }}
      variants={revealVariants}
    >
      {children}
    </motion.p>
  );
}

export function PrimaryCta({
  href,
  children,
  style,
  tourId,
}: {
  href: LinkHref;
  children: ReactNode;
  style?: CSSProperties;
  tourId?: string;
}) {
  return (
    <motion.span
      style={{
        display: "inline-block",
      }}
      variants={revealVariants}
      whileHover={{ scale: 1.035, rotate: -0.7 }}
      whileTap={{ scale: 0.97, x: 3, y: 3 }}
    >
      <Link
        href={href}
        data-tour-id={tourId}
        className="nb-press"
        style={{
          fontFamily: FONT_SANS,
          fontWeight: 800,
          textTransform: "uppercase",
          background: ACID,
          border: `3px solid ${INK}`,
          padding: "14px 22px",
          cursor: "pointer",
          textDecoration: "none",
          color: INK,
          display: "inline-block",
          fontSize: 14,
          letterSpacing: "0.04em",
          ...style,
        }}
      >
        {children}
      </Link>
    </motion.span>
  );
}

export function SecondaryCta({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <motion.span
      style={{
        display: "inline-block",
      }}
      variants={revealVariants}
      whileHover={{ scale: 1.025, rotate: 0.6 }}
      whileTap={{ scale: 0.97, x: 3, y: 3 }}
    >
      <a
        href={href}
        className="hov-paper nb-press"
        style={{
          fontFamily: FONT_SANS,
          fontWeight: 700,
          textTransform: "uppercase",
          background: CARD,
          border: `3px solid ${INK}`,
          padding: "14px 22px",
          cursor: "pointer",
          textDecoration: "none",
          color: INK,
          display: "inline-block",
          fontSize: 14,
          letterSpacing: "0.04em",
        }}
      >
        {children}
      </a>
    </motion.span>
  );
}

export function LandingSection({
  id,
  children,
  alt = false,
}: {
  id?: string;
  children: ReactNode;
  alt?: boolean;
}) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      style={{
        padding: "clamp(48px, 8vw, 96px) clamp(20px, 5vw, 48px)",
        background: alt ? CARD : PAPER,
        borderTop: alt ? `3px solid ${INK}` : undefined,
      }}
      variants={staggerVariants}
      viewport={motionViewport}
      whileInView="visible"
    >
      <motion.div style={{ maxWidth: 1100, margin: "0 auto" }} variants={sectionShellVariants}>
        {children}
      </motion.div>
    </motion.section>
  );
}

export function Card({
  children,
  style,
  tourId,
}: {
  children: ReactNode;
  style?: CSSProperties;
  tourId?: string;
}) {
  return (
    <motion.div
      data-tour-id={tourId}
      style={{
        background: CARD,
        border: `3px solid ${INK}`,
        boxShadow: `5px 5px 0 ${INK}`,
        ...style,
      }}
      variants={cardVariants}
      whileHover={{
        x: -3,
        y: -3,
        rotate: -0.35,
        boxShadow: `9px 9px 0 ${INK}`,
        transition: { type: "spring", stiffness: 420, damping: 20 },
      }}
      whileTap={{
        x: 4,
        y: 4,
        rotate: 0,
        boxShadow: `1px 1px 0 ${INK}`,
      }}
    >
      {children}
    </motion.div>
  );
}
