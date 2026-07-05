import { generateStructuredObject, isLlmConfigured } from "@/api/services/ai";
import {
  type ImageRequest,
  generateImage,
  generatePlaceholderImage,
} from "@/api/services/images";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { brandKits, brands } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/** Brand Agent: genera el contenido del brand kit (paleta, tono bilingüe,
 *  persona, propuesta, mensajes, estilo) con OpenAI vía Vercel AI SDK y
 *  mantiene la transición draft → generating → review en brand_kits.status.
 *  Sin OPENAI_API_KEY (o ante cualquier error del LLM) cae al contenido
 *  template para que la creación de la marca nunca falle. */

const LOGO_SIZE = 1024;
const BRAND_KIT_CONTENT_REQUEST_TIMEOUT_MS = 4_000;

const bilingualText = z.strictObject({ es: z.string(), en: z.string() });

/** Shapes espejo de los $type de brand_kits en el schema de drizzle. Para el
 *  structured output estricto todos los campos son requeridos (superset de
 *  los campos opcionales de la DB, así que sigue siendo asignable). */
const brandKitContentSchema = z.strictObject({
  colorPalette: z.strictObject({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    neutrals: z.array(z.string()),
  }),
  toneOfVoice: bilingualText,
  buyerPersona: z.strictObject({
    name: z.string(),
    age: z.string(),
    occupation: z.string(),
    goals: z.array(z.string()),
    painPoints: z.array(z.string()),
    notes: z.string(),
  }),
  valueProposition: bilingualText,
  keyMessages: z.strictObject({
    es: z.array(z.string()),
    en: z.array(z.string()),
  }),
  visualStyle: z.strictObject({
    mood: z.string(),
    imageryStyle: z.string(),
    typography: z.string(),
    references: z.array(z.string()),
  }),
});

export type BrandKitContent = z.infer<typeof brandKitContentSchema>;

type BrandContext = {
  name: string;
  description: string;
  industry: string;
  marketLabel: string;
};

type BrandRecord = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
};

export type BrandKitGenerationInput = {
  description?: string;
  industry?: string;
  markets?: string[];
};

const buildBrandContext = (
  brand: BrandRecord,
  input: BrandKitGenerationInput,
): BrandContext => {
  const markets = input.markets?.length ? input.markets : ["LATAM"];

  return {
    name: brand.name,
    description:
      input.description ??
      brand.description ??
      "A modern brand that needs a complete marketing system.",
    industry: input.industry ?? brand.industry ?? "Emerging business",
    marketLabel: markets.join(", "),
  };
};

const SYSTEM_PROMPT =
  "You are the Brand Agent for Polyedro, an AI marketing platform for personal brands and small businesses. " +
  "Given a brand brief, produce a complete brand kit as JSON matching the provided schema. Rules: " +
  "all bilingual fields must have natural Latin American Spanish (es) and English (en) versions with " +
  "equivalent meaning, not literal translations. Colors are 6-digit hex like #B7FF1A; choose a distinctive " +
  "palette coherent with the industry, with strong contrast between primary and neutrals; include 2-4 neutrals. " +
  "Provide exactly 3 key messages per language, 2-4 buyer persona goals and pain points, and 2-4 visual style " +
  "references. The kit will drive Meta Ads campaigns, so keep everything concrete and conversion-oriented. " +
  'Ground everything in the brief; never use placeholder text like "Lorem" or "TBD".';

const buildUserPrompt = (context: BrandContext) =>
  `Brand name: ${context.name}\n` +
  `Industry: ${context.industry}\n` +
  `Target markets: ${context.marketLabel}\n` +
  `Brief: ${context.description}\n\n` +
  "Generate the brand kit.";

/** Paleta del contenido template (la misma que era fija antes del LLM). */
const FALLBACK_COLOR_PALETTE = {
  primary: "#B7FF1A",
  secondary: "#B9E9FF",
  accent: "#FF705F",
  neutrals: ["#FFF8E8", "#111111", "#F2F2F2"],
};

/** Contenido template usado sin OPENAI_API_KEY o si el LLM falla. */
const buildFallbackContent = (context: BrandContext): BrandKitContent => ({
  colorPalette: FALLBACK_COLOR_PALETTE,
  toneOfVoice: {
    es: `Voz clara, directa y moderna para ${context.name}; enfocada en beneficios, confianza y accion.`,
    en: `Clear, direct, modern voice for ${context.name}; focused on benefits, trust, and action.`,
  },
  buyerPersona: {
    name: `${context.name} core buyer`,
    age: "22-40",
    occupation: "Digital-first buyer",
    goals: [
      "Find practical products or services quickly",
      "Understand the value before buying",
      `Buy from brands that feel relevant in ${context.marketLabel}`,
    ],
    painPoints: [
      "Generic messaging",
      "Too many options",
      "Low trust in unfamiliar brands",
    ],
    notes: context.description,
  },
  valueProposition: {
    es: `${context.name} ayuda a clientes en ${context.marketLabel} a resolver necesidades reales con una oferta clara, moderna y facil de entender.`,
    en: `${context.name} helps customers in ${context.marketLabel} solve real needs with a clear, modern, easy-to-understand offer.`,
  },
  keyMessages: {
    es: [
      `${context.name} entiende lo que el mercado necesita.`,
      "Beneficios claros antes que ruido publicitario.",
      "Una marca lista para convertir interes en accion.",
    ],
    en: [
      `${context.name} understands what the market needs.`,
      "Clear benefits before marketing noise.",
      "A brand built to turn interest into action.",
    ],
  },
  visualStyle: {
    mood: "AI lab, sharp, confident, conversion-focused",
    imageryStyle:
      "High-contrast product or offer visuals with bold layouts and clear hierarchy",
    typography: "Heavy sans-serif headlines with compact technical labels",
    references: [
      `markets:${context.marketLabel}`,
      `industry:${context.industry}`,
      "neo-brutalist dashboard",
      "Meta Ads ready creative system",
    ],
  },
});

export type BrandKitProvider = "openai" | "fallback";

/** Nunca lanza: cualquier fallo del LLM (sin key, timeout, refusal, JSON
 *  inválido) cae al contenido template, igual que el placeholder del logo. */
const generateBrandKitContent = async (
  context: BrandContext,
): Promise<{ content: BrandKitContent; provider: BrandKitProvider }> => {
  if (!isLlmConfigured()) {
    return { content: buildFallbackContent(context), provider: "fallback" };
  }

  try {
    const content = await generateStructuredObject({
      schema: brandKitContentSchema,
      schemaName: "brand_kit_content",
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(context),
    });

    return { content, provider: "openai" };
  } catch (error) {
    console.error(
      `Brand kit content generation failed for "${context.name}", using fallback:`,
      error,
    );
    return { content: buildFallbackContent(context), provider: "fallback" };
  }
};

const buildLogoPrompt = (context: BrandContext, primaryColor: string) =>
  `Conceptual logo for ${context.name} (${context.industry}). ` +
  `Minimalist geometric logo mark with a bold heavy sans-serif wordmark, ` +
  `neo-brutalist AI-lab aesthetic, flat vector style, sharp edges, high contrast. ` +
  `${primaryColor} accents with black elements on a clean off-white background. ` +
  `Brand brief: ${context.description} Target markets: ${context.marketLabel}. ` +
  `Centered composition, plain solid background, no photorealism, no gradients, no watermarks.`;

const buildLogoImageRequest = (
  brandName: string,
  prompt: string,
  primaryColor: string,
): ImageRequest => ({
  prompt,
  width: LOGO_SIZE,
  height: LOGO_SIZE,
  placeholder: { label: brandName, background: primaryColor },
});

/** Genera el logo con el provider de imágenes configurado (IMAGE_PROVIDER).
 *  La creación de la marca nunca debe fallar por el logo: ante cualquier
 *  error del provider cae a placeholder. */
const generateLogoImageFromRequest = async (
  brandName: string,
  request: ImageRequest,
) => {
  try {
    return await generateImage(request);
  } catch (error) {
    console.error(
      `Logo generation failed for "${brandName}", using placeholder:`,
      error,
    );
    return generatePlaceholderImage(request);
  }
};

const queueLogoImageUpdate = (input: {
  brandKitId: string;
  brandName: string;
  request: ImageRequest;
}) => {
  void generateLogoImageFromRequest(input.brandName, input.request)
    .then((logo) =>
      db
        .update(brandKits)
        .set({ logoUrl: logo.url })
        .where(eq(brandKits.id, input.brandKitId)),
    )
    .catch((error) => {
      console.error(`Async logo update failed for "${input.brandName}":`, error);
    });
};

const withRequestTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ timedOut: false; value: T } | { timedOut: true }> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve({ timedOut: true }), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve({ timedOut: false, value });
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });

const queueBrandKitContentUpdate = (input: {
  brandKitId: string;
  brandName: string;
  context: BrandContext;
  contentPromise: Promise<{ content: BrandKitContent; provider: BrandKitProvider }>;
}) => {
  void input.contentPromise
    .then(async ({ content, provider }) => {
      if (provider === "fallback") {
        return;
      }

      const logoPrompt = buildLogoPrompt(input.context, content.colorPalette.primary);
      const logoRequest = buildLogoImageRequest(
        input.brandName,
        logoPrompt,
        content.colorPalette.primary,
      );
      const placeholderLogo = generatePlaceholderImage(logoRequest);

      await db
        .update(brandKits)
        .set({
          status: "approved",
          logoUrl: placeholderLogo.url,
          logoPrompt,
          ...content,
        })
        .where(eq(brandKits.id, input.brandKitId));

      queueLogoImageUpdate({
        brandKitId: input.brandKitId,
        brandName: input.brandName,
        request: logoRequest,
      });
    })
    .catch((error) => {
      console.error(
        `Async brand kit content update failed for "${input.brandName}":`,
        error,
      );
    });
};

/** Flujo de creación (usado por createBrand): inserta el kit en "generating",
 *  da a OpenAI una ventana corta para contenido real y si no responde usa
 *  fallback inmediato. La generación lenta continúa fuera del request path. */
export const generateBrandKitForBrand = async (
  brand: BrandRecord,
  input: BrandKitGenerationInput,
) => {
  const context = buildBrandContext(brand, input);

  const [draftKit] = await db
    .insert(brandKits)
    .values({
      brandId: brand.id,
      status: "generating",
    })
    .returning();

  const createdKit = requireOne(draftKit, "Brand kit generation could not be started");

  const contentPromise = generateBrandKitContent(context);
  const timedContent = await withRequestTimeout(
    contentPromise,
    BRAND_KIT_CONTENT_REQUEST_TIMEOUT_MS,
  );
  const { content, provider } = timedContent.timedOut
    ? { content: buildFallbackContent(context), provider: "fallback" as const }
    : timedContent.value;
  const logoPrompt = buildLogoPrompt(context, content.colorPalette.primary);
  const logoRequest = buildLogoImageRequest(
    brand.name,
    logoPrompt,
    content.colorPalette.primary,
  );
  const placeholderLogo = generatePlaceholderImage(logoRequest);

  const [completedKit] = await db
    .update(brandKits)
    // El brand kit se revisa en el onboarding y no tiene un paso de aprobación
    // propio (no hay target "brand_kit" en /approve). Queda "approved" al
    // generarse — igual que la data demo — para no bloquear el publish de la
    // campaña, cuyo readiness lo exige aprobado.
    .set({
      status: "approved",
      logoUrl: placeholderLogo.url,
      logoPrompt,
      ...content,
    })
    .where(eq(brandKits.id, createdKit.id))
    .returning();

  if (timedContent.timedOut) {
    queueBrandKitContentUpdate({
      brandKitId: createdKit.id,
      brandName: brand.name,
      context,
      contentPromise,
    });
  } else {
    queueLogoImageUpdate({
      brandKitId: createdKit.id,
      brandName: brand.name,
      request: logoRequest,
    });
  }

  return {
    brandKit: requireOne(completedKit, "Brand kit generation could not be completed"),
    provider,
  };
};

/** Re-ejecución del Brand Agent sobre una marca existente. No toca el logo
 *  (la paleta puede divergir del logo generado en la creación; trade-off
 *  aceptado). Sin 409 ante corridas concurrentes: gana la última escritura y
 *  además se auto-recupera un kit atascado en "generating". */
export const runBrandAgent = async (
  brandId: string,
  userId: string,
  markets?: string[],
) => {
  const brand = await db.query.brands.findFirst({
    // Ownership en la query; 404 (no 403) para no filtrar existencia.
    where: and(eq(brands.id, brandId), eq(brands.userId, userId)),
  });

  if (!brand) {
    throw new ApiError(404, "Brand not found");
  }

  const existing = await db.query.brandKits.findFirst({
    where: eq(brandKits.brandId, brandId),
  });

  const [generatingKit] = existing
    ? await db
        .update(brandKits)
        .set({ status: "generating" })
        .where(eq(brandKits.id, existing.id))
        .returning()
    : await db
        .insert(brandKits)
        .values({ brandId, status: "generating" })
        .returning();

  const kit = requireOne(generatingKit, "Brand kit generation could not be started");

  try {
    const context = buildBrandContext(brand, { markets });
    const { content, provider } = await generateBrandKitContent(context);

    const [updated] = await db
      .update(brandKits)
      // Ver nota en generateBrandKitForBrand: sin paso de aprobación propio,
      // el kit queda "approved" al generarse.
      .set({ status: "approved", ...content })
      .where(eq(brandKits.id, kit.id))
      .returning();

    const brandKit = requireOne(updated, "Brand kit could not be updated");

    return {
      brandKit,
      generation: {
        triggered: true,
        agent: "Brand Agent",
        provider,
        status: brandKit.status,
        steps: [
          "brand_kit.regenerating:generating",
          `brand_kit.content:${provider}`,
          "brand_kit.completed:approved",
        ],
      },
    };
  } catch (error) {
    await db
      .update(brandKits)
      .set({ status: "draft" })
      .where(eq(brandKits.id, kit.id));
    throw error;
  }
};
