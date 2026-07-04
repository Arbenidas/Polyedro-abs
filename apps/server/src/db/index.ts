import { env } from "@Polyedro-abs/env/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL);

export const db = drizzle(queryClient, { schema });
