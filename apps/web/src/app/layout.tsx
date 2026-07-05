import type { Metadata } from "next";

import "../index.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "Polyedro /abs — AI Marketing Lab",
  description:
    "One workspace per brand. Eight specialized agents build your brand kit, campaigns, copy, creatives and voiceovers — you approve, they execute.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
