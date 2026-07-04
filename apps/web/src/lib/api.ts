import { env } from "@Polyedro-abs/env/web";

import { supabase } from "./supabase";

/** fetch contra apps/server adjuntando el access token de la sesión actual
 *  (`Authorization: Bearer <jwt>`), que el server valida con Supabase Auth. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${env.NEXT_PUBLIC_SERVER_URL}${path}`, { ...init, headers });
}
