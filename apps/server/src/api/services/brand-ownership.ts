import { requireOne } from "@/api/shared";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Resuelve la marca si pertenece al usuario autenticado; 404 si no existe o
 *  no es del usuario (no filtramos existencia para no hacer enum de ids). */
export const requireBrandOwnership = async (brandId: string, userId: string) => {
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.id, brandId), eq(brands.userId, userId)),
  });

  return requireOne(brand, "Brand not found");
};
