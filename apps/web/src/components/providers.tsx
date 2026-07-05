"use client";

import { Toaster } from "@Polyedro-abs/ui/components/sonner";

import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={{ type: "application/json" }}
    >
      <AuthProvider>{children}</AuthProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
