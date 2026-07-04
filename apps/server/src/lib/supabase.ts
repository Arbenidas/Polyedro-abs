import { env } from "@Polyedro-abs/env/server";
import { createClient } from "@supabase/supabase-js";

/** Cliente usado solo para validar access tokens contra Supabase Auth.
 *  No persiste sesión: el server es stateless, cada request trae su JWT. */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
