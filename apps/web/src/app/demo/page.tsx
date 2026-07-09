import type { Metadata } from "next";

import TakedownPage from "@/components/takedown-page";

export const metadata: Metadata = {
  title: "Polyedro /abs — Demo offline",
  description: "This Polyedro demo is no longer available.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <TakedownPage />;
}
