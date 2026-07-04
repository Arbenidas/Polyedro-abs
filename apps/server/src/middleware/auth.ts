import { createMiddleware } from "hono/factory";

import { db } from "@/db";
import { users } from "@/db/schema";
import { supabase } from "@/lib/supabase";

export type AuthUser = typeof users.$inferSelect;

export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

/** Valida el JWT de Supabase (header `Authorization: Bearer <token>`),
 *  garantiza la fila en `users` (id = auth.users.id) y expone el usuario
 *  resuelto en `c.get("user")` para que toda query filtre por él. */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token) {
    return c.json({ error: "Missing Authorization bearer token" }, 401);
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.email) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  const name = typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : null;

  const [user] = await db
    .insert(users)
    .values({ id: data.user.id, email: data.user.email, name })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: data.user.email, ...(name ? { name } : {}) },
    })
    .returning();

  if (!user) {
    return c.json({ error: "Could not resolve user" }, 500);
  }

  c.set("user", user);
  await next();
});
