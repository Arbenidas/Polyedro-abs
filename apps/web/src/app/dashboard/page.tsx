import type { Metadata } from "next";

import LabsApp from "@/components/labs/labs-app";

export const metadata: Metadata = {
  title: "Polyedro /abs — Dashboard",
  description:
    "One workspace per brand. Eight specialized agents build your brand kit, campaigns, copy, creatives and voiceovers — you approve, they execute.",
};

export default function DashboardPage() {
  return <LabsApp />;
}
