import { env } from "@Polyedro-abs/env/web";
import { createClient } from "@supabase/supabase-js";

/** Cliente de Supabase para el browser — la sesión persiste en localStorage. */
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
