"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createBrand, createCampaignBrief, type Brand, type BrandKit, type TranscriptionResponse } from "@/lib/api";
import { useAuth } from "../auth-provider";
import { CampaignView } from "./campaign-view";
import {
  ACID,
  CARD,
  type AssetId,
  CMD,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  GOAL,
  gridBg,
  INK,
  NAV_DEFS,
  PAPER,
  RUN_DEFS,
  type Statuses,
  STONE,
  SUN,
  type View,
  VOLT,
} from "./defs";
import { GenliveView, KitgenView, NewCampaignView, OnboardingView } from "./flow-views";
import { AgentsView, AutomationView, BrandkitView } from "./library-views";
import { LoginView } from "./login-view";
import { useAudioTranscription } from "./use-audio-transcription";

const ALL_REVIEW: Statuses = {
  strategy: "review",
  audiences: "review",
  copy: "review",
  creatives: "review",
  video: "review",
  voice: "review",
};

const STAGE_ORDER = ["DRAFT", "GENERATING", "REVIEW", "APPROVED", "READY_TO_PUBLISH"] as const;

export default function LabsApp() {
  const { session, loading, signOut } = useAuth();
  const [view, setView] = useState<View>("onboard");
  const [brandInput, setBrandInput] = useState("NovaGear Tech");
  const [descInput, setDescInput] = useState(
    "Smart gadgets: wireless earbuds, fast chargers, LED lamps, smartwatches and home-office accessories. Affordable, modern, LatAm-focused.",
  );
  const [brandName, setBrandName] = useState("NovaGear Tech");
  const [markets, setMarkets] = useState<Record<string, boolean>>({ MX: true, CO: true, CL: true, PE: false, AR: false });
  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [kitSteps, setKitSteps] = useState<string[]>([]);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [goalTranscriptionId, setGoalTranscriptionId] = useState<string | null>(null);
  const [savedGoalBriefText, setSavedGoalBriefText] = useState<string | null>(null);
  const [goalBriefError, setGoalBriefError] = useState<string | null>(null);
  const [runIdx, setRunIdx] = useState(-1);
  const [statuses, setStatuses] = useState<Statuses>(ALL_REVIEW);
  const [pushed, setPushed] = useState(false);
  const [playEs, setPlayEs] = useState(false);
  const [playEn, setPlayEn] = useState(false);
  const [cmdPhase, setCmdPhase] = useState<"idle" | "listening" | "typing">("idle");
  const [cmdText, setCmdText] = useState("");
  const [copyUrgent, setCopyUrgent] = useState(false);
  const [copyVar, setCopyVar] = useState<"A" | "B">("A");

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const after = useCallback((ms: number, fn: () => void) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  const setSavedGoalBrief = useCallback((brief: TranscriptionResponse) => {
    setGoalTranscriptionId(brief.id);
    setSavedGoalBriefText(brief.text);
  }, []);

  const {
    phase: goalPhase,
    message: goalTranscriptionMessage,
    start: startGoalTranscription,
    stop: stopGoalTranscription,
  } = useAudioTranscription({
    brandId: brand?.id,
    onSaved: setSavedGoalBrief,
    onTranscript: setGoalInput,
  });

  /* ---------- onboarding ---------- */
  const initWorkspace = useCallback(() => {
    const name = brandInput || "NovaGear Tech";
    setBrandName(name);
    setView("kitgen");
    setBrand(null);
    setBrandKit(null);
    setKitSteps([]);
    setKitError(null);
    setKitLoading(true);

    createBrand({
      name,
      description: descInput || undefined,
      markets: Object.entries(markets)
        .filter(([, selected]) => selected)
        .map(([market]) => market),
    })
      .then(({ brand: createdBrand, brandKit: createdKit, generation }) => {
        setBrand(createdBrand);
        setBrandKit(createdKit);
        setKitSteps(generation.steps);
      })
      .catch((err: unknown) => {
        setKitError(err instanceof Error ? err.message : "Could not generate the brand kit.");
      })
      .finally(() => setKitLoading(false));
  }, [brandInput, descInput, markets]);

  /* ---------- new campaign ---------- */
  const goalOrbClick = useCallback(() => {
    if (goalPhase === "recording") {
      stopGoalTranscription();
      return;
    }

    if (goalPhase === "uploading") return;

    void startGoalTranscription().then((started) => {
      if (started) {
        setGoalInput("");
        setGoalTranscriptionId(null);
        setSavedGoalBriefText(null);
        setGoalBriefError(null);
      }
    });
  }, [goalPhase, startGoalTranscription, stopGoalTranscription]);

  const handleGoalInput = useCallback(
    (value: string) => {
      setGoalInput(value);
      setGoalBriefError(null);

      if (savedGoalBriefText !== null && value !== savedGoalBriefText) {
        setGoalTranscriptionId(null);
        setSavedGoalBriefText(null);
      }
    },
    [savedGoalBriefText],
  );

  const deployAgents = useCallback(async () => {
    const nextGoal = goalInput.trim() || GOAL;

    if (!goalInput.trim()) setGoalInput(nextGoal);

    if (!brand) {
      setGoalBriefError("BRAND REQUIRED BEFORE SAVING BRIEF");
      return;
    }

    if (nextGoal !== savedGoalBriefText) {
      try {
        const brief = await createCampaignBrief({
          brandId: brand.id,
          text: nextGoal,
        });
        setSavedGoalBrief(brief);
        setGoalBriefError(null);
      } catch (err) {
        setGoalBriefError(err instanceof Error ? err.message.toUpperCase() : "COULD NOT SAVE BRIEF");
        return;
      }
    }

    setView("genlive");
    setRunIdx(0);
    const N = RUN_DEFS.length;
    for (let k = 1; k <= N; k++) {
      after(k * 950, () => {
        if (k < N) {
          setRunIdx(k);
        } else {
          setRunIdx(N);
          setStatuses(ALL_REVIEW);
          setPushed(false);
          setCmdText("7 assets generated — awaiting your review.");
          after(800, () => setView("campaign"));
        }
      });
    }
  }, [brand, goalInput, savedGoalBriefText, setSavedGoalBrief, after]);

  /* ---------- campaign assets ---------- */
  const setStatus = useCallback((id: AssetId, status: Statuses[AssetId]) => {
    setStatuses((s) => ({ ...s, [id]: status }));
  }, []);

  const approve = useCallback(
    (id: AssetId) => {
      setStatuses((s) => (s[id] === "review" ? { ...s, [id]: "approved" } : s));
    },
    [],
  );

  const regen = useCallback(
    (id: AssetId) => {
      setStatus(id, "generating");
      after(2000, () => setStatus(id, "review"));
    },
    [setStatus, after],
  );

  const voiceCmdClick = useCallback(() => {
    if (cmdPhase !== "idle") return;
    setCmdPhase("listening");
    setCmdText("");
    after(1400, () => {
      setCmdPhase("typing");
      let i = 0;
      intervalRef.current = setInterval(() => {
        i += 3;
        if (i >= CMD.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setCmdText(CMD);
          setStatus("copy", "generating");
          after(1800, () => {
            setCopyUrgent(true);
            setCmdPhase("idle");
            setCmdText("Applied — Spanish headline recut by Meta Ads Agent.");
            setStatus("copy", "review");
          });
        } else {
          setCmdText(CMD.slice(0, i));
        }
      }, 24);
    });
  }, [cmdPhase, after, setStatus]);

  /* ---------- derived ---------- */
  const approvedCount = Object.values(statuses).filter((x) => x === "approved").length;
  const allApproved = approvedCount === 6;
  const anyGenerating = Object.values(statuses).includes("generating");
  const currentStage = pushed ? 4 : allApproved ? 3 : anyGenerating ? 1 : 2;

  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const paths: Record<string, string> = {
    kitgen: `${slug}/brand-kit --generate`,
    newcampaign: `${slug}/campaigns/new`,
    genlive: `${slug}/campaigns/cmp-004 --running`,
    campaign: `${slug}/campaigns/cmp-004`,
    brandkit: `${slug}/brand-kit`,
    agents: `${slug}/agents`,
    automation: `${slug}/automation`,
  };

  const brandInitials = brandName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pushable = allApproved && !pushed;

  const userEmail = session?.user.email ?? "";
  const userName =
    (typeof session?.user.user_metadata?.name === "string" && session.user.user_metadata.name) ||
    userEmail.split("@")[0] ||
    "user";
  const userInitial = userName.charAt(0).toUpperCase() || "U";

  if (loading) {
    return (
      <div
        className="lab-root"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          color: INK,
          fontFamily: FONT_MONO,
          fontSize: 12,
          letterSpacing: "0.1em",
        }}
      >
        RESTORING SESSION…
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  if (view === "onboard") {
    return (
      <div className="lab-root" style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: FONT_SANS }}>
        <OnboardingView
          brandInput={brandInput}
          onBrandInput={setBrandInput}
          descInput={descInput}
          onDescInput={setDescInput}
          markets={markets}
          toggleMarket={(m) => setMarkets((s) => ({ ...s, [m]: !s[m] }))}
          initWorkspace={initWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="lab-root" style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: FONT_SANS }}>
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "250px 1fr",
          gridTemplateRows: "auto 1fr",
          gridTemplateAreas: "'side top' 'side main'",
        }}
      >
        {/* SIDEBAR */}
        <aside
          style={{
            gridArea: "side",
            background: CARD,
            borderRight: `3px solid ${INK}`,
            display: "flex",
            flexDirection: "column",
            position: "sticky",
            top: 0,
            maxHeight: "100vh",
          }}
        >
          <div style={{ padding: "18px 18px 16px", borderBottom: `3px solid ${INK}` }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontFamily: FONT_BLACK, fontSize: 19, letterSpacing: "-0.02em" }}>POLYEDRO</span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 17,
                  fontWeight: 700,
                  background: ACID,
                  padding: "0 5px",
                  border: `2px solid ${INK}`,
                  marginLeft: 5,
                }}
              >
                /abs
              </span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.1em", color: "rgba(10,10,10,0.5)", marginTop: 6 }}>
              AI MARKETING LAB
            </div>
          </div>

          <div style={{ padding: "16px 18px", borderBottom: `2px solid ${INK}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: INK,
                color: ACID,
                fontFamily: FONT_BLACK,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {brandInitials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {brandName}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(10,10,10,0.5)" }}>WORKSPACE ▾</div>
            </div>
          </div>

          <div style={{ padding: "14px 16px", borderBottom: `2px solid ${INK}` }}>
            <button
              onClick={() => setView("newcampaign")}
              className="nb-press"
              style={
                {
                  width: "100%",
                  fontFamily: FONT_SANS,
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: ACID,
                  border: `3px solid ${INK}`,
                  padding: 11,
                  cursor: "pointer",
                  "--sx": "3px",
                } as CSSProperties
              }
            >
              + New campaign
            </button>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", padding: "10px 0" }}>
            {NAV_DEFS.map((nv) => {
              const active = view === nv.id;
              return (
                <div
                  key={nv.id}
                  onClick={() => setView(nv.id)}
                  className="hov-paper"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "11px 18px",
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: active ? 800 : 600,
                    background: active ? PAPER : "transparent",
                    borderLeft: `5px solid ${active ? ACID : "transparent"}`,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, opacity: 0.55 }}>{nv.icon}</span>
                    {nv.label}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      background: active ? ACID : CARD,
                      border: `1.5px solid ${INK}`,
                      padding: "1px 6px",
                    }}
                  >
                    {nv.badge}
                  </span>
                </div>
              );
            })}
          </nav>

          <div
            style={{
              marginTop: "auto",
              borderTop: `2px solid ${INK}`,
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT_MONO, fontSize: 10.5, color: "rgba(10,10,10,0.6)" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: ACID,
                  border: `1.5px solid ${INK}`,
                  animation: "pv-pulse 1.6s ease-in-out infinite",
                }}
              />
              8 AGENTS ONLINE
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: `2px solid ${INK}`,
                  background: SUN,
                  fontFamily: FONT_BLACK,
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                {userInitial}
              </div>
              <div style={{ fontSize: 12, minWidth: 0 }}>
                <b
                  style={{
                    fontWeight: 800,
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={userEmail}
                >
                  {userName}
                </b>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(10,10,10,0.5)" }}>OWNER</span>
              </div>
            </div>
            <button
              onClick={() => void signOut()}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                background: "#FFFFFF",
                border: `2px solid ${INK}`,
                padding: "6px 8px",
                cursor: "pointer",
              }}
            >
              SIGN OUT →
            </button>
          </div>
        </aside>

        {/* TOP BAR */}
        <header
          style={{
            gridArea: "top",
            background: CARD,
            borderBottom: `3px solid ${INK}`,
            padding: "12px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            position: "sticky",
            top: 0,
            zIndex: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600 }}>
            <span style={{ background: INK, color: ACID, padding: "4px 9px" }}>~</span>
            <span style={{ color: "rgba(10,10,10,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {paths[view] ?? slug}
            </span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 15,
                background: ACID,
                border: `1.5px solid ${INK}`,
                animation: "pv-blink 1.1s step-end infinite",
              }}
            />
          </div>
          {view === "campaign" && (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.03em" }}>
                {STAGE_ORDER.map((label, i) => (
                  <span
                    key={label}
                    style={{
                      padding: "4px 8px",
                      border: `2px solid ${INK}`,
                      background: i < currentStage ? STONE : i === currentStage ? (i === 4 ? VOLT : ACID) : CARD,
                      color: i === currentStage && i === 4 ? CARD : i <= currentStage ? INK : "rgba(10,10,10,0.35)",
                      marginLeft: -2,
                      animation: i === currentStage && i === 1 ? "pv-pulse 1s ease-in-out infinite" : "none",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  if (pushable) setPushed(true);
                }}
                disabled={!pushable}
                className="nb-press"
                style={
                  {
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: pushed ? VOLT : allApproved ? ACID : STONE,
                    color: pushed ? CARD : allApproved ? INK : "rgba(10,10,10,0.4)",
                    border: `3px solid ${INK}`,
                    padding: "10px 18px",
                    cursor: pushable ? "pointer" : "default",
                    "--sx": "4px",
                  } as CSSProperties
                }
              >
                {pushed ? "⟶ Queued in n8n" : "Push to Meta Ads"}
              </button>
            </div>
          )}
        </header>

        {/* MAIN */}
        <main style={{ gridArea: "main", padding: "26px 26px 120px", minWidth: 0, backgroundImage: gridBg(0.035) }}>
          {view === "kitgen" && (
            <KitgenView
              brandKit={brandKit}
              steps={kitSteps}
              loading={kitLoading}
              error={kitError}
              goNewCampaign={() => setView("newcampaign")}
            />
          )}
          {view === "newcampaign" && (
            <NewCampaignView
              goalInput={goalInput}
              onGoalInput={handleGoalInput}
              goalPhase={goalPhase}
              goalMessage={goalBriefError ?? goalTranscriptionMessage}
              goalTranscriptionId={goalTranscriptionId}
              goalOrbClick={goalOrbClick}
              deployAgents={deployAgents}
            />
          )}
          {view === "genlive" && <GenliveView runIdx={runIdx} goalEcho={goalInput} />}
          {view === "campaign" && (
            <CampaignView
              statuses={statuses}
              approve={approve}
              regen={regen}
              copyVar={copyVar}
              setCopyVar={setCopyVar}
              copyUrgent={copyUrgent}
              brandName={brandName}
              playEs={playEs}
              playEn={playEn}
              togglePlayEs={() => {
                setPlayEs((v) => !v);
                setPlayEn(false);
              }}
              togglePlayEn={() => {
                setPlayEn((v) => !v);
                setPlayEs(false);
              }}
              pushed={pushed}
              cmdPhase={cmdPhase}
              cmdText={cmdText}
              voiceCmdClick={voiceCmdClick}
            />
          )}
          {view === "brandkit" && <BrandkitView brand={brand} brandKit={brandKit} />}
          {view === "agents" && <AgentsView />}
          {view === "automation" && <AutomationView />}
        </main>
      </div>
    </div>
  );
}
