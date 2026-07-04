import { env } from "@Polyedro-abs/env/server";
import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { api } from "@/api/routes";
import { ApiError } from "@/api/shared";
import { db } from "@/db";
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

// Toda la API requiere sesión de Supabase; el usuario resuelto queda en c.get("user").
app.use("/api/*", requireAuth);
app.route("/api", api);

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(
      {
        error: {
          message: error.message,
          details: error.details,
        },
      },
      error.status,
    );
  }

  console.error(error);

  return c.json(
    {
      error: {
        message: "Internal server error",
      },
    },
    500,
  );
});

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
