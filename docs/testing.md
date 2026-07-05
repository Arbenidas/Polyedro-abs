# Testing — smoke E2E de las features Fal.ai

Suite de smoke tests API-level para las features de imagen con IA: **logo conceptual del Brand Agent** (PR #9, F2.1) y **Creative Agent 1080×1080 A/B** (PR #8, F4.4), más el loop de revisión (F6.1/F6.2) y el gate de auth (F0). Runner: [`apps/server/scripts/smoke-fal.ts`](../apps/server/scripts/smoke-fal.ts) — cero dependencias (tsx + fetch), corre contra un server levantado.

## Cómo correr

```bash
# 1. levantar el server (placeholder mode si no hay FAL_KEY en apps/server/.env)
pnpm --filter server dev

# 2. en otra terminal
SMOKE_USER_EMAIL=rodrigopineda+claude-e2e-2@ravn.co \
SMOKE_USER_PASSWORD=<password del usuario e2e> \
pnpm --filter server smoke:fal

# contra el ambiente live (objetivo real de la suite, una vez haya FAL_KEY):
SMOKE_BASE_URL=https://<server-live> SMOKE_EXPECT_PROVIDER=fal \
SMOKE_USER_EMAIL=... SMOKE_USER_PASSWORD=... pnpm --filter server smoke:fal
```

El script imprime una tabla PASS/WARN/FAIL/SKIP por escenario y sale con código ≠ 0 si algo falla. La data creada se prefija `SMOKE-<timestamp>` (marcas y campañas) para poder limpiarla después.

| Variable | Default | Uso |
|---|---|---|
| `SMOKE_USER_EMAIL` / `SMOKE_USER_PASSWORD` | — (requeridas) | usuario e2e de Supabase (confirm-email está apagado) |
| `SMOKE_BASE_URL` | `http://localhost:3000` | apuntar a otro server |
| `SMOKE_EXPECT_PROVIDER` | auto-detect | `placeholder` \| `fal` — aborta si el modo del server no coincide (atrapa el caso "FAL_KEY inválida mata el fallback") |
| `SMOKE_FULL` | off | `1` corre también los escenarios cost-gated en modo fal |

## Modos

El modo se **detecta** del primer logo generado (host `placehold.co` → placeholder; `*.fal.media` → fal):

- **Placeholder** (sin `FAL_KEY`): corre todo, cero costo. Las URLs de imagen se validan por **forma** (host, dimensiones, encoding); el fetch real de placehold.co es solo WARN (la disponibilidad de un tercero no es regresión nuestra).
- **Fal** (key real): el GET de cada `fal.media` URL es **hard-fail** (valida el header de no-expiración del CDN — si eso regresa, las URLs guardadas se pudren). Dimensiones: en fal se asegura cuadrado >0 (el modelo puede ajustar), en placeholder exacto 1080/1024.
- **Costo en modo fal** (flux-2, $0.012/MP): run default ≈ 5 imágenes ≈ **$0.07**; con `SMOKE_FULL=1` ≈ 9 imágenes ≈ **$0.12**. Los escenarios cost-gated (S5/S6/S8/S12) prueban parsing/idempotencia, no generación — por eso se saltan por default en fal.

## Matriz user story ↔ escenario

| Escenario | User story / feature | Qué asegura |
|---|---|---|
| S0 | infra | `GET /` y `/health/db` públicos (regresión de orden del middleware) |
| S1 | F0 auth | sin token / token basura → 401 en `/api/*` |
| S2 | F0 auth | token válido → `/api/me` devuelve el usuario e2e (upsert en `users`) |
| S3 | **F2.1 logo** | `POST /brands` → kit `review`, `logoUrl` + `logoPrompt` (nombre + industria), URL válida según modo |
| S4 | F0.2 scoping | `GET /brands` lista la marca propia y NO la del usuario demo |
| S5 † | F2.1 | input mínimo (solo nombre) → defaults + logo igual |
| S6 † | F1.1 | alias `brandName`/`whatDoYouSell` + markets como record `{MX:true,CO:false}` |
| S7 | F1.1 | marca sin nombre → 400 |
| S8 † | F2.1 | nombre con acentos/`&` → URL de logo parseable |
| S9 | F3.1 | crear campaña → `draft`; `brandId` inválido → 400, inexistente → 404 |
| S10 | **F4.4 creativos** | 2 assets `a`+`b` en `review`, `failures=[]`, prompt con objetivo + paleta y sin "Commercial angle", altText, metadata (`meta_ads_static`, provider, dims), URLs válidas |
| S11 | F4.1 | dashboard refleja los 2 creativos, bloque `creative_asset` presente, campaña `review` |
| S12 † | F6.2 | re-correr el agente NO duplica filas (upsert por variante) |
| S13 | robustez | campaña inexistente → 404, uuid malformado → 400, `target` inválido → 400, asset ajeno → 404 |
| S14 | **F6.2 regenerar** | regenerar variante `b` conserva id/variante, `review`, `generatedAt` fresco |
| S15 | seguridad | asset de la campaña 1 usado contra la campaña 2 → 404 (sin costo: campaña 2 vacía) |
| S16 | **F6.1 aprobar** | aprobar ambos creativos → bloque `approved`; campaña sigue `review` (1/6 bloques, pin de la lógica de readiness) |

† = cost-gated: en modo fal solo con `SMOKE_FULL=1`.

## Escenarios manuales (no automatizados)

- **M1 — FAL_KEY inválida**: poner `FAL_KEY=garbage` en `apps/server/.env`, reiniciar y verificar: `POST /agents/creative` → **500** con ambas variantes en `failures` y assets en `draft` con `metadata.error`; `POST /brands` → **201** igual, con logo placeholder (resiliencia). Nota: fal devuelve 401, que NO se reintenta (401 ∉ {408,502,503,504}) — correcto; el camino de retry transitorio no es testeable E2E (gap de unit test). Quitar la key al terminar.
- **M2 — no-expiración (día después)**: con key real, guardar una `fal.media` URL y volver a hacerle GET **>24 h después** → debe seguir 200 (el fetch el mismo día no prueba el header de lifecycle).

## Gaps conocidos (documentados, no arreglados aquí)

- **Campañas sin scoping por usuario**: cualquier usuario autenticado puede operar cualquier `campaignId` (las rutas de campaña no filtran por `c.get("user")`). Probar cross-tenant requiere un segundo usuario e2e. Story pendiente.
- **Race en `upsertGeneratingAsset`** (`creative.ts`): find-then-insert sin unique en `(campaign_id, variant)` — dos POST concurrentes al agente pueden duplicar variantes. No se automatiza (ensucia data); arreglo: unique index + `onConflictDoUpdate`.
- **Rama "Commercial angle" del prompt**: inalcanzable vía API (solo el seed demo crea estrategia); gap de unit test.
- **Contenido del kit pineado al stub actual**: S3/S5/S6 asumen el brand kit determinístico (defaults como "Emerging business"). Cuando se mergee el Brand Agent con LLM (PR #11), revisar/aflojar esas aserciones de contenido de prompt.

## Limpieza de data de smoke

Vía Supabase MCP (`execute_sql`) o psql — orden respetando FKs (los deletes de `campaigns`/`brands` cascadean al resto, pero por claridad):

```sql
delete from campaigns using brands
  where campaigns.brand_id = brands.id and brands.name like 'SMOKE-%';
delete from brands where name like 'SMOKE-%';
```

(`brand_kits`, `creative_assets`, `campaign_strategies`, etc. caen por `on delete cascade`.)
