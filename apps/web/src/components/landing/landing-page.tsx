"use client";

import { MotionConfig } from "framer-motion";

import {
  FONT_SANS,
  gridBg,
  INK,
  PAPER,
} from "@/components/labs/defs";

import GuideAgentShell from "./guide-agent-shell";
import { motion, pageVariants } from "./landing-motion";
import {
  AgentsSection,
  ApprovalSection,
  AudienceSection,
  AutomationSection,
  CtaFooterSection,
  DemoSection,
  ElevenLabsVoiceSection,
  GuideSection,
  HeroSection,
  HowItWorksSection,
  LandingFooter,
  LandingHeader,
  PipelineSection,
  PricingSection,
  ProblemSection,
} from "./landing-sections";

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        animate="visible"
        className="lab-root landing-motion-root"
        initial="hidden"
        lang="es"
        style={{
          minHeight: "100vh",
          overflowX: "hidden",
          background: PAPER,
          backgroundImage: gridBg(0.035),
          color: INK,
          fontFamily: FONT_SANS,
          scrollBehavior: "smooth",
        }}
        variants={pageVariants}
      >
        <LandingHeader />
        <main>
          <HeroSection />
          <ProblemSection />
          <HowItWorksSection />
          <AgentsSection />
          <ElevenLabsVoiceSection />
          <PipelineSection />
          <ApprovalSection />
          <AutomationSection />
          <DemoSection />
          <AudienceSection />
          <PricingSection />
          <GuideSection />
          <CtaFooterSection />
        </main>
        <LandingFooter />
        <GuideAgentShell />
        <style>{`html { scroll-behavior: smooth; }`}</style>
      </motion.div>
    </MotionConfig>
  );
}
