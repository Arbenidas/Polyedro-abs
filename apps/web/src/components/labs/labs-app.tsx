"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CampaignView } from "./campaign-view";
import {
  ACCENT,
  type AssetId,
  CMD,
  FONT_BLACK,
  FONT_MONO,
  FONT_SANS,
  GOAL,
  gridBg,
  INK,
  KIT_LOGS,
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
  const [view, setView] = useState<View>("onboard");
  const [brandInput, setBrandInput] = useState("NovaGear Tech");
  const [descInput, setDescInput] = useState(
    "Smart gadgets: wireless earbuds, fast chargers, LED lamps, smartwatches and home-office accessories. Affordable, modern, LatAm-focused.",
  );
  const [brandName, setBrandName] = useState("NovaGear Tech");
  const [markets, setMarkets] = useState<Record<string, boolean>>({ MX: true, CO: true, CL: true, PE: false, AR: false });
  const [kitDoneCount, setKitDoneCount] = useState(0);
  const [kitLogs, setKitLogs] = useState<{ t: string; msg: string }[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [goalPhase, setGoalPhase] = useState<"idle" | "listening" | "typing">("idle");
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

  /* ---------- onboarding ---------- */
  const initWorkspace = useCallback(() => {
    setBrandName(brandInput || "NovaGear Tech");
    setView("kitgen");
    setKitDoneCount(0);
    setKitLogs([]);
    KIT_LOGS.forEach(([t, msg], i) =>
      after(700 + i * 620, () => setKitLogs((s) => [...s, { t, msg }])),
    );
    for (let k = 1; k <= 6; k++) {
      after(900 + k * 700, () => setKitDoneCount(k));
    }
  }, [brandInput, after]);

  /* ---------- new campaign ---------- */
  const goalOrbClick = useCallback(() => {
    if (goalPhase !== "idle") return;
    setGoalPhase("listening");
    setGoalInput("");
    after(1500, () => {
      setGoalPhase("typing");
      let i = 0;
      intervalRef.current = setInterval(() => {
        i += 3;
        if (i >= GOAL.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setGoalInput(GOAL);
          setGoalPhase("idle");
        } else {
          setGoalInput(GOAL.slice(0, i));
        }
      }, 26);
    });
  }, [goalPhase, after]);

  const deployAgents = useCallback(() => {
    if (!goalInput) setGoalInput(GOAL);
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
  }, [goalInput, after]);

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
            background: "#FFFFFF",
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
                  background: ACCENT,
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
                color: ACCENT,
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
                  background: ACCENT,
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
                    borderLeft: `5px solid ${active ? ACCENT : "transparent"}`,
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
                      background: active ? ACCENT : "#FFFFFF",
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
                  background: ACCENT,
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
                }}
              >
                M
              </div>
              <div style={{ fontSize: 12 }}>
                <b style={{ fontWeight: 800 }}>Mariana</b>{" "}
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(10,10,10,0.5)" }}>· OWNER</span>
              </div>
            </div>
          </div>
        </aside>

        {/* TOP BAR */}
        <header
          style={{
            gridArea: "top",
            background: "#FFFFFF",
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
            <span style={{ background: INK, color: ACCENT, padding: "4px 9px" }}>~</span>
            <span style={{ color: "rgba(10,10,10,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {paths[view] ?? slug}
            </span>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 15,
                background: ACCENT,
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
                      background: i < currentStage ? STONE : i === currentStage ? (i === 4 ? VOLT : ACCENT) : "#FFFFFF",
                      color: i === currentStage && i === 4 ? "#FFFFFF" : i <= currentStage ? INK : "rgba(10,10,10,0.35)",
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
                    background: pushed ? VOLT : allApproved ? ACCENT : STONE,
                    color: pushed ? "#FFFFFF" : allApproved ? INK : "rgba(10,10,10,0.4)",
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
            <KitgenView kitDoneCount={kitDoneCount} kitLogs={kitLogs} goNewCampaign={() => setView("newcampaign")} />
          )}
          {view === "newcampaign" && (
            <NewCampaignView
              goalInput={goalInput}
              onGoalInput={setGoalInput}
              goalPhase={goalPhase}
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
          {view === "brandkit" && <BrandkitView brandName={brandName} />}
          {view === "agents" && <AgentsView />}
          {view === "automation" && <AutomationView />}
        </main>
      </div>
    </div>
  );
}
