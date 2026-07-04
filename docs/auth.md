# Autenticación (Supabase Auth)

Implementa **F0.1** del [backlog](./features.md): login con Supabase Auth en `apps/web` y validación de sesión en `apps/server`. Cada request autenticado resuelve al usuario y toda query filtra por él (`brands.userId`).

## Cómo funciona

```
apps/web (browser)                        apps/server (Hono)
─────────────────────                     ─────────────────────
supabase-js (login email/password)
  └─ sesión en localStorage
apiFetch("/brands")
  └─ Authorization: Bearer <jwt>  ──────▶ requireAuth middleware
                                            ├─ supabase.auth.getUser(jwt)  → valida el token
                                            ├─ upsert en tabla `users` (id = auth.users.id)
                                            └─ c.get("user") disponible en la ruta
                                          GET /brands → where brands.userId = user.id
```

### Frontend (`apps/web`)

| Archivo | Rol |
|---|---|
| `src/lib/supabase.ts` | Cliente browser de Supabase (sesión en localStorage) |
| `src/lib/api.ts` | `apiFetch()` — fetch al server con `Authorization: Bearer <jwt>` |
| `src/components/auth-provider.tsx` | `AuthProvider` + hook `useAuth()` (session, signIn, signUp, signOut) |
| `src/components/labs/login-view.tsx` | Pantalla de login/registro (email + password) |

`LabsApp` se renderiza solo con sesión activa; sin sesión muestra `LoginView`. El sidebar muestra el usuario real y un botón **SIGN OUT**.

### Backend (`apps/server`)

| Archivo | Rol |
|---|---|
| `src/lib/supabase.ts` | Cliente de Supabase usado solo para validar tokens |
| `src/middleware/auth.ts` | `requireAuth` — valida el JWT, upserta la fila en `users` y expone `c.get("user")` |
| `src/index.ts` | Rutas protegidas: `GET /me`, `GET /brands` (filtra por `brands.userId`) |

El `id` de la fila en `users` es el mismo `id` de `auth.users` de Supabase, así que el vínculo usuario↔marcas queda garantizado sin tabla puente.

La validación usa `supabase.auth.getUser(jwt)` (round-trip al Auth server): funciona con cualquier configuración de signing keys y confirma que la sesión sigue viva. Si la latencia por request se vuelve un problema, se puede migrar a verificación local con `jose` + el endpoint JWKS del proyecto (requiere signing keys asimétricas).

**Patrón para nuevas rutas:** monta `requireAuth` y filtra siempre por el usuario resuelto:

```ts
app.get("/campaigns", requireAuth, async (c) => {
  const user = c.get("user");
  // ...where con brands.userId = user.id (join o subquery)
});
```

## Variables de entorno

Los valores salen del dashboard de Supabase: **Project Settings → API**. Como "anon key" sirve tanto la legacy `anon` (JWT) como la nueva **publishable key** (`sb_publishable_…`).

### `apps/server/.env`

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon/public key>
```

### `apps/web/.env`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/public key>
```

> Actualiza también los `.env.example` de cada app al agregar variables.

### Netlify

`netlify.toml` usa placeholders para que el build pase sin configuración, pero el login solo funciona con los valores reales: configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en **Site settings → Environment variables**.

## Setup en el dashboard de Supabase

1. **Authentication → Providers → Email**: habilitado (viene por defecto).
2. Para la demo conviene **desactivar "Confirm email"** (Authentication → Providers → Email → Confirm email) para que el registro inicie sesión de inmediato.
3. Crea un usuario demo en **Authentication → Users → Add user** si prefieres no registrarte en vivo.

## Probar end-to-end

1. `pnpm run dev` (server en `:3000`, web en `:3001`).
2. Abre `http://localhost:3001` → aparece la pantalla de login.
3. Regístrate o inicia sesión → entra al flujo de onboarding.
4. Valida el server con el token de la sesión:

```bash
# token: en la consola del browser
# (await window.localStorage.getItem(...)) o supabase.auth.getSession()
curl -H "Authorization: Bearer <access_token>" http://localhost:3000/me
curl -H "Authorization: Bearer <access_token>" http://localhost:3000/brands
# sin token → 401
curl -i http://localhost:3000/me
```
