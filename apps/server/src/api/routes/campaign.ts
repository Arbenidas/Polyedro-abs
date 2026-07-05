import {
  approveAsset,
  createCampaign,
  exportCampaignToMetaAds,
  getCampaignDashboard,
  listCampaigns,
  regenerateAsset,
  requireCampaignOwnership,
  seedDemoCampaign,
} from "@/api/services/campaign";
import { runCreativeAgent } from "@/api/services/creative";
import { runMetaAdsAgent } from "@/api/services/meta-ads-agent";
import {
  getLastProgressEventId,
  getProgressEvents,
  type ProgressEvent,
  subscribeToProgress,
} from "@/api/services/progress";
import { runStrategyAgent } from "@/api/services/strategy-agent";
import { runVideoAgent } from "@/api/services/video-agent";
import { runVoiceAgent } from "@/api/services/voice-agent";
import { parseBody, parseUuidParam } from "@/api/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import type { AuthEnv } from "@/middleware/auth";

const campaignInputSchema = z.object({
  brandId: z.uuid(),
  name: z.string().trim().min(1),
  objective: z.string().trim().min(1),
});

const assetActionSchema = z.object({
  target: z.enum(["strategy", "ad_copy", "creative_asset", "video_script", "voiceover"]),
  id: z.uuid(),
});

const campaignRoutes = new Hono<AuthEnv>();

/** Ownership (campaign → brand.userId) se verifica acá, en el borde, antes de
 *  delegar en servicios/agentes; los servicios asumen campaignId ya autorizado. */
const requireOwnedCampaignId = async (c: {
  req: { param: (name: "campaignId") => string };
  get: (key: "user") => { id: string };
}) => {
  const campaignId = parseUuidParam(c.req.param("campaignId"), "campaignId");
  await requireCampaignOwnership(campaignId, c.get("user").id);

  return campaignId;
};

campaignRoutes.post("/demo/seed", async (c) => {
  const result = await seedDemoCampaign(c.get("user").id);

  return c.json(result, 201);
});

campaignRoutes.get("/campaigns", async (c) => {
  const result = await listCampaigns(c.get("user").id);

  return c.json({ campaigns: result });
});

campaignRoutes.get("/campaigns/:campaignId/dashboard", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await getCampaignDashboard(campaignId);

  return c.json(result);
});

campaignRoutes.post("/campaigns", async (c) => {
  const input = await parseBody(c.req.raw, campaignInputSchema);
  const result = await createCampaign({ ...input, userId: c.get("user").id });

  return c.json(result, 201);
});

/** Cursor de reconexión: Last-Event-ID (SSE) o ?after / ?lastEventId. */
const parseAfterCursor = (value: string | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** Milisegundos entre pings de keep-alive del stream SSE (por debajo de los
 *  timeouts típicos de proxies, ~60s). */
const SSE_HEARTBEAT_MS = 15_000;

/** Fallback de polling: eventos buffereados con id > after y el cursor para
 *  la próxima llamada. */
campaignRoutes.get("/campaigns/:campaignId/progress", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);

  const after = parseAfterCursor(c.req.query("after"));
  const events = getProgressEvents(campaignId, after);

  return c.json({
    events,
    lastEventId: events.at(-1)?.id ?? Math.max(after, getLastProgressEventId(campaignId)),
  });
});

/** Stream SSE de progreso de la campaña: reenvía el buffer desde el cursor y
 *  luego los eventos en vivo (agent_started / agent_log / agent_completed /
 *  asset_updated), con ping periódico de keep-alive. Nota: EventSource no
 *  manda headers — el cliente web debe consumirlo con fetch + ReadableStream
 *  (mandando el Bearer) o usar el fallback de polling. */
campaignRoutes.get("/campaigns/:campaignId/progress/stream", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);

  const after = parseAfterCursor(
    c.req.header("Last-Event-ID") ?? c.req.query("lastEventId") ?? c.req.query("after"),
  );

  return streamSSE(c, async (stream) => {
    let closed = false;
    let lastSentId = after;
    const pending: ProgressEvent[] = [];
    let wake = () => {};

    const unsubscribe = subscribeToProgress(campaignId, (event) => {
      pending.push(event);
      wake();
    });

    stream.onAbort(() => {
      closed = true;
      unsubscribe();
      wake();
    });

    const send = async (event: ProgressEvent) => {
      await stream.writeSSE({
        id: String(event.id),
        event: event.type,
        data: JSON.stringify(event),
      });
      lastSentId = event.id;
    };

    for (const event of getProgressEvents(campaignId, after)) {
      await send(event);
    }

    while (!closed) {
      if (pending.length === 0) {
        // El push del listener y esta asignación corren en el mismo tick, así
        // que no se pierden eventos entre el chequeo y la espera.
        const waited = await Promise.race([
          new Promise<"event">((resolve) => {
            wake = () => resolve("event");
          }),
          stream.sleep(SSE_HEARTBEAT_MS).then(() => "heartbeat" as const),
        ]);
        wake = () => {};

        if (!closed && waited === "heartbeat") {
          await stream.writeSSE({ event: "ping", data: String(lastSentId) });
          continue;
        }
      }

      while (!closed && pending.length > 0) {
        const event = pending.shift();
        if (event && event.id > lastSentId) {
          await send(event);
        }
      }
    }
  });
});

campaignRoutes.post("/campaigns/:campaignId/agents/strategy", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await runStrategyAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/creative", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await runCreativeAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/meta-ads", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await runMetaAdsAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/video", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await runVideoAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/agents/voice", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await runVoiceAgent(campaignId);

  return c.json(result, 201);
});

campaignRoutes.post("/campaigns/:campaignId/approve", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const input = await parseBody(c.req.raw, assetActionSchema);
  const result = await approveAsset(campaignId, input);

  return c.json(result);
});

campaignRoutes.post("/campaigns/:campaignId/regenerate", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const input = await parseBody(c.req.raw, assetActionSchema);
  const result = await regenerateAsset(campaignId, input);

  return c.json(result);
});

campaignRoutes.post("/campaigns/:campaignId/meta-ads/export", async (c) => {
  const campaignId = await requireOwnedCampaignId(c);
  const result = await exportCampaignToMetaAds(campaignId);

  return c.json(result, 201);
});

export { campaignRoutes };
