export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function preflight(request: Request) {
  return request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export function requireAuthorization(request: Request) {
  const candidate = request.headers.get("apikey");
  if (!candidate) throw new Error("AUTH_REQUIRED");

  const allowed = new Set<string>();
  const configured = Deno.env.get("POLYEDRO_PUBLIC_API_KEYS") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (configured) {
    try {
      const keys = JSON.parse(configured) as Record<string, string>;
      Object.values(keys).filter(Boolean).forEach((key) => allowed.add(key));
    } catch {
      throw new Error("SUPABASE_PUBLISHABLE_KEYS_INVALID");
    }
  }
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (publishable) allowed.add(publishable);
  if (legacyAnon) allowed.add(legacyAnon);
  if (!allowed.size) throw new Error("SUPABASE_PUBLIC_AUTH_NOT_CONFIGURED");
  if (!allowed.has(candidate)) throw new Error("AUTH_REQUIRED");
  return candidate;
}
