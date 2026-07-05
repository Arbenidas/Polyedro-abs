/** Bus de progreso por campaña para el stream SSE y su fallback de polling.
 *  In-memory y por proceso (suficiente para la demo: los agentes corren
 *  inline en este mismo server). Cada campaña tiene un buffer acotado de
 *  eventos con id monotónico, así el cliente puede reconectar el SSE con
 *  Last-Event-ID o pollear con ?after=<id> sin perder eventos. */

export type ProgressEventType =
  | "agent_started"
  | "agent_log"
  | "agent_completed"
  | "asset_updated";

export type ProgressAgent = "strategy" | "creative" | "meta_ads" | "video";

/** Espejo de AssetTarget (services/campaign) — duplicado a propósito para no
 *  crear un ciclo de imports: campaign.ts importa este módulo. */
type ProgressAssetTarget =
  | "strategy"
  | "ad_copy"
  | "creative_asset"
  | "video_script"
  | "voiceover";

export type ProgressEvent = {
  id: number;
  type: ProgressEventType;
  campaignId: string;
  timestamp: string;
  data: Record<string, unknown>;
};

type ProgressListener = (event: ProgressEvent) => void;

type CampaignChannel = {
  nextId: number;
  events: ProgressEvent[];
  listeners: Set<ProgressListener>;
  lastActivityAt: number;
};

/** Máximo de eventos retenidos por campaña para replay/polling. */
const MAX_BUFFERED_EVENTS = 200;
/** Máximo de campañas con canal vivo; al superarlo se poda la más inactiva. */
const MAX_CHANNELS = 100;

const channels = new Map<string, CampaignChannel>();

const getChannel = (campaignId: string): CampaignChannel => {
  const existing = channels.get(campaignId);
  if (existing) {
    return existing;
  }

  if (channels.size >= MAX_CHANNELS) {
    let oldestId: string | undefined;
    let oldestActivity = Number.POSITIVE_INFINITY;
    for (const [id, channel] of channels) {
      if (channel.listeners.size === 0 && channel.lastActivityAt < oldestActivity) {
        oldestActivity = channel.lastActivityAt;
        oldestId = id;
      }
    }
    if (oldestId) {
      channels.delete(oldestId);
    }
  }

  const channel: CampaignChannel = {
    nextId: 1,
    events: [],
    listeners: new Set(),
    lastActivityAt: Date.now(),
  };
  channels.set(campaignId, channel);

  return channel;
};

const emit = (
  campaignId: string,
  type: ProgressEventType,
  data: Record<string, unknown>,
): ProgressEvent => {
  const channel = getChannel(campaignId);
  const event: ProgressEvent = {
    id: channel.nextId++,
    type,
    campaignId,
    timestamp: new Date().toISOString(),
    data,
  };

  channel.events.push(event);
  if (channel.events.length > MAX_BUFFERED_EVENTS) {
    channel.events.splice(0, channel.events.length - MAX_BUFFERED_EVENTS);
  }
  channel.lastActivityAt = Date.now();

  for (const listener of channel.listeners) {
    try {
      listener(event);
    } catch {
      // Un suscriptor roto no debe afectar al resto ni al agente que emite.
    }
  }

  return event;
};

/** Suscribe un listener a los eventos futuros de una campaña. Devuelve el
 *  unsubscribe (llamarlo siempre al cerrar el stream). */
export const subscribeToProgress = (
  campaignId: string,
  listener: ProgressListener,
): (() => void) => {
  const channel = getChannel(campaignId);
  channel.listeners.add(listener);

  return () => {
    channel.listeners.delete(listener);
  };
};

/** Eventos buffereados con id > after (replay de SSE y respuesta de polling). */
export const getProgressEvents = (campaignId: string, after = 0): ProgressEvent[] => {
  const channel = channels.get(campaignId);
  if (!channel) {
    return [];
  }

  return channel.events.filter((event) => event.id > after);
};

/** Último id emitido para una campaña (cursor inicial del polling). */
export const getLastProgressEventId = (campaignId: string): number => {
  const channel = channels.get(campaignId);

  return channel ? channel.nextId - 1 : 0;
};

export const emitAgentStarted = (
  campaignId: string,
  agent: ProgressAgent,
  data: Record<string, unknown> = {},
) => emit(campaignId, "agent_started", { agent, ...data });

export const emitAgentLog = (
  campaignId: string,
  agent: ProgressAgent,
  message: string,
  data: Record<string, unknown> = {},
) => emit(campaignId, "agent_log", { agent, message, ...data });

export const emitAgentCompleted = (
  campaignId: string,
  agent: ProgressAgent,
  outcome: "succeeded" | "failed",
  data: Record<string, unknown> = {},
) => emit(campaignId, "agent_completed", { agent, outcome, ...data });

export const emitAssetUpdated = (
  campaignId: string,
  asset: { target: ProgressAssetTarget; id: string; status: string } & Record<string, unknown>,
) => emit(campaignId, "asset_updated", asset);
