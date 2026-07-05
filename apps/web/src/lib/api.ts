import { env } from "@Polyedro-abs/env/web";

export type AssetStatus = "draft" | "generating" | "review" | "approved" | "ready_to_publish" | "rejected";

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

const parseErrorMessage = (body: unknown, fallback: string) =>
  (body as { error?: { message?: string } } | undefined)?.error?.message ?? fallback;

export async function createBrand(input: CreateBrandInput): Promise<CreateBrandResponse> {
  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/brands`, {
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

export async function transcribeAudio(audio: Blob, input: { brandId: string }): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append("audio", audio, "campaign-brief.webm");
  formData.append("brandId", input.brandId);

  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/transcriptions`, {
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
  const res = await fetch(`${env.NEXT_PUBLIC_SERVER_URL}/api/campaign-briefs`, {
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
