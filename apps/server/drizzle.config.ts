import { env } from "@Polyedro-abs/env/server";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DIRECT_URL ?? env.DATABASE_URL,
  },
});
