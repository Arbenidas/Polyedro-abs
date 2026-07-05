import type { AssetStatus } from "@/components/labs/defs";
import { ACID, CARD, CORAL, textOnSignal, VOLT } from "@/components/labs/defs";

/** Landing uses only Acid, Volt and Coral as signal colors. */
export const LANDING_SIGNALS = [ACID, VOLT, CORAL] as const;

export function landingSignal(index: number): (typeof LANDING_SIGNALS)[number] {
  return LANDING_SIGNALS[index % LANDING_SIGNALS.length]!;
}

export const LANDING_STATUS_STYLE: Record<
  AssetStatus,
  { bg: string; label: string; anim?: string }
> = {
  draft: { bg: CARD, label: "BORRADOR" },
  generating: { bg: VOLT, label: "GENERANDO", anim: "pv-pulse 1s ease-in-out infinite" },
  review: { bg: CORAL, label: "REVISIÓN" },
  approved: { bg: ACID, label: "APROBADO ✓" },
};

/** @deprecated Use textOnSignal from defs */
export const landingSignalInk = textOnSignal;
