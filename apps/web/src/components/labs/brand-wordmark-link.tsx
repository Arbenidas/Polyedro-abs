"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { useAuth } from "../auth-provider";
import { ACID, FONT_BLACK, FONT_MONO, INK, PAPER } from "./defs";

export function useBrandHomeHref(): "/" | "/dashboard" {
  const { session } = useAuth();
  return session ? "/dashboard" : "/";
}

type BrandWordmarkLinkProps = {
  titleSize?: number | string;
  suffixSize?: number | string;
  suffixBorderColor?: string;
  textColor?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function BrandWordmarkLink({
  titleSize = 20,
  suffixSize = 18,
  suffixBorderColor = INK,
  textColor = INK,
  className,
  style,
  children,
}: BrandWordmarkLinkProps) {
  const href = useBrandHomeHref();

  return (
    <Link
      href={href}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        textDecoration: "none",
        color: textColor,
        cursor: "pointer",
        ...style,
      }}
    >
      <span style={{ fontFamily: FONT_BLACK, fontSize: titleSize, letterSpacing: "-0.02em" }}>POLYEDRO</span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: suffixSize,
          fontWeight: 700,
          background: ACID,
          padding: "0 5px",
          border: `2px solid ${suffixBorderColor}`,
          marginLeft: 6,
        }}
      >
        /abs
      </span>
      {children}
    </Link>
  );
}

/** Footer wordmark on dark background — PAPER border on /abs chip */
export function BrandWordmarkLinkFooter(props: Omit<BrandWordmarkLinkProps, "suffixBorderColor" | "textColor">) {
  return <BrandWordmarkLink suffixBorderColor={PAPER} textColor={PAPER} {...props} />;
}
