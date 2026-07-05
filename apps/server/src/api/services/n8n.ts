import { ApiError } from "@/api/shared";
import { env } from "@Polyedro-abs/env/server";

/** Integración con n8n: dispara el workflow de export de campaña a Meta Ads
 *  vía su webhook de producción. El workflow responde de forma síncrona con
 *  un executionId; el trabajo real contra Meta Ads ocurre dentro de n8n. */

const N8N_REQUEST_TIMEOUT_MS = 30_000;

export type CampaignExportTarget = "meta_ads";

type N8nExportResponse = {
  status?: string;
  executionId?: string;
  receivedAt?: string;
};

export type CampaignExportResult = {
  executionId: string | null;
  status: string | null;
  raw: N8nExportResponse;
};

/** POST al webhook de n8n. Lanza ApiError(502) ante timeout, error de red o
 *  respuesta no-2xx para que el caller marque el export como "failed". */
export const dispatchCampaignExport = async (input: {
  brandId: string;
  campaignId: string;
  target?: CampaignExportTarget;
}): Promise<CampaignExportResult> => {
  const body = {
    brandId: input.brandId,
    campaignId: input.campaignId,
    target: input.target ?? "meta_ads",
  };

  let response: Response;
  try {
    response = await fetch(env.N8N_EXPORT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(N8N_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    throw new ApiError(502, `n8n export webhook unreachable: ${reason}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ApiError(
      502,
      `n8n export webhook returned ${response.status}`,
      detail.slice(0, 500),
    );
  }

  const data = (await response.json().catch(() => ({}))) as N8nExportResponse;

  return {
    executionId: data.executionId ?? null,
    status: data.status ?? null,
    raw: data,
  };
};
