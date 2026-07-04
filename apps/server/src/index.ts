import { env } from "@Polyedro-abs/env/server";
import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { db } from "@/db";
import { brands } from "@/db/schema";
import { requireAuth } from "@/middleware/auth";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

app.get("/health/db", async (c) => {
  const result = await db.execute(sql`select 1 as ok`);
  return c.json({ db: "ok", result });
});

/** Usuario autenticado resuelto desde el JWT de Supabase. */
app.get("/me", requireAuth, (c) => {
  return c.json({ user: c.get("user") });
});

/** Marcas del usuario autenticado — toda query filtra por brands.userId. */
app.get("/brands", requireAuth, async (c) => {
  const user = c.get("user");
  const result = await db.query.brands.findMany({
    where: eq(brands.userId, user.id),
    orderBy: desc(brands.createdAt),
  });
  return c.json({ brands: result });
});

import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
