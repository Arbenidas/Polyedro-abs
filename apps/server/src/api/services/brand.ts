import { generateBrandKitForBrand } from "@/api/services/brand-agent";
import { ApiError, requireOne } from "@/api/shared";
import { db } from "@/db";
import { brands, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const DEMO_USER_EMAIL = "demo@polyedro.abs";

export type BrandInput = {
  /** Siempre el id del usuario de la sesión (requireAuth) — nunca input del cliente. */
  userId: string;
  name: string;
  description?: string;
  industry?: string;
  markets?: string[];
};

export const listBrands = async (userId: string) => {
  return db.query.brands.findMany({
    where: eq(brands.userId, userId),
    orderBy: desc(brands.createdAt),
  });
};

export const createBrand = async (input: BrandInput) => {
  const owner = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });

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
  const { brandKit, provider } = await generateBrandKitForBrand(createdBrand, input);

  return {
    brand: createdBrand,
    brandKit,
    generation: {
      triggered: true,
      agent: "Brand Agent",
      provider,
      status: brandKit.status,
      steps: [
        "brand.created:draft",
        "brand_kit.created:generating",
        `brand_kit.content:${provider}`,
        "brand_kit.completed:approved",
      ],
    },
  };
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
