"use client";

import { env } from "@Polyedro-abs/env/web";
import { EventSourcePlus } from "event-source-plus";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "./api";
import { supabase } from "./supabase";

/** Hook de progreso por campaña contra apps/server: consume el stream SSE
 *  (GET /api/campaigns/:id/progress/stream) con event-source-plus — fetch
 *  bajo el capó, porque EventSource nativo no puede mandar el Bearer — y si
 *  el stream falla repetidamente cae a polling (GET .../progress?after=N).
 *  Ambos transportes comparten el cursor `lastEventId`, así el cambio de
 *  transporte no pierde ni duplica eventos. */

export type CampaignProgressEventType =
  | "agent_started"
  | "agent_log"
  | "agent_completed"
  | "asset_updated";

/** Espejo de ProgressEvent en apps/server/src/api/services/progress.ts. */
export type CampaignProgressEvent = {
  id: number;
  type: CampaignProgressEventType;
  campaignId: string;
  timestamp: string;
  data: Record<string, unknown>;
};

export type CampaignProgressTransport = "idle" | "connecting" | "sse" | "polling";

/** Errores SSE consecutivos antes de rendirse y pasar a polling. */
const SSE_FAILURES_BEFORE_POLLING = 3;
const POLL_INTERVAL_MS = 2500;
/** Mismo tope que el ring buffer del server. */
const MAX_EVENTS = 200;

export function useCampaignProgress(
  campaignId: string | null,
  options: { onEvent?: (event: CampaignProgressEvent) => void } = {},
) {
  const [events, setEvents] = useState<CampaignProgressEvent[]>([]);
  const [transport, setTransport] = useState<CampaignProgressTransport>("idle");

  // Ref para que un callback inline no re-suscriba el stream en cada render.
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  useEffect(() => {
    if (!campaignId) {
      setTransport("idle");
      setEvents([]);
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let lastEventId = 0;

    const ingest = (event: CampaignProgressEvent) => {
      if (disposed || event.id <= lastEventId) {
        return;
      }
      lastEventId = event.id;
      setEvents((prev) => [...prev, event].slice(-MAX_EVENTS));
      onEventRef.current?.(event);
    };

    const poll = async () => {
      try {
        const response = await apiFetch(
          `/api/campaigns/${campaignId}/progress?after=${lastEventId}`,
        );
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { events: CampaignProgressEvent[] };
        for (const event of body.events) {
          ingest(event);
        }
      } catch {
        // Red caída: el próximo tick del intervalo reintenta.
      }
    };

    const startPolling = () => {
      if (disposed || pollTimer) {
        return;
      }
      setTransport("polling");
      void poll();
      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };

    setTransport("connecting");
    setEvents([]);

    const source = new EventSourcePlus(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/campaigns/${campaignId}/progress/stream`,
      {
        // Se re-ejecuta en cada (re)conexión: siempre manda el token vigente.
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      },
    );

    let failures = 0;
    const handleFailure = () => {
      failures += 1;
      if (failures >= SSE_FAILURES_BEFORE_POLLING) {
        controller.abort();
        startPolling();
      }
    };

    const controller = source.listen({
      onMessage(message) {
        if (message.event === "ping" || !message.data) {
          return;
        }
        try {
          ingest(JSON.parse(message.data) as CampaignProgressEvent);
        } catch {
          // Evento malformado: se ignora sin tumbar el stream.
        }
      },
      onResponse() {
        failures = 0;
        if (!disposed) {
          setTransport("sse");
        }
      },
      onRequestError: handleFailure,
      onResponseError: handleFailure,
    });

    return () => {
      disposed = true;
      controller.abort();
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [campaignId]);

  return {
    /** Eventos recibidos en orden (máx. 200, igual que el buffer del server). */
    events,
    lastEvent: events.at(-1) ?? null,
    /** Transporte activo: útil para mostrar "live" vs "polling" en la UI. */
    transport,
  };
}
