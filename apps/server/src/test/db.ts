import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

/** Postgres en proceso (WASM, efímero) con el mismo esquema relacional que
 *  producción, para probar la lógica real de Drizzle sin una DB externa. */
const client = new PGlite();

export const testDb = drizzle(client, { schema });

/** Migraciones aplicadas en orden de nombre de archivo. El _journal de Drizzle
 *  está desincronizado (le falta 0001), así que las aplicamos directo desde el
 *  disco en vez de usar el migrator, para reproducir el esquema vigente. */
const MIGRATION_FILES = [
  "0000_low_namora.sql",
  "0001_sticky_molten_man.sql",
  "0002_good_jack_flag.sql",
];

const migrationsDir = fileURLToPath(new URL("../db/migrations/", import.meta.url));

let migrated = false;

export const applyMigrations = async () => {
  if (migrated) {
    return;
  }

  for (const file of MIGRATION_FILES) {
    const raw = readFileSync(`${migrationsDir}${file}`, "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.exec(statement);
    }
  }

  migrated = true;
};

/** Vacía todas las tablas entre tests. TRUNCATE ... CASCADE respeta las FKs. */
export const resetDb = async () => {
  await testDb.execute(
    sql`TRUNCATE TABLE
      "automation_exports", "voiceovers", "video_scripts", "creative_assets",
      "campaign_strategies", "ad_copies", "campaign_briefs", "campaigns",
      "brand_kits", "brands", "users"
    RESTART IDENTITY CASCADE`,
  );
};
