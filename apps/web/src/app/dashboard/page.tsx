import type { Metadata } from "next";

import LabsApp from "@/components/labs/labs-app";

export const metadata: Metadata = {
  title: "Polyedro /abs — Dashboard",
  description:
    "Un workspace por marca. Ocho agentes especializados construyen tu brand kit, campañas, copy, creativos y locuciones — tú apruebas, ellos ejecutan.",
};

export default function DashboardPage() {
  return <LabsApp />;
}
