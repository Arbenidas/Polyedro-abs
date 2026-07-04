import { brandRoutes } from "@/api/routes/brand";
import { campaignRoutes } from "@/api/routes/campaign";
import { Hono } from "hono";

import type { AuthEnv } from "@/middleware/auth";

const api = new Hono<AuthEnv>();

/** Usuario autenticado resuelto desde el JWT de Supabase (middleware requireAuth). */
api.get("/me", (c) => {
  return c.json({ user: c.get("user") });
});

api.route("/brands", brandRoutes);
api.route("/", campaignRoutes);

export { api };
