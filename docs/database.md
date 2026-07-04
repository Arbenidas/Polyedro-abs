# Base de datos

El backend (`apps/server`) usa **Postgres alojado en Supabase** como base de datos, con **[Drizzle ORM](https://orm.drizzle.team/)** como capa de acceso a datos y **[postgres.js](https://github.com/porsager/postgres)** como driver.

## Archivos relevantes

```
apps/server/
├── .env                      # credenciales reales (ignorado por git)
├── .env.example               # plantilla sin secretos
├── drizzle.config.ts          # config de drizzle-kit (migraciones)
└── src/
    ├── index.ts                # define GET /health/db (chequeo de conexión)
    └── db/
        ├── index.ts             # cliente Drizzle (`db`)
        ├── schema/
        │   └── index.ts          # definición de tablas
        └── migrations/           # migraciones generadas (drizzle-kit generate)
```

Las variables de entorno (`DATABASE_URL`, `DIRECT_URL`) se validan con zod en el paquete compartido `packages/env/src/server.ts` y se consumen vía `import { env } from "@Polyedro-abs/env/server"`.

## Variables de entorno

| Variable | Uso | Puerto Supabase |
|---|---|---|
| `DATABASE_URL` | Conexión en runtime de la app (cliente `db` en `src/db/index.ts`) | **Pooler**, modo *transaction* — `6543` |
| `DIRECT_URL` | Conexión usada solo por `drizzle-kit` para migraciones/introspección | Pooler, modo *session* — `5432`, u opcionalmente conexión directa si tu red soporta IPv6 (ver más abajo) |

Ambas se obtienen desde el dashboard de Supabase: **Project Settings → Database → Connection string**.

- `DATABASE_URL` → pestaña **Transaction pooler**
- `DIRECT_URL` → pestaña **Session pooler** (o **Direct connection** si tienes salida IPv6)

### ¿Por qué pooler y no conexión directa?

Supabase expone tres formas de conectarse:

1. **Conexión directa** (`db.<project-ref>.supabase.co:5432`) — solo resuelve por **IPv6**. Muchas redes (contenedores, CI, algunas VPNs/ISPs) no tienen salida IPv6 y la conexión falla con timeout.
2. **Pooler en modo *transaction*** (`aws-0-<region>.pooler.supabase.com:6543`) — IPv4, pensado para el tráfico normal de la app. No soporta bien comandos DDL de sesión larga (por eso no se usa para migraciones).
3. **Pooler en modo *session*** (mismo host, puerto `5432`) — IPv4, compatible con DDL, ideal para `drizzle-kit`.

Por eso este proyecto usa **pooler para ambas variables**, evitando el problema de IPv6 sin sacrificar compatibilidad con migraciones.

### Password con caracteres especiales

Si tu contraseña de base de datos contiene caracteres como `"`, `|`, `@`, `#`, etc., debes **URL-encodearlos** dentro de la connection string o la URL no se parseará correctamente. Ejemplo: `"` → `%22`, `|` → `%7C`.

## Setup para un nuevo desarrollador

1. Copia `apps/server/.env.example` a `apps/server/.env`.
2. Entra al dashboard de Supabase del proyecto → Project Settings → Database → Connection string.
3. Completa `DATABASE_URL` (pestaña *Transaction pooler*) y `DIRECT_URL` (pestaña *Session pooler*) con tu password real (URL-encodeada si aplica).
4. Corre `pnpm install` y `pnpm run dev:server`.
5. Verifica la conexión: `curl http://localhost:3000/health/db` debe responder `{"db":"ok","result":[{"ok":1}]}`.

## Definir tablas

Agrega tus tablas en `apps/server/src/db/schema/index.ts` usando `drizzle-orm/pg-core`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

El cliente `db` (exportado desde `apps/server/src/db/index.ts`) infiere los tipos automáticamente desde este schema.

## Migraciones

Scripts disponibles en `apps/server/package.json` (ejecutar desde `apps/server/`):

| Script | Qué hace |
|---|---|
| `pnpm run db:generate` | Genera un archivo de migración SQL a partir de los cambios en `src/db/schema` |
| `pnpm run db:migrate` | Aplica las migraciones generadas contra la base de datos (`DIRECT_URL`) |
| `pnpm run db:push` | Sincroniza el schema directo a la base de datos sin generar archivos de migración — útil en desarrollo temprano, evitar en producción |
| `pnpm run db:studio` | Abre [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview), un explorador visual de la base de datos |

Flujo recomendado:
- **Desarrollo temprano / prototipado**: `db:push` para iterar rápido sin acumular migraciones.
- **Una vez el schema se estabiliza**: `db:generate` (crea el `.sql` en `src/db/migrations/`) seguido de `db:migrate` para aplicarlo — así queda versionado en git.

## Verificar la conexión

- **Vía la app**: `pnpm run dev:server` y luego `curl http://localhost:3000/health/db`.
- **Vía drizzle-kit** (sin levantar el server): `cd apps/server && pnpm exec drizzle-kit push` — si conecta bien, reporta cambios de schema o "No changes detected".

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `drizzle-kit push` se queda colgado en "Pulling schema from database..." y termina en timeout | Estás usando la conexión directa (5432, `db.<ref>.supabase.co`) en una red sin IPv6. Cambia a la URL del pooler. |
| Error de parseo de la URL / conexión rechazada apenas arranca | La password tiene caracteres especiales sin URL-encodear. |
| `ECONNREFUSED` o error de SSL | Verifica que el puerto coincide con el modo de pooler elegido (6543 transaction / 5432 session) y que no falta `?sslmode=require` según la región de tu proyecto. |

## Seguridad

- `apps/server/.env` está ignorado por git (`apps/server/.gitignore`); nunca se debe commitear.
- `apps/server/.env.example` documenta las variables requeridas sin exponer secretos — mantenlo actualizado si agregas nuevas variables.
- Si una contraseña de base de datos se comparte por error (chat, ticket, etc.), rótala de inmediato desde **Project Settings → Database → Reset database password** en Supabase.
