"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { CORAL, FONT_MONO } from "@/components/labs/defs";

type GuideAgentErrorBoundaryProps = {
  children: ReactNode;
  language: "es" | "en";
};

type GuideAgentErrorBoundaryState = {
  error: string | null;
};

export class GuideAgentErrorBoundary extends Component<
  GuideAgentErrorBoundaryProps,
  GuideAgentErrorBoundaryState
> {
  state: GuideAgentErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): GuideAgentErrorBoundaryState {
    if (error instanceof Error && error.message.trim()) {
      return { error: error.message };
    }

    if (typeof error === "string" && error.trim()) {
      return { error: error.trim() };
    }

    return { error: "Unexpected guide agent error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Guide Agent]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <p
          style={{
            margin: 0,
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: "0.04em",
            color: CORAL,
            lineHeight: 1.4,
          }}
        >
          {this.props.language === "es"
            ? `Error del agente: ${this.state.error}. Pulsa ▶ para reintentar.`
            : `Agent error: ${this.state.error}. Press ▶ to retry.`}
        </p>
      );
    }

    return this.props.children;
  }
}
