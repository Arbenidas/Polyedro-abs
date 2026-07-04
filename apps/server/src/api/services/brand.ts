import { generateFalImage, isFalConfigured } from "@/api/services/fal";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { brandKits, brands, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEMO_USER_EMAIL = "demo@polyedro.abs";

const LOGO_SIZE = 1024;

/** Paleta base del brand kit (hoy fija; pasará a ser generada por LLM). Se
 *  referencia también en el prompt y el placeholder del logo. */
const KIT_COLOR_PALETTE = {
  primary: "#B7FF1A",
  secondary: "#B9E9FF",
  accent: "#FF705F",
  neutrals: ["#FFF8E8", "#111111", "#F2F2F2"],
};

const buildLogoPrompt = (input: {
  name: string;
  industry: string;
  marketLabel: string;
  description: string;
}) =>
  `Conceptual logo for ${input.name} (${input.industry}). ` +
  `Minimalist geometric logo mark with a bold heavy sans-serif wordmark, ` +
  `neo-brutalist AI-lab aesthetic, flat vector style, sharp edges, high contrast. ` +
  `Acid green ${KIT_COLOR_PALETTE.primary} accents with black elements on a clean off-white background. ` +
  `Brand brief: ${input.description} Target markets: ${input.marketLabel}. ` +
  `Centered composition, plain solid background, no photorealism, no gradients, no watermarks.`;

/** Genera el logo con Flux vía Fal.ai. La creación de la marca nunca debe
 *  fallar por el logo: sin FAL_KEY o ante un error de fal, cae a placeholder. */
const generateLogoImage = async (brandName: string, prompt: string) => {
  const background = KIT_COLOR_PALETTE.primary.replace("#", "");
  const placeholder = {
    url: `https://placehold.co/${LOGO_SIZE}x${LOGO_SIZE}/${background}/111111/png?text=${encodeURIComponent(brandName)}`,
  };

  if (!isFalConfigured()) {
    return placeholder;
  }

  try {
    return await generateFalImage({ prompt, width: LOGO_SIZE, height: LOGO_SIZE });
  } catch (error) {
    console.error(`Logo generation failed for "${brandName}", using placeholder:`, error);
    return placeholder;
  }
};

export type BrandInput = {
  userId?: string;
  name: string;
  description?: string;
  industry?: string;
  markets?: string[];
};

export const createBrand = async (input: BrandInput) => {
  const owner = input.userId
    ? await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      })
    : await upsertDemoUser();

  if (!owner) {
    throw new ApiError(404, "User not found");
  }

  const [brand] = await db
    .insert(brands)
    .values({
      userId: owner.id,
      name: input.name,
      description: input.description,
      industry: input.industry,
      status: "draft",
    })
    .returning();

  const createdBrand = requireOne(brand, "Brand could not be created");
  const brandKit = await generateBrandKitForBrand(createdBrand, input);

  return {
    brand: createdBrand,
    brandKit,
    generation: {
      triggered: true,
      agent: "Brand Agent",
      status: brandKit.status,
      steps: [
        "brand.created:draft",
        "brand_kit.created:generating",
        "brand_kit.completed:review",
      ],
    },
  };
};

const generateBrandKitForBrand = async (
  brand: {
    id: string;
    name: string;
    description: string | null;
    industry: string | null;
  },
  input: BrandInput,
) => {
  const markets = input.markets?.length ? input.markets : ["LATAM"];
  const marketLabel = markets.join(", ");
  const description =
    input.description ??
    brand.description ??
    "A modern brand that needs a complete marketing system.";
  const industry = input.industry ?? brand.industry ?? "Emerging business";

  const logoPrompt = buildLogoPrompt({
    name: brand.name,
    industry,
    marketLabel,
    description,
  });

  const [draftKit] = await db
    .insert(brandKits)
    .values({
      brandId: brand.id,
      status: "generating",
      logoPrompt,
    })
    .returning();

  const createdKit = requireOne(draftKit, "Brand kit generation could not be started");

  const logo = await generateLogoImage(brand.name, logoPrompt);

  const [completedKit] = await db
    .update(brandKits)
    .set({
      status: "review",
      logoUrl: logo.url,
      logoPrompt,
      colorPalette: KIT_COLOR_PALETTE,
      toneOfVoice: {
        es:
          `Voz clara, directa y moderna para ${brand.name}; enfocada en beneficios, confianza y accion.`,
        en:
          `Clear, direct, modern voice for ${brand.name}; focused on benefits, trust, and action.`,
      },
      buyerPersona: {
        name: `${brand.name} core buyer`,
        age: "22-40",
        occupation: "Digital-first buyer",
        goals: [
          "Find practical products or services quickly",
          "Understand the value before buying",
          `Buy from brands that feel relevant in ${marketLabel}`,
        ],
        painPoints: [
          "Generic messaging",
          "Too many options",
          "Low trust in unfamiliar brands",
        ],
        notes: description,
      },
      valueProposition: {
        es: `${brand.name} ayuda a clientes en ${marketLabel} a resolver necesidades reales con una oferta clara, moderna y facil de entender.`,
        en: `${brand.name} helps customers in ${marketLabel} solve real needs with a clear, modern, easy-to-understand offer.`,
      },
      keyMessages: {
        es: [
          `${brand.name} entiende lo que el mercado necesita.`,
          "Beneficios claros antes que ruido publicitario.",
          "Una marca lista para convertir interes en accion.",
        ],
        en: [
          `${brand.name} understands what the market needs.`,
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
          `markets:${marketLabel}`,
          `industry:${industry}`,
          "neo-brutalist dashboard",
          "Meta Ads ready creative system",
        ],
      },
    })
    .where(eq(brandKits.id, createdKit.id))
    .returning();

  return requireOne(completedKit, "Brand kit generation could not be completed");
};

export const upsertDemoUser = async () => {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, DEMO_USER_EMAIL),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ name: "Polyedro Demo" })
      .where(eq(users.id, existing.id))
      .returning();
    return requireOne(updated, "Demo user could not be updated");
  }

  const [created] = await db
    .insert(users)
    .values({
      email: DEMO_USER_EMAIL,
      name: "Polyedro Demo",
    })
    .returning();

  return requireOne(created, "Demo user could not be created");
};
