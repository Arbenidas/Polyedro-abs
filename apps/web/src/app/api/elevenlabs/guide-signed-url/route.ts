import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ElevenLabsSignedUrlResponse = {
  signed_url?: unknown;
  signedUrl?: unknown;
};

type JsonObject = Record<string, unknown>;

let fallbackEnvLoaded = false;

function getElevenLabsApiKey(): string | undefined {
  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }

  if (!fallbackEnvLoaded) {
    fallbackEnvLoaded = true;

    for (const envPath of [
      resolve(process.cwd(), "../server/.env"),
      resolve(process.cwd(), "apps/server/.env"),
    ]) {
      if (existsSync(envPath)) {
        loadEnv({ path: envPath, override: false });
      }

      if (process.env.ELEVENLABS_API_KEY) {
        return process.env.ELEVENLABS_API_KEY;
      }
    }
  }

  return process.env.ELEVENLABS_API_KEY;
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getElevenLabsErrorMessage(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (!isJsonObject(detail)) {
    return "ElevenLabs signed URL request failed";
  }

  const nestedDetail = detail.detail;
  if (isJsonObject(nestedDetail) && typeof nestedDetail.message === "string") {
    return nestedDetail.message;
  }

  if (typeof detail.message === "string") {
    return detail.message;
  }

  return "ElevenLabs signed URL request failed";
}

export async function GET(request: Request) {
  const apiKey = getElevenLabsApiKey();
  const configuredAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_GUIDE_AGENT_ID;
  const requestedAgentId = new URL(request.url).searchParams.get("agentId");
  const agentId = requestedAgentId || configuredAgentId;

  if (!agentId) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_ELEVENLABS_GUIDE_AGENT_ID is not configured" },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured in apps/web/.env.local or apps/server/.env" },
      { status: 501 },
    );
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
    {
      cache: "no-store",
      headers: {
        "xi-api-key": apiKey,
      },
    },
  );
  const body = await upstream.text();
  const detail = parseJsonSafely(body);

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: getElevenLabsErrorMessage(detail),
        detail,
      },
      { status: upstream.status },
    );
  }

  const data = detail as ElevenLabsSignedUrlResponse;
  const signedUrl = data.signed_url ?? data.signedUrl;

  if (typeof signedUrl !== "string" || signedUrl.length === 0) {
    return NextResponse.json(
      {
        error: "ElevenLabs did not return a signed URL",
        detail: data,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ signedUrl });
}
