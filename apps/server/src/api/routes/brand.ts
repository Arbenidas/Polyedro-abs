import { createBrand, listBrands } from "@/api/services/brand";
import { parseBody } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

import type { AuthEnv } from "@/middleware/auth";

const marketsSchema = z
  .union([
    z.array(z.string().trim().min(1)),
    z.record(z.string(), z.boolean()).transform((markets) =>
      Object.entries(markets)
        .filter(([, selected]) => selected)
        .map(([market]) => market),
    ),
  ])
  .optional();

const brandInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    brandName: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    whatDoYouSell: z.string().trim().min(1).optional(),
    industry: z.string().trim().min(1).optional(),
    markets: marketsSchema,
  })
  .transform((input, ctx) => {
    const name = input.name ?? input.brandName;
    const description = input.description ?? input.whatDoYouSell;

    if (!name) {
      ctx.addIssue({
        code: "custom",
        message: "Brand name is required",
        path: ["name"],
      });
      return z.NEVER;
    }

    return {
      name,
      description,
      industry: input.industry,
      markets: input.markets,
    };
  });

const brandRoutes = new Hono<AuthEnv>();

/** Marcas del usuario autenticado — toda query filtra por brands.userId. */
brandRoutes.get("/", async (c) => {
  const result = await listBrands(c.get("user").id);

  return c.json({ brands: result });
});

brandRoutes.post("/", async (c) => {
  const input = await parseBody(c.req.raw, brandInputSchema);
  // El owner siempre es el usuario de la sesión; nunca se acepta userId del body.
  const result = await createBrand({ ...input, userId: c.get("user").id });

  return c.json(result, 201);
});

export { brandRoutes };
