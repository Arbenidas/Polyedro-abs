import { createBrand } from "@/api/services/brand";
import { parseBody } from "@/api/shared";
import { Hono } from "hono";
import { z } from "zod";

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
    userId: z.uuid().optional(),
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
      userId: input.userId,
      name,
      description,
      industry: input.industry,
      markets: input.markets,
    };
  });

const brandRoutes = new Hono();

brandRoutes.post("/", async (c) => {
  const input = await parseBody(c.req.raw, brandInputSchema);
  const result = await createBrand(input);

  return c.json(result, 201);
});

export { brandRoutes };
