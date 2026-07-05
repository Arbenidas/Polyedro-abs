/**
 * Smoke E2E de las features de imagen con Fal.ai:
 *  - Brand Agent: logo conceptual (PR #9) — POST /api/brands
 *  - Creative Agent: creativos 1080×1080 A/B (PR #8) — POST /api/campaigns/:id/agents/creative
 *
 * Corre contra un server ya levantado (`pnpm --filter server dev`). Auto-detecta
 * el modo del server (placeholder sin FAL_KEY, fal con key real) y ajusta las
 * aserciones. Ver docs/testing.md para la matriz de escenarios y modos.
 *
 * Uso:
 *   SMOKE_USER_EMAIL=... SMOKE_USER_PASSWORD=... pnpm --filter server smoke:fal
 *
 * Env opcional:
 *   SMOKE_BASE_URL         default http://localhost:3000
 *   SMOKE_EXPECT_PROVIDER  "placeholder" | "fal" — aborta si el modo detectado no coincide
 *   SMOKE_FULL=1           en modo fal, corre también los escenarios cost-gated
 */
import { env } from "@Polyedro-abs/env/server";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_USER_EMAIL;
const PASSWORD = process.env.SMOKE_USER_PASSWORD;
const EXPECT_PROVIDER = process.env.SMOKE_EXPECT_PROVIDER;
const FULL = process.env.SMOKE_FULL === "1";
const RUN_ID = `SMOKE-${Date.now()}`;

const CRUD_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 300_000;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

type Mode = "placeholder" | "fal";
type Status = "PASS" | "FAIL" | "SKIP" | "WARN";

type AssetShape = {
  id: string;
  variant: string;
  status: string;
  imageUrl: string;
  prompt: string;
  altText: string;
  metadata: Record<string, unknown>;
};

type Ctx = {
  token: string;
  mode?: Mode;
  brandId?: string;
  brandName?: string;
  campaignId?: string;
  assets?: AssetShape[];
};

type Warn = (message: string) => void;

type Scenario = {
  id: string;
  title: string;
  deps?: string[];
  /** Reintenta una vez en modo fal (flakes transitorios del proveedor). */
  falRetry?: boolean;
  /** En modo fal solo corre con SMOKE_FULL=1 (gasta imágenes reales sin probar generación). */
  costGated?: boolean;
  run: (ctx: Ctx, warn: Warn) => Promise<void>;
};

class CheckError extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckError(message);
}

const randomUuid = () => crypto.randomUUID();

const api = async (
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    timeoutMs?: number;
  } = {},
) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs ?? CRUD_TIMEOUT_MS),
  });

  // biome-ignore lint/suspicious/noExplicitAny: respuestas JSON arbitrarias del API
  const json: any = await response.json().catch(() => undefined);

  return { status: response.status, json };
};

const mintToken = async () => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "SMOKE_USER_EMAIL y SMOKE_USER_PASSWORD son requeridos (usuario e2e de Supabase; ver docs/testing.md).",
    );
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(CRUD_TIMEOUT_MS),
  });

  // biome-ignore lint/suspicious/noExplicitAny: respuesta de Supabase Auth
  const json: any = await response.json().catch(() => ({}));

  if (!response.ok || !json.access_token) {
    throw new Error(
      `Supabase password grant falló (${response.status}): ${JSON.stringify(json)}`,
    );
  }

  return json.access_token as string;
};

const detectModeFromUrl = (imageUrl: string): Mode =>
  new URL(imageUrl).hostname === "placehold.co" ? "placeholder" : "fal";

/** Chequeo de imageUrl según modo: en placeholder valida la FORMA de la URL
 *  (fetch solo como WARN — la disponibilidad de placehold.co no es regresión
 *  nuestra); en fal el fetch es hard-fail porque valida el header de
 *  no-expiración del CDN de fal. */
const checkImageUrl = async (
  imageUrl: string,
  mode: Mode,
  expectedDims: number,
  warn: Warn,
) => {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new CheckError(`imageUrl no es una URL válida: ${imageUrl}`);
  }

  if (mode === "placeholder") {
    check(parsed.hostname === "placehold.co", `host esperado placehold.co, llegó ${parsed.hostname}`);
    check(
      parsed.pathname.includes(`${expectedDims}x${expectedDims}`),
      `URL placeholder sin dimensiones ${expectedDims}x${expectedDims}: ${parsed.pathname}`,
    );

    try {
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) warn(`fetch de placeholder devolvió ${response.status} (tercero, no bloquea)`);
    } catch (error) {
      warn(`fetch de placeholder falló: ${error instanceof Error ? error.message : error}`);
    }
    return;
  }

  check(
    parsed.hostname === "fal.media" || parsed.hostname.endsWith(".fal.media"),
    `host esperado *.fal.media, llegó ${parsed.hostname}`,
  );

  const fetchImage = () =>
    fetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) }).catch(() => undefined);

  let response = await fetchImage();
  if (!response?.ok) response = await fetchImage();

  check(response?.ok, `GET de la imagen fal falló (${response?.status ?? "network error"}) — ¿expiró el archivo?`);
  const contentType = response.headers.get("content-type") ?? "";
  check(contentType.startsWith("image/"), `content-type esperado image/*, llegó "${contentType}"`);

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (!declaredLength) {
    const body = await response.arrayBuffer();
    check(body.byteLength > 0, "la imagen fal llegó vacía");
  }
};

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------

const scenarios: Scenario[] = [
  {
    id: "S0",
    title: "Rutas públicas sin token (GET /, /health/db)",
    run: async () => {
      const root = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(CRUD_TIMEOUT_MS) });
      check(root.status === 200, `GET / devolvió ${root.status}`);
      const health = await api("/health/db");
      check(health.status === 200, `GET /health/db devolvió ${health.status}`);
      check(health.json?.db === "ok", "health/db sin db:ok");
    },
  },
  {
    id: "S1",
    title: "Auth gate: sin token y token basura → 401",
    run: async () => {
      const noToken = await api("/api/me");
      check(noToken.status === 401, `sin token esperaba 401, llegó ${noToken.status}`);
      const garbage = await api("/api/me", { token: "garbage-token" });
      check(garbage.status === 401, `token basura esperaba 401, llegó ${garbage.status}`);
    },
  },
  {
    id: "S2",
    title: "Auth upsert: GET /api/me con token válido",
    run: async (ctx) => {
      const me = await api("/api/me", { token: ctx.token });
      check(me.status === 200, `esperaba 200, llegó ${me.status}`);
      check(me.json?.user?.email === EMAIL, `email esperado ${EMAIL}, llegó ${me.json?.user?.email}`);
    },
  },
  {
    id: "S3",
    title: "F2.1 — onboarding de marca genera logo (detección de modo)",
    run: async (ctx, warn) => {
      const name = `${RUN_ID} NovaSmoke`;
      const response = await api("/api/brands", {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
        body: {
          name,
          description: "Smart gadgets for smoke-testing the AI marketing pipeline.",
          industry: "Consumer electronics",
          markets: ["MX", "GT"],
        },
      });

      check(response.status === 201, `esperaba 201, llegó ${response.status}: ${JSON.stringify(response.json)}`);
      const kit = response.json?.brandKit;
      check(kit?.status === "review", `brandKit.status esperado review, llegó ${kit?.status}`);
      check(typeof kit?.logoUrl === "string" && kit.logoUrl.length > 0, "logoUrl vacío");
      check(
        typeof kit?.logoPrompt === "string" && kit.logoPrompt.includes(name),
        "logoPrompt no incluye el nombre de la marca",
      );
      check(kit.logoPrompt.includes("Consumer electronics"), "logoPrompt no incluye la industria");

      const detected = detectModeFromUrl(kit.logoUrl);
      if (EXPECT_PROVIDER && EXPECT_PROVIDER !== detected) {
        throw new CheckError(
          `Modo detectado "${detected}" contradice SMOKE_EXPECT_PROVIDER="${EXPECT_PROVIDER}". ` +
            `Revisa FAL_KEY en apps/server/.env (una key inválida deshabilita el fallback placeholder).`,
        );
      }
      ctx.mode = detected;
      ctx.brandId = response.json?.brand?.id;
      ctx.brandName = name;
      check(ctx.brandId, "brand.id ausente en la respuesta");

      await checkImageUrl(kit.logoUrl, detected, 1024, warn);
    },
  },
  {
    id: "S4",
    title: "Scoping: GET /api/brands solo muestra marcas del usuario",
    deps: ["S3"],
    run: async (ctx) => {
      const response = await api("/api/brands", { token: ctx.token });
      check(response.status === 200, `esperaba 200, llegó ${response.status}`);
      const brands: { id: string; name: string }[] = response.json?.brands ?? [];
      check(
        brands.some((brand) => brand.id === ctx.brandId),
        "la marca recién creada no aparece en el listado",
      );
      check(
        !brands.some((brand) => brand.name === "NovaGear Tech"),
        "el listado incluye la marca del usuario demo (fuga de scoping)",
      );
    },
  },
  {
    id: "S5",
    title: "Marca con input mínimo (solo nombre) usa defaults",
    deps: ["S2"],
    costGated: true,
    run: async (ctx) => {
      const response = await api("/api/brands", {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
        body: { name: `${RUN_ID} Minimal` },
      });
      check(response.status === 201, `esperaba 201, llegó ${response.status}`);
      const kit = response.json?.brandKit;
      check(kit?.logoUrl, "logoUrl vacío con input mínimo");
      check(
        kit?.logoPrompt?.includes("Emerging business"),
        "logoPrompt no aplicó la industria default",
      );
    },
  },
  {
    id: "S6",
    title: "Alias del formulario (brandName/whatDoYouSell) + markets como record",
    deps: ["S2"],
    costGated: true,
    run: async (ctx) => {
      const response = await api("/api/brands", {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
        body: {
          brandName: `${RUN_ID} Alias`,
          whatDoYouSell: "Compact projectors for students.",
          markets: { MX: true, CO: false },
        },
      });
      check(response.status === 201, `esperaba 201, llegó ${response.status}`);
      check(response.json?.brandKit?.logoPrompt?.includes("MX"), "markets record no llegó al prompt");
      check(
        !response.json?.brandKit?.logoPrompt?.includes("CO"),
        "un market en false se coló al prompt",
      );
    },
  },
  {
    id: "S7",
    title: "Validación: marca sin nombre → 400",
    deps: ["S2"],
    run: async (ctx) => {
      const response = await api("/api/brands", {
        method: "POST",
        token: ctx.token,
        body: { description: "no name provided" },
      });
      check(response.status === 400, `esperaba 400, llegó ${response.status}`);
    },
  },
  {
    id: "S8",
    title: "Nombre con caracteres especiales genera URL válida",
    deps: ["S2"],
    costGated: true,
    run: async (ctx) => {
      const response = await api("/api/brands", {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
        body: { name: `${RUN_ID} Café & Diseño` },
      });
      check(response.status === 201, `esperaba 201, llegó ${response.status}`);
      const logoUrl = response.json?.brandKit?.logoUrl;
      check(logoUrl, "logoUrl vacío");
      check(URL.canParse(logoUrl), `logoUrl no parsea: ${logoUrl}`);
    },
  },
  {
    id: "S9",
    title: "F3.1 — crear campaña (+ negativos de brandId)",
    deps: ["S3"],
    run: async (ctx) => {
      const response = await api("/api/campaigns", {
        method: "POST",
        token: ctx.token,
        body: {
          brandId: ctx.brandId,
          name: `${RUN_ID} Launch`,
          objective: "Sell smoke-tested smart gadgets in Latin America.",
        },
      });
      check(response.status === 201, `esperaba 201, llegó ${response.status}`);
      check(response.json?.campaign?.status === "draft", "la campaña no nació en draft");
      ctx.campaignId = response.json?.campaign?.id;
      check(ctx.campaignId, "campaign.id ausente");

      const badUuid = await api("/api/campaigns", {
        method: "POST",
        token: ctx.token,
        body: { brandId: "not-a-uuid", name: "x", objective: "y" },
      });
      check(badUuid.status === 400, `brandId inválido esperaba 400, llegó ${badUuid.status}`);

      const unknown = await api("/api/campaigns", {
        method: "POST",
        token: ctx.token,
        body: { brandId: randomUuid(), name: "x", objective: "y" },
      });
      check(unknown.status === 404, `brandId inexistente esperaba 404, llegó ${unknown.status}`);
    },
  },
  {
    id: "S10",
    title: "F4.4 — Creative Agent genera variantes A/B",
    deps: ["S9"],
    falRetry: true,
    run: async (ctx, warn) => {
      const response = await api(`/api/campaigns/${ctx.campaignId}/agents/creative`, {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
      });

      check(
        response.status === 201,
        `esperaba 201, llegó ${response.status}: ${JSON.stringify(response.json)}`,
      );
      const failures: string[] = response.json?.failures ?? [];
      check(failures.length === 0, `variantes fallidas: ${JSON.stringify(failures)}`);

      const assets: AssetShape[] = response.json?.assets ?? [];
      check(assets.length === 2, `esperaba 2 assets, llegaron ${assets.length}`);
      check(
        new Set(assets.map((asset) => asset.variant)).size === 2,
        "las variantes no son a y b",
      );

      const mode = ctx.mode as Mode;
      const expectedProvider = mode === "placeholder" ? "placeholder" : "fal.ai";

      for (const asset of assets) {
        const label = `variante ${asset.variant}`;
        check(asset.status === "review", `${label}: status esperado review, llegó ${asset.status}`);
        check(
          asset.prompt.includes("Sell smoke-tested smart gadgets"),
          `${label}: prompt sin el objetivo de la campaña`,
        );
        check(
          asset.prompt.includes("Brand color palette:"),
          `${label}: prompt sin la paleta del brand kit`,
        );
        check(
          !asset.prompt.includes("Commercial angle"),
          `${label}: prompt incluye ángulo comercial pero la campaña no tiene estrategia`,
        );
        check(
          /variant [AB]\.$/.test(asset.altText),
          `${label}: altText con formato inesperado: ${asset.altText}`,
        );
        check(
          asset.metadata?.format === "meta_ads_static",
          `${label}: metadata.format esperado meta_ads_static`,
        );
        check(
          asset.metadata?.provider === expectedProvider,
          `${label}: provider esperado ${expectedProvider}, llegó ${asset.metadata?.provider}`,
        );

        const width = Number(asset.metadata?.width);
        const height = Number(asset.metadata?.height);
        if (mode === "placeholder") {
          check(width === 1080 && height === 1080, `${label}: dims esperadas 1080×1080, llegó ${width}×${height}`);
        } else {
          check(width > 0 && width === height, `${label}: dims cuadradas esperadas, llegó ${width}×${height}`);
        }

        await checkImageUrl(asset.imageUrl, mode, 1080, warn);
      }

      ctx.assets = assets;
    },
  },
  {
    id: "S11",
    title: "Dashboard refleja los creativos y la campaña queda en review",
    deps: ["S10"],
    run: async (ctx) => {
      const response = await api(`/api/campaigns/${ctx.campaignId}/dashboard`, { token: ctx.token });
      check(response.status === 200, `esperaba 200, llegó ${response.status}`);
      const visualAssets = response.json?.agents?.visualAssets ?? [];
      check(visualAssets.length === 2, `dashboard esperaba 2 creativos, tiene ${visualAssets.length}`);
      const block = (response.json?.progress?.blocks ?? []).find(
        (item: { key: string }) => item.key === "creative_asset",
      );
      check(block && block.missing === false, "bloque creative_asset sigue marcado como missing");
      check(
        response.json?.campaign?.status === "review",
        `campaña esperada en review, llegó ${response.json?.campaign?.status}`,
      );
    },
  },
  {
    id: "S12",
    title: "Re-correr el agente no duplica assets (upsert por variante)",
    deps: ["S10"],
    falRetry: true,
    costGated: true,
    run: async (ctx) => {
      const rerun = await api(`/api/campaigns/${ctx.campaignId}/agents/creative`, {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
      });
      check(rerun.status === 201, `esperaba 201, llegó ${rerun.status}`);

      const dashboard = await api(`/api/campaigns/${ctx.campaignId}/dashboard`, { token: ctx.token });
      const visualAssets = dashboard.json?.agents?.visualAssets ?? [];
      check(
        visualAssets.length === 2,
        `tras re-correr esperaba 2 creativos, hay ${visualAssets.length} (¿duplicados?)`,
      );
    },
  },
  {
    id: "S13",
    title: "Negativos: campaña inexistente, uuid malformado, body inválido",
    deps: ["S9"],
    run: async (ctx) => {
      const unknownCampaign = await api(`/api/campaigns/${randomUuid()}/agents/creative`, {
        method: "POST",
        token: ctx.token,
      });
      check(unknownCampaign.status === 404, `campaña inexistente esperaba 404, llegó ${unknownCampaign.status}`);

      const malformed = await api("/api/campaigns/not-a-uuid/agents/creative", {
        method: "POST",
        token: ctx.token,
      });
      check(malformed.status === 400, `uuid malformado esperaba 400, llegó ${malformed.status}`);

      const badTarget = await api(`/api/campaigns/${ctx.campaignId}/approve`, {
        method: "POST",
        token: ctx.token,
        body: { target: "hologram", id: randomUuid() },
      });
      check(badTarget.status === 400, `target inválido esperaba 400, llegó ${badTarget.status}`);

      const unknownAsset = await api(`/api/campaigns/${ctx.campaignId}/approve`, {
        method: "POST",
        token: ctx.token,
        body: { target: "creative_asset", id: randomUuid() },
      });
      check(unknownAsset.status === 404, `asset inexistente esperaba 404, llegó ${unknownAsset.status}`);
    },
  },
  {
    id: "S14",
    title: "F6.2 — regenerar un creativo conserva fila y variante",
    deps: ["S10"],
    falRetry: true,
    run: async (ctx) => {
      const target = (ctx.assets ?? []).find((asset) => asset.variant === "b");
      check(target, "no hay asset variante b en el contexto");
      const previousGeneratedAt = target.metadata?.generatedAt;

      const response = await api(`/api/campaigns/${ctx.campaignId}/regenerate`, {
        method: "POST",
        token: ctx.token,
        timeoutMs: GENERATION_TIMEOUT_MS,
        body: { target: "creative_asset", id: target.id },
      });
      check(response.status === 200, `esperaba 200, llegó ${response.status}`);

      const regenerated = (response.json?.agents?.visualAssets ?? []).find(
        (asset: AssetShape) => asset.id === target.id,
      );
      check(regenerated, "el asset regenerado desapareció del dashboard");
      check(regenerated.variant === "b", `variante esperada b, llegó ${regenerated.variant}`);
      check(regenerated.status === "review", `status esperado review, llegó ${regenerated.status}`);
      check(
        regenerated.metadata?.generatedAt !== previousGeneratedAt,
        "metadata.generatedAt no cambió tras regenerar",
      );
    },
  },
  {
    id: "S15",
    title: "Aislamiento: regenerar con asset de otra campaña → 404",
    deps: ["S10"],
    run: async (ctx) => {
      const second = await api("/api/campaigns", {
        method: "POST",
        token: ctx.token,
        body: {
          brandId: ctx.brandId,
          name: `${RUN_ID} Second`,
          objective: "Empty campaign for isolation checks.",
        },
      });
      check(second.status === 201, `esperaba 201, llegó ${second.status}`);
      const secondId = second.json?.campaign?.id;
      const assetFromFirst = ctx.assets?.[0];
      check(secondId && assetFromFirst, "faltan datos para el cruce");

      const crossed = await api(`/api/campaigns/${secondId}/regenerate`, {
        method: "POST",
        token: ctx.token,
        body: { target: "creative_asset", id: assetFromFirst.id },
      });
      check(crossed.status === 404, `cruce de campañas esperaba 404, llegó ${crossed.status}`);
    },
  },
  {
    id: "S16",
    title: "F6.1 — aprobar ambos creativos actualiza el progreso",
    deps: ["S10"],
    run: async (ctx) => {
      let dashboard: Record<string, unknown> | undefined;
      for (const asset of ctx.assets ?? []) {
        const response = await api(`/api/campaigns/${ctx.campaignId}/approve`, {
          method: "POST",
          token: ctx.token,
          body: { target: "creative_asset", id: asset.id },
        });
        check(response.status === 200, `approve esperaba 200, llegó ${response.status}`);
        dashboard = response.json;
      }

      // biome-ignore lint/suspicious/noExplicitAny: dashboard JSON
      const blocks: any[] = (dashboard as any)?.progress?.blocks ?? [];
      const block = blocks.find((item) => item.key === "creative_asset");
      check(block?.approved === true, "bloque creative_asset no quedó aprobado");
      check(
        (dashboard as any)?.campaign?.status === "review",
        "con 1 de 6 bloques aprobados la campaña no debe estar ready_to_publish",
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

type Result = { id: string; title: string; status: Status; ms: number; notes: string[] };

const main = async () => {
  console.log(`Smoke Fal.ai — run ${RUN_ID} contra ${BASE_URL}`);

  const token = await mintToken();
  const ctx: Ctx = { token };
  const results: Result[] = [];
  const outcomeOf = (id: string) => results.find((result) => result.id === id)?.status;

  for (const scenario of scenarios) {
    const failedDep = (scenario.deps ?? []).find(
      (dep) => outcomeOf(dep) !== "PASS" && outcomeOf(dep) !== "WARN",
    );
    if (failedDep) {
      results.push({
        id: scenario.id,
        title: scenario.title,
        status: "SKIP",
        ms: 0,
        notes: [`dependencia ${failedDep} no pasó`],
      });
      continue;
    }
    if (scenario.costGated && ctx.mode === "fal" && !FULL) {
      results.push({
        id: scenario.id,
        title: scenario.title,
        status: "SKIP",
        ms: 0,
        notes: ["cost-gated en modo fal (usa SMOKE_FULL=1)"],
      });
      continue;
    }

    const notes: string[] = [];
    const warn: Warn = (message) => notes.push(message);
    const startedAt = performance.now();
    const attempts = scenario.falRetry && ctx.mode === "fal" ? 2 : 1;
    let status: Status = "FAIL";

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await scenario.run(ctx, warn);
        status = notes.length > 0 ? "WARN" : "PASS";
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notes.push(attempt < attempts ? `intento ${attempt} falló (retry): ${message}` : message);
        status = "FAIL";
      }
    }

    results.push({
      id: scenario.id,
      title: scenario.title,
      status,
      ms: Math.round(performance.now() - startedAt),
      notes,
    });
    console.log(`  ${scenario.id} ${status} (${Math.round(performance.now() - startedAt)}ms) — ${scenario.title}`);
  }

  console.log(`\nModo detectado: ${ctx.mode ?? "desconocido"} | run ${RUN_ID}`);
  console.log("─".repeat(80));
  for (const result of results) {
    console.log(
      `${result.status.padEnd(4)} ${result.id.padEnd(4)} ${String(result.ms).padStart(7)}ms  ${result.title}`,
    );
    for (const note of result.notes) {
      console.log(`     └─ ${note}`);
    }
  }

  const counts = {
    pass: results.filter((result) => result.status === "PASS").length,
    warn: results.filter((result) => result.status === "WARN").length,
    fail: results.filter((result) => result.status === "FAIL").length,
    skip: results.filter((result) => result.status === "SKIP").length,
  };
  console.log("─".repeat(80));
  console.log(`PASS ${counts.pass} · WARN ${counts.warn} · FAIL ${counts.fail} · SKIP ${counts.skip}`);

  if (counts.fail > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`Smoke abortado: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
