import type { Metadata } from "next";

import LandingPage from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Polyedro /abs — Laboratorio de marketing con IA",
  description:
    "Un workspace por marca. Ocho agentes especializados construyen tu brand kit, campañas, copy, creativos y locuciones — tú apruebas, ellos ejecutan.",
};

export default function LandingRoute() {
  return <LandingPage />;
}
