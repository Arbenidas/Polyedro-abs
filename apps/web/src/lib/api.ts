import { env } from "@Polyedro-abs/env/web";

import { supabase } from "./supabase";

/** fetch contra apps/server adjuntando el access token de la sesión actual
 *  (`Authorization: Bearer <jwt>`), que el server valida con Supabase Auth. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${env.NEXT_PUBLIC_SERVER_URL}${path}`, { ...init, headers });
}

export type AssetStatus = "draft" | "generating" | "review" | "approved" | "ready_to_publish" | "rejected";
export type CampaignAssetTarget = "strategy" | "ad_copy" | "creative_asset" | "video_script" | "voiceover";

export type Bilingual<T = string> = { es: T; en: T };

export type ColorPalette = {
  primary: string;
  secondary: string;
  accent: string;
  neutrals?: string[];
};

export type BuyerPersona = {
  name: string;
  age?: string;
  occupation?: string;
  goals?: string[];
  painPoints?: string[];
  notes?: string;
};

export type VisualStyle = {
  mood?: string;
  imageryStyle?: string;
  typography?: string;
  references?: string[];
};

export type Brand = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  industry: string | null;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
};

export type BrandKit = {
  id: string;
  brandId: string;
  status: AssetStatus;
  logoUrl: string | null;
  logoPrompt: string | null;
  colorPalette: ColorPalette | null;
  toneOfVoice: Bilingual | null;
  buyerPersona: BuyerPersona | null;
  valueProposition: Bilingual | null;
  keyMessages: Bilingual<string[]> | null;
  visualStyle: VisualStyle | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBrandInput = {
  name: string;
  description?: string;
  industry?: string;
  markets?: string[];
};

export type CreateBrandResponse = {
  brand: Brand;
  brandKit: BrandKit;
  generation: {
    triggered: boolean;
    agent: string;
    status: AssetStatus;
    steps: string[];
  };
};

export type TranscriptionResponse = {
  id: string;
  brandId: string;
  campaignId: string | null;
  text: string;
  language: "es" | "en";
  model: string;
  provider: string;
  createdAt: string;
};

export type CampaignSummary = {
  id: string;
  name: string;
  objective: string;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
};

export type CampaignProgressBlock = {
  key: string;
  label: string;
  approved: boolean;
  missing: boolean;
};

export type CampaignStrategy = {
  id: string;
  campaignId: string;
  status: AssetStatus;
  audience: unknown;
  segmentation: unknown;
  commercialAngle: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAdCopy = {
  id: string;
  campaignId: string;
  language: "es" | "en";
  variant: "a" | "b";
  status: AssetStatus;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  callToAction: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignCreativeAsset = {
  id: string;
  campaignId: string;
  variant: "a" | "b";
  status: AssetStatus;
  imageUrl: string | null;
  prompt: string | null;
  altText: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignVideoScript = {
  id: string;
  campaignId: string;
  status: AssetStatus;
  language: "es" | "en";
  title: string | null;
  scenes: Array<{
    sceneNumber?: number;
    description?: string;
    dialogue?: string;
    durationSeconds?: number;
  }> | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignVoiceover = {
  id: string;
  videoScriptId: string;
  videoScriptTitle?: string | null;
  status: AssetStatus;
  language: "es" | "en";
  voiceId: string;
  audioUrl: string | null;
  durationSeconds: number | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignExport = {
  id: string;
  campaignId: string;
  exportStatus: "pending" | "sent" | "failed";
  n8nWorkflowId: string | null;
  n8nExecutionId: string | null;
  metaAdsPayload: Record<string, unknown> | null;
  metaCampaignId: string | null;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignDashboard = {
  campaign: CampaignSummary;
  brand: Pick<Brand, "id" | "name" | "description" | "industry" | "status">;
  brandKit: BrandKit | null;
  progress: {
    approved: number;
    total: number;
    readyToPublish: boolean;
    pending: string[];
    blocks: CampaignProgressBlock[];
  };
  agents: {
    strategy: CampaignStrategy | null;
    adCopies: CampaignAdCopy[];
    visualAssets: CampaignCreativeAsset[];
    videoScripts: CampaignVideoScript[];
    voiceovers: CampaignVoiceover[];
  };
  latestExport: CampaignExport | null;
};

export type CreateCampaignResponse = {
  campaign: CampaignSummary;
  strategy: CampaignStrategy;
  generation: {
    triggered: boolean;
    agent: string;
    provider: string;
    status: AssetStatus;
    steps: string[];
  };
};

const parseErrorMessage = (body: unknown, fallback: string) =>
  (body as { error?: { message?: string } } | undefined)?.error?.message ?? fallback;

export async function createBrand(input: CreateBrandInput): Promise<CreateBrandResponse> {
  const res = await apiFetch("/api/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Request failed with status ${res.status}`));
  }

  return body as CreateBrandResponse;
}

export type RegenerateBrandKitResponse = {
  brandKit: BrandKit;
  provider: string;
};

/** Re-ejecuta el Brand Agent sobre una marca existente. Body opcional
 *  (`{ markets }`); el server tolera body vacío. */
export async function regenerateBrandKit(
  brandId: string,
  input: { markets?: string[] } = {},
): Promise<RegenerateBrandKitResponse> {
  const res = await apiFetch(`/api/brands/${brandId}/agents/brand-kit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Brand kit regeneration failed with status ${res.status}`));
  }

  return body as RegenerateBrandKitResponse;
}

export type SeedDemoResponse = {
  brand: Brand;
  brandKit: BrandKit;
  campaign: CampaignSummary;
  dashboard: CampaignDashboard;
};

/** Sembrado de una campaña demo completa (NovaGear Tech) para el usuario —
 *  strategy, copies, creatives, video, voiceover y export listos. */
export async function seedDemo(): Promise<SeedDemoResponse> {
  const res = await apiFetch("/api/demo/seed", { method: "POST" });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Demo seed failed with status ${res.status}`));
  }

  return body as SeedDemoResponse;
}

export async function transcribeAudio(audio: Blob, input: { brandId: string }): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append("audio", audio, "campaign-brief.webm");
  formData.append("brandId", input.brandId);

  const res = await apiFetch("/api/transcriptions", {
    method: "POST",
    body: formData,
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Transcription failed with status ${res.status}`));
  }

  return body as TranscriptionResponse;
}

export async function createCampaignBrief(input: { brandId: string; text: string }): Promise<TranscriptionResponse> {
  const res = await apiFetch("/api/campaign-briefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Campaign brief failed with status ${res.status}`));
  }

  return body as TranscriptionResponse;
}

export async function createCampaign(input: {
  brandId: string;
  name: string;
  objective: string;
}): Promise<CreateCampaignResponse> {
  const res = await apiFetch("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Campaign creation failed with status ${res.status}`));
  }

  return body as CreateCampaignResponse;
}

export async function getCampaignDashboard(campaignId: string): Promise<CampaignDashboard> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/dashboard`);
  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Campaign dashboard failed with status ${res.status}`));
  }

  return body as CampaignDashboard;
}

export async function runCampaignAgent(
  campaignId: string,
  agent: "strategy" | "creative" | "meta-ads" | "video" | "voice",
) {
  const res = await apiFetch(`/api/campaigns/${campaignId}/agents/${agent}`, {
    method: "POST",
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `${agent} agent failed with status ${res.status}`));
  }

  return body;
}

export async function approveCampaignAsset(
  campaignId: string,
  input: { target: CampaignAssetTarget; id: string },
): Promise<CampaignDashboard> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Approve failed with status ${res.status}`));
  }

  return body as CampaignDashboard;
}

export async function regenerateCampaignAsset(
  campaignId: string,
  input: { target: CampaignAssetTarget; id: string },
): Promise<CampaignDashboard> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Regenerate failed with status ${res.status}`));
  }

  return body as CampaignDashboard;
}

export async function exportCampaignToMetaAds(campaignId: string): Promise<{
  export: CampaignExport;
  dashboard: CampaignDashboard;
}> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/meta-ads/export`, {
    method: "POST",
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Export failed with status ${res.status}`));
  }

  return body as { export: CampaignExport; dashboard: CampaignDashboard };
}

export type SocialPostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export type SocialPost = {
  id: string;
  campaignId: string;
  creativeAssetId: string;
  caption: string;
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listCampaignPosts(campaignId: string): Promise<SocialPost[]> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/posts`);
  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Listing posts failed with status ${res.status}`));
  }

  return (body as { posts: SocialPost[] }).posts;
}

export async function createSocialPost(
  campaignId: string,
  input: { creativeAssetId: string; caption: string; scheduledAt: string | null },
): Promise<SocialPost> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Post creation failed with status ${res.status}`));
  }

  return body as SocialPost;
}

export async function reschedulePost(
  campaignId: string,
  postId: string,
  scheduledAt: string | null,
): Promise<SocialPost> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/posts/${postId}/schedule`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt }),
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Reschedule failed with status ${res.status}`));
  }

  return body as SocialPost;
}

export async function publishPost(campaignId: string, postId: string): Promise<SocialPost> {
  const res = await apiFetch(`/api/campaigns/${campaignId}/posts/${postId}/publish`, {
    method: "POST",
  });

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(parseErrorMessage(body, `Publish failed with status ${res.status}`));
  }

  return body as SocialPost;
}
