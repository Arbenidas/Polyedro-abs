import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { requireOne } from "@/api/shared";
import { brandKits, brands, users } from "@/db/schema";
import { applyMigrations, resetDb, testDb } from "@/test/db";

const generatedContent = {
  colorPalette: {
    primary: "#D72638",
    secondary: "#F6E7CB",
    accent: "#1B998B",
    neutrals: ["#FFF8E8", "#141414"],
  },
  toneOfVoice: {
    es: "Cercana, directa y apetitosa.",
    en: "Warm, direct, and craveable.",
  },
  buyerPersona: {
    name: "Food explorer",
    age: "24-42",
    occupation: "Urban diner",
    goals: ["Find authentic pizza", "Order quickly"],
    painPoints: ["Generic delivery", "Cold food"],
    notes: "Looks for wood-fired pizza with local flavor.",
  },
  valueProposition: {
    es: "Pizza artesanal a la lena para compartir sin complicaciones.",
    en: "Wood-fired artisan pizza made easy to share.",
  },
  keyMessages: {
    es: ["Hecha a la lena.", "Ingredientes honestos.", "Lista para compartir."],
    en: ["Wood-fired.", "Honest ingredients.", "Ready to share."],
  },
  visualStyle: {
    mood: "Warm, bold, appetizing",
    imageryStyle: "Close-up food photography with strong contrast",
    typography: "Bold sans serif with handmade accents",
    references: ["wood-fired oven", "latam delivery", "family table"],
  },
};

const aiMock = vi.hoisted(() => {
  let resolveContent: ((value: typeof generatedContent) => void) | undefined;
  const generateStructuredObject = vi.fn(async () => generatedContent);

  return {
    generateStructuredObject,
    isLlmConfigured: vi.fn(() => true),
    mockDeferredContent: () => {
      resolveContent = undefined;
      generateStructuredObject.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveContent = resolve;
          }),
      );
    },
    mockImmediateContent: () => {
      resolveContent = undefined;
      generateStructuredObject.mockImplementation(async () => generatedContent);
    },
    resolveContent: () => {
      if (!resolveContent) {
        throw new Error("generateStructuredObject was not called");
      }
      resolveContent(generatedContent);
    },
  };
});

const imageMock = vi.hoisted(() => {
  let resolveGenerated: ((value: {
    url: string;
    provider: "openai";
    width: number;
    height: number;
  }) => void) | undefined;

  const generateImage = vi.fn();
  const reset = () => {
    resolveGenerated = undefined;
    generateImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerated = resolve;
        }),
    );
  };

  reset();

  return {
    generateImage,
    generatePlaceholderImage: vi.fn((request) => ({
      url: "https://placeholder.test/logo.png",
      provider: "placeholder",
      width: request.width,
      height: request.height,
    })),
    reset,
    resolveGenerated: (value: {
      url: string;
      provider: "openai";
      width: number;
      height: number;
    }) => {
      if (!resolveGenerated) {
        throw new Error("generateImage was not called");
      }
      resolveGenerated(value);
    },
  };
});

// Los servicios importan `db` desde @/db; lo apuntamos a la instancia PGlite.
vi.mock("@/db", async () => {
  const { testDb } = await import("@/test/db");
  return { db: testDb };
});

vi.mock("@/api/services/ai", () => aiMock);

vi.mock("@/api/services/images", () => ({
  generateImage: imageMock.generateImage,
  generatePlaceholderImage: imageMock.generatePlaceholderImage,
}));

// Importado después de los mocks para que resuelvan al módulo mockeado.
const { generateBrandKitForBrand } = await import("@/api/services/brand-agent");

let seedCounter = 0;

const seedBrand = async () => {
  seedCounter += 1;
  const user = requireOne(
    (
      await testDb
        .insert(users)
        .values({
          email: `brand-owner-${seedCounter}@test.dev`,
          name: "Brand Owner",
        })
        .returning()
    )[0],
    "seed user",
  );

  return requireOne(
    (
      await testDb
        .insert(brands)
        .values({
          userId: user.id,
          name: "Pizzas Fantinos",
          description: "Pizzas hechas a la lena con amor",
          industry: "Restaurant",
        })
        .returning()
    )[0],
    "seed brand",
  );
};

beforeAll(async () => {
  await applyMigrations();
});

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  aiMock.mockImmediateContent();
  imageMock.reset();
});

describe("generateBrandKitForBrand", () => {
  it("returns a placeholder logo before async logo generation completes", async () => {
    const brand = await seedBrand();

    const result = await Promise.race([
      generateBrandKitForBrand(brand, {
        description: "Pizzas hechas a la lena con amor",
        markets: ["MX", "CO", "CL"],
      }),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), 250);
      }),
    ]);

    expect(result).not.toBe("timeout");
    if (result === "timeout") {
      throw new Error("brand kit generation waited for image generation");
    }

    expect(result.brandKit.logoUrl).toBe("https://placeholder.test/logo.png");
    expect(result.provider).toBe("openai");
    expect(aiMock.generateStructuredObject).toHaveBeenCalledTimes(1);
    expect(imageMock.generatePlaceholderImage).toHaveBeenCalledTimes(1);
    expect(imageMock.generateImage).toHaveBeenCalledTimes(1);

    const beforeImage = await testDb.query.brandKits.findFirst({
      where: eq(brandKits.id, result.brandKit.id),
    });
    expect(beforeImage?.logoUrl).toBe("https://placeholder.test/logo.png");

    imageMock.resolveGenerated({
      url: "https://generated.test/logo.png",
      provider: "openai",
      width: 1024,
      height: 1024,
    });

    await vi.waitFor(async () => {
      const afterImage = await testDb.query.brandKits.findFirst({
        where: eq(brandKits.id, result.brandKit.id),
      });
      expect(afterImage?.logoUrl).toBe("https://generated.test/logo.png");
    });
  });

  it("returns fallback content when OpenAI content exceeds the request window", async () => {
    vi.useFakeTimers();
    aiMock.mockDeferredContent();

    try {
      const brand = await seedBrand();
      const resultPromise = generateBrandKitForBrand(brand, {
        description: "Pizzas hechas a la lena con amor",
        markets: ["MX", "CO", "CL"],
      });

      await vi.advanceTimersByTimeAsync(4_000);
      const result = await resultPromise;

      expect(result.provider).toBe("fallback");
      expect(result.brandKit.status).toBe("approved");
      expect(result.brandKit.valueProposition?.es).toContain("Pizzas Fantinos");
      expect(imageMock.generateImage).not.toHaveBeenCalled();

      vi.useRealTimers();
      aiMock.resolveContent();

      await vi.waitFor(async () => {
        const afterContent = await testDb.query.brandKits.findFirst({
          where: eq(brandKits.id, result.brandKit.id),
        });
        expect(afterContent?.valueProposition).toEqual(generatedContent.valueProposition);
      });

      expect(imageMock.generateImage).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
