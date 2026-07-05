import {
  FONT_SANS,
  gridBg,
  INK,
  PAPER,
} from "@/components/labs/defs";

import GuideAgentShell from "./guide-agent-shell";
import {
  AgentsSection,
  ApprovalSection,
  AudienceSection,
  AutomationSection,
  CtaFooterSection,
  DemoSection,
  GuideSection,
  HeroSection,
  HowItWorksSection,
  LandingFooter,
  LandingHeader,
  PipelineSection,
  ProblemSection,
} from "./landing-sections";

export default function LandingPage() {
  return (
    <div
      className="lab-root"
      lang="es"
      style={{
        minHeight: "100vh",
        background: PAPER,
        backgroundImage: gridBg(0.035),
        color: INK,
        fontFamily: FONT_SANS,
        scrollBehavior: "smooth",
      }}
    >
      <LandingHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <AgentsSection />
        <PipelineSection />
        <ApprovalSection />
        <AutomationSection />
        <DemoSection />
        <AudienceSection />
        <GuideSection />
        <CtaFooterSection />
      </main>
      <LandingFooter />
      <GuideAgentShell />
      <style>{`html { scroll-behavior: smooth; }`}</style>
    </div>
  );
}
