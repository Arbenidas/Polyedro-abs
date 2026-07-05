"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  approveCampaignAsset,
  createBrand,
  createCampaign,
  createCampaignBrief,
  exportCampaignToMetaAds,
  getCampaignDashboard,
  regenerateCampaignAsset,
  runCampaignAgent,
  type AssetStatus as ApiAssetStatus,
  type Brand,
  type BrandKit,
  type CampaignAssetTarget,
  type CampaignDashboard,
  type TranscriptionResponse,
} from "@/lib/api";
import { useCampaignProgress, type CampaignProgressEvent } from "@/lib/use-campaign-progress";
import { useAuth } from "../auth-provider";
import { CampaignView } from "./campaign-view";
import { BrandWordmarkLink } from "./brand-wordmark-link";
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
import { GenliveView, KitgenView, type LiveGenerationStep, NewCampaignView, OnboardingView } from "./flow-views";
import { AgentsView, AutomationView, BrandkitView } from "./library-views";
import { LoginView } from "./login-view";
import { SignOutButton } from "./sign-out-button";
import { useAudioTranscription } from "./use-audio-transcription";

const ALL_REVIEW: Statuses = {
  strategy: "review",
  audiences: "review",
  copy: "review",
  creatives: "review",
  video: "review",
  voice: "review",
};

const ALL_DRAFT: Statuses = {
  strategy: "draft",
  audiences: "draft",
  copy: "draft",
  creatives: "draft",
  video: "draft",
  voice: "draft",
};

const STAGE_ORDER = ["DRAFT", "GENERATING", "REVIEW", "APPROVED", "READY_TO_PUBLISH"] as const;

type AssetAction = { target: CampaignAssetTarget; id: string };

const isApprovedStatus = (status: ApiAssetStatus | undefined) =>
  status === "approved" || status === "ready_to_publish";

const toLabStatus = (status: ApiAssetStatus | null | undefined): Statuses[AssetId] => {
  if (!status) return "draft";
  if (status === "generating") return "generating";
  if (isApprovedStatus(status)) return "approved";
  if (status === "review" || status === "rejected") return "review";
  return "draft";
};

const collectionStatus = (items: { status: ApiAssetStatus }[]): Statuses[AssetId] => {
  if (items.length === 0) return "draft";
  if (items.some((item) => item.status === "generating")) return "generating";
  if (items.every((item) => isApprovedStatus(item.status))) return "approved";
  return "review";
};

const statusesFromDashboard = (dashboard: CampaignDashboard | null): Statuses => {
  if (!dashboard) return ALL_DRAFT;
  const strategyStatus = toLabStatus(dashboard.agents.strategy?.status);

  return {
    strategy: strategyStatus,
    audiences: strategyStatus,
    copy: collectionStatus(dashboard.agents.adCopies),
    creatives: collectionStatus(dashboard.agents.visualAssets),
    video: collectionStatus(dashboard.agents.videoScripts),
    voice: collectionStatus(dashboard.agents.voiceovers),
  };
};

const notApproved = (item: { status: ApiAssetStatus }) => !isApprovedStatus(item.status);

const getApprovalTargets = (dashboard: CampaignDashboard, id: AssetId): AssetAction[] => {
  switch (id) {
    case "strategy":
    case "audiences":
      return dashboard.agents.strategy && notApproved(dashboard.agents.strategy)
        ? [{ target: "strategy", id: dashboard.agents.strategy.id }]
        : [];
    case "copy":
      return dashboard.agents.adCopies.filter(notApproved).map((copy) => ({
        target: "ad_copy",
        id: copy.id,
      }));
    case "creatives":
      return dashboard.agents.visualAssets.filter(notApproved).map((asset) => ({
        target: "creative_asset",
        id: asset.id,
      }));
    case "video":
      return dashboard.agents.videoScripts.filter(notApproved).map((script) => ({
        target: "video_script",
        id: script.id,
      }));
    case "voice":
      return dashboard.agents.voiceovers.filter(notApproved).map((voiceover) => ({
        target: "voiceover",
        id: voiceover.id,
      }));
  }
};

const getRegenerationTargets = (
  dashboard: CampaignDashboard,
  id: AssetId,
  copyVar: "A" | "B",
): AssetAction[] => {
  switch (id) {
    case "strategy":
    case "audiences":
      return dashboard.agents.strategy ? [{ target: "strategy", id: dashboard.agents.strategy.id }] : [];
    case "copy": {
      const variant = copyVar.toLowerCase() as "a" | "b";
      const selected =
        dashboard.agents.adCopies.find((copy) => copy.language === "es" && copy.variant === variant) ??
        dashboard.agents.adCopies.find((copy) => copy.variant === variant) ??
        dashboard.agents.adCopies[0];
      return selected ? [{ target: "ad_copy", id: selected.id }] : [];
    }
    case "creatives":
      return dashboard.agents.visualAssets.map((asset) => ({
        target: "creative_asset",
        id: asset.id,
      }));
    case "video":
      return dashboard.agents.videoScripts[0]
        ? [{ target: "video_script", id: dashboard.agents.videoScripts[0].id }]
        : [];
    case "voice":
      // "voice" se maneja antes en regen() (corre el Voice Agent directo), así
      // que este caso no se alcanza; retorna vacío para mantener exhaustividad.
      return [];
  }
};

const agentStateFromEvents = (
  events: CampaignProgressEvent[],
  agent: "strategy" | "meta_ads" | "creative",
  fallbackDone: boolean,
): LiveGenerationStep["state"] => {
  const relevant = events.filter((event) => event.data.agent === agent);
  if (relevant.some((event) => event.type === "agent_completed" && event.data.outcome === "failed")) {
    return "failed";
  }
  if (
    relevant.some((event) => event.type === "agent_completed" && event.data.outcome === "succeeded") ||
    fallbackDone
  ) {
    return "done";
  }
  if (relevant.length > 0) {
    return "running";
  }
  return "queued";
};

export default function LabsApp() {
  const { session, loading } = useAuth();
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
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CampaignDashboard | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Campaña ya creada para el brief actual — evita duplicar si un agente falla
  // y el usuario reintenta Deploy con el mismo objetivo.
  const deployedCampaignRef = useRef<{ id: string; objective: string } | null>(null);
  const { events: progressEvents, transport: progressTransport } = useCampaignProgress(campaignId);

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
    setStatuses(ALL_DRAFT);
    setPushed(false);
    setDashboard(null);
    setCampaignError(null);
    setCmdText("Creating campaign and starting agents…");

    // Reutiliza la campaña ya creada para este mismo objetivo (reintento tras
    // un fallo de agente) en vez de crear una duplicada.
    const reuse =
      deployedCampaignRef.current?.objective === nextGoal ? deployedCampaignRef.current : null;
    let nextCampaignId: string | null = reuse?.id ?? null;
    setCampaignId(nextCampaignId);

    try {
      if (!nextCampaignId) {
        const created = await createCampaign({
          brandId: brand.id,
          name: `${brandName || brand.name} Campaign`,
          objective: nextGoal,
        });
        nextCampaignId = created.campaign.id;
        deployedCampaignRef.current = { id: nextCampaignId, objective: nextGoal };
        setCampaignId(nextCampaignId);
      }

      // Los tres agentes escriben assets disjuntos; corren en paralelo para no
      // sumar sus latencias. Se sincroniza el dashboard una sola vez al final.
      await Promise.all([
        runCampaignAgent(nextCampaignId, "meta-ads"),
        runCampaignAgent(nextCampaignId, "creative"),
        runCampaignAgent(nextCampaignId, "video"),
      ]);

      const latestDashboard = await getCampaignDashboard(nextCampaignId);
      setDashboard(latestDashboard);
      setStatuses(statusesFromDashboard(latestDashboard));
      setCmdText("Campaign agents finished — dashboard synced.");
      setView("campaign");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate campaign.";
      setCampaignError(message);
      setCmdText(message);
      // Si la campaña ya existe, llevar al usuario a su dashboard para que vea
      // y apruebe lo que sí se generó (y pueda regenerar lo que falló), en vez
      // de dejarlo atascado en la pantalla de generación.
      if (nextCampaignId) {
        try {
          const partial = await getCampaignDashboard(nextCampaignId);
          setDashboard(partial);
          setStatuses(statusesFromDashboard(partial));
        } catch {
          // Si ni el dashboard carga, se queda el error en pantalla.
        }
        setView("campaign");
      }
    }
  }, [brand, brandName, goalInput, savedGoalBriefText, setSavedGoalBrief]);

  /* ---------- campaign assets ---------- */
  const setStatus = useCallback((id: AssetId, status: Statuses[AssetId]) => {
    setStatuses((s) => ({ ...s, [id]: status }));
  }, []);

  const approve = useCallback(
    async (id: AssetId) => {
      if (!campaignId || !dashboard) {
        setStatuses((s) => (s[id] === "review" ? { ...s, [id]: "approved" } : s));
        return;
      }

      const targets = getApprovalTargets(dashboard, id);
      if (targets.length === 0) {
        setCampaignError("No real asset is available for this approval yet.");
        return;
      }

      try {
        setCampaignError(null);
        let nextDashboard = dashboard;
        for (const target of targets) {
          nextDashboard = await approveCampaignAsset(campaignId, target);
        }
        setDashboard(nextDashboard);
        setStatuses(statusesFromDashboard(nextDashboard));
      } catch (err) {
        setCampaignError(err instanceof Error ? err.message : "Could not approve asset.");
      }
    },
    [campaignId, dashboard],
  );

  // Devuelve true solo si la regeneración realmente ocurrió, para que los
  // callers (ej. el comando de voz) no reporten éxito cuando la API falló.
  const regen = useCallback(
    async (id: AssetId): Promise<boolean> => {
      if (!campaignId || !dashboard) {
        setStatus(id, "generating");
        return true;
      }

      // El Voice Agent no tiene endpoint de regenerate por-fila: corre el agente
      // (upsert del par ES/EN) tanto para el primer "Generate" como para regenerar.
      if (id === "voice") {
        setStatus("voice", "generating");
        try {
          setCampaignError(null);
          await runCampaignAgent(campaignId, "voice");
          const nextDashboard = await getCampaignDashboard(campaignId);
          setDashboard(nextDashboard);
          setStatuses(statusesFromDashboard(nextDashboard));
          return true;
        } catch (err) {
          setCampaignError(err instanceof Error ? err.message : "Could not generate voiceovers.");
          setStatuses(statusesFromDashboard(dashboard));
          return false;
        }
      }

      const targets = getRegenerationTargets(dashboard, id, copyVar);
      if (targets.length === 0) {
        setCampaignError("No real asset is available to regenerate yet.");
        return false;
      }

      setStatus(id, "generating");
      try {
        setCampaignError(null);
        let nextDashboard = dashboard;
        for (const target of targets) {
          nextDashboard = await regenerateCampaignAsset(campaignId, target);
        }
        setDashboard(nextDashboard);
        setStatuses(statusesFromDashboard(nextDashboard));
        return true;
      } catch (err) {
        setCampaignError(err instanceof Error ? err.message : "Could not regenerate asset.");
        setStatuses(statusesFromDashboard(dashboard));
        return false;
      }
    },
    [campaignId, copyVar, dashboard, setStatus],
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
          void regen("copy").then((ok) => {
            setCmdPhase("idle");
            if (ok) {
              setCopyUrgent(true);
              setCmdText("Applied — Spanish headline recut by Meta Ads Agent.");
            } else {
              setCmdText("No se pudo aplicar el cambio — reintentá.");
            }
          });
        } else {
          setCmdText(CMD.slice(0, i));
        }
      }, 24);
    });
  }, [cmdPhase, after, regen]);

  /* ---------- derived ---------- */
  const visibleStatuses = dashboard ? statusesFromDashboard(dashboard) : statuses;
  const approvedCount = dashboard?.progress.approved ?? Object.values(visibleStatuses).filter((x) => x === "approved").length;
  const totalCount = dashboard?.progress.total ?? 6;
  const allApproved = dashboard?.progress.readyToPublish ?? approvedCount === totalCount;
  const anyGenerating = Object.values(visibleStatuses).includes("generating");
  const exported = pushed || dashboard?.latestExport?.exportStatus === "sent";
  const currentStage = exported ? 4 : allApproved ? 3 : anyGenerating ? 1 : dashboard ? 2 : 0;

  const liveSteps = useMemo<LiveGenerationStep[]>(() => {
    const strategyDone = !!dashboard?.agents.strategy && dashboard.agents.strategy.status !== "generating";
    const metaDone = dashboard ? dashboard.agents.adCopies.length > 0 && collectionStatus(dashboard.agents.adCopies) !== "generating" : false;
    const creativeDone = dashboard
      ? dashboard.agents.visualAssets.length > 0 && collectionStatus(dashboard.agents.visualAssets) !== "generating"
      : false;
    const hasVideo = (dashboard?.agents.videoScripts.length ?? 0) > 0;
    const hasVoice = (dashboard?.agents.voiceovers.length ?? 0) > 0;

    return RUN_DEFS.map((step, index) => {
      let state: LiveGenerationStep["state"] = "queued";
      if (campaignError && index === RUN_DEFS.length - 1) {
        state = "failed";
      } else if (index === 0 || index === 1) {
        state = agentStateFromEvents(progressEvents, "strategy", strategyDone);
      } else if (index === 2) {
        state = agentStateFromEvents(progressEvents, "meta_ads", metaDone);
      } else if (index === 3) {
        state = agentStateFromEvents(progressEvents, "creative", creativeDone);
      } else if (index === 4) {
        state = hasVideo ? "done" : "queued";
      } else if (index === 5) {
        state = hasVoice ? "done" : "queued";
      } else if (dashboard && !campaignError) {
        state = "done";
      }

      return { ...step, state };
    });
  }, [campaignError, dashboard, progressEvents]);

  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const paths: Record<string, string> = {
    kitgen: `${slug}/brand-kit --generate`,
    newcampaign: `${slug}/campaigns/new`,
    genlive: `${slug}/campaigns/${campaignId?.slice(0, 8) ?? "new"} --running`,
    campaign: `${slug}/campaigns/${campaignId?.slice(0, 8) ?? "new"}`,
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

  const pushable = allApproved && !exported;

  const pushToMetaAds = useCallback(async () => {
    if (!pushable) return;

    if (!campaignId) {
      setPushed(true);
      return;
    }

    try {
      setCampaignError(null);
      const result = await exportCampaignToMetaAds(campaignId);
      setDashboard(result.dashboard);
      setPushed(true);
      setCmdText("READY_TO_PUBLISH — n8n export queued.");
    } catch (err) {
      setCampaignError(err instanceof Error ? err.message : "Could not export campaign.");
    }
  }, [campaignId, pushable]);

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
            <BrandWordmarkLink titleSize={19} suffixSize={17} />
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
            <SignOutButton fullWidth />
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
                onClick={() => void pushToMetaAds()}
                disabled={!pushable}
                className="nb-press"
                style={
                  {
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: exported ? VOLT : allApproved ? ACID : STONE,
                    color: exported ? CARD : allApproved ? INK : "rgba(10,10,10,0.4)",
                    border: `3px solid ${INK}`,
                    padding: "10px 18px",
                    cursor: pushable ? "pointer" : "default",
                    "--sx": "4px",
                  } as CSSProperties
                }
              >
                {exported ? "⟶ Queued in n8n" : "Push to Meta Ads"}
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
          {view === "genlive" && (
            <GenliveView
              runIdx={runIdx}
              goalEcho={goalInput}
              steps={liveSteps}
              campaignLabel={campaignId?.slice(0, 8) ?? "new"}
              transport={progressTransport}
              error={campaignError}
            />
          )}
          {view === "campaign" && (
            <CampaignView
              dashboard={dashboard}
              statuses={visibleStatuses}
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
              pushed={exported}
              actionMessage={campaignError}
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
