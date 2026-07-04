# API

Referencia de los endpoints HTTP expuestos por `apps/server` (Hono). Todas las rutas cuelgan del prefijo `/api` (ver [`apps/server/src/index.ts`](../apps/server/src/index.ts)). Complementa [`data-model.md`](./data-model.md) (esquema de las tablas referidas aquí) y [`features.md`](./features.md) (estado de conexión frontend↔backend de cada endpoint).

**Organización del código:** cada recurso tiene un archivo de rutas (`apps/server/src/api/routes/*.ts`, validación con Zod + llamada al servicio) y un archivo de servicio (`apps/server/src/api/services/*.ts`, lógica de negocio y acceso a datos vía Drizzle). Utilidades compartidas (`ApiError`, `requireOne`, `parseUuidParam`, `parseBody`) viven en [`apps/server/src/api/shared.ts`](../apps/server/src/api/shared.ts).

## Convenciones

- Todos los bodies son JSON; todas las respuestas son JSON.
- Los ids de recurso (`campaignId`, `brandId`, etc.) son UUID v4; un id inválido responde `400`.
- No hay autenticación real todavía (ver F0 en `features.md`). Si un endpoint acepta `userId` y no se envía, el server usa/crea un usuario demo (`demo@polyedro.abs`).

### Formato de error

Cualquier `ApiError` lanzado en un servicio es capturado por el `onError` global y responde:

```json
{
  "error": {
    "message": "string",
    "details": "unknown (opcional, p. ej. el .flatten() de un error de Zod)"
  }
}
```

| Status | Cuándo |
|---|---|
| `400` | Body inválido (falla de validación Zod) o param de ruta que no es un UUID válido |
| `404` | El recurso (brand, campaign, o el asset referenciado por `target`/`id`) no existe |
| `409` | Conflicto de estado (ej. exportar una campaña que no está lista) |
| `500` | Error inesperado (no capturado como `ApiError`) |

---

## Brands

Archivo de rutas: [`apps/server/src/api/routes/brand.ts`](../apps/server/src/api/routes/brand.ts) · servicio: [`apps/server/src/api/services/brand.ts`](../apps/server/src/api/services/brand.ts).

### `POST /api/brands`

Crea la marca en estado `draft` y dispara sincrónicamente la generación del brand kit (hoy un stub determinístico; ver F2 en `features.md` para la versión con LLM real).

**Body** (`brandInputSchema`, acepta alias para compatibilidad con el formulario de onboarding existente):

| Campo | Tipo | Requerido | Notas |
|---|---|---|---|
| `name` / `brandName` | string | sí (uno de los dos) | nombre de la marca |
| `description` / `whatDoYouSell` | string | no | uno de los dos, si se envía |
| `industry` | string | no | |
| `markets` | `string[]` **o** `Record<string, boolean>` | no | si es un record (ej. `{ "MX": true, "CO": false }`), se filtra a solo las claves en `true` |
| `userId` | uuid | no | si se omite, se usa/crea el usuario demo |

**Respuesta `201`**:

```json
{
  "brand": { "id": "uuid", "userId": "uuid", "name": "string", "description": "string|null", "industry": "string|null", "status": "draft", "createdAt": "...", "updatedAt": "..." },
  "brandKit": { "id": "uuid", "brandId": "uuid", "status": "review", "logoUrl": "string", "logoPrompt": "string", "colorPalette": {...}, "toneOfVoice": {...}, "buyerPersona": {...}, "valueProposition": {...}, "keyMessages": {...}, "visualStyle": {...}, "createdAt": "...", "updatedAt": "..." },
  "generation": {
    "triggered": true,
    "agent": "Brand Agent",
    "status": "review",
    "steps": ["brand.created:draft", "brand_kit.created:generating", "brand_kit.completed:review"]
  }
}
```

Ver la forma exacta de las columnas jsonb de `brandKit` (`colorPalette`, `toneOfVoice`, etc.) en la sección `brand_kits` de [`data-model.md`](./data-model.md).

**Errores**: `400` si falta `name`/`brandName`; `404` si se envía `userId` y no existe ese usuario.

---

## Campaigns

Archivo de rutas: [`apps/server/src/api/routes/campaign.ts`](../apps/server/src/api/routes/campaign.ts) · servicio: [`apps/server/src/api/services/campaign.ts`](../apps/server/src/api/services/campaign.ts).

### `POST /api/demo/seed`

Sin body. Crea (o actualiza, es idempotente) un set completo de datos demo: usuario, marca "NovaGear Tech", brand kit, campaña, estrategia, copies, creativos, guion de video, voiceover y un export pendiente.

**Respuesta `201`**: `{ user, brand, brandKit, campaign, strategy, copies, assets, script, voiceover, dashboard }` — `dashboard` tiene la misma forma que `GET /campaigns/:campaignId/dashboard` (ver abajo).

### `GET /api/campaigns`

Lista todas las campañas con un resumen liviano (no el dashboard completo).

**Respuesta `200`**:
```json
{
  "campaigns": [
    {
      "id": "uuid", "name": "string", "objective": "string", "status": "draft|generating|review|approved|ready_to_publish|rejected",
      "brand": { "id": "uuid", "name": "string", "industry": "string|null" },
      "assetCounts": { "adCopies": 0, "creativeAssets": 0, "videoScripts": 0, "voiceovers": 0 },
      "latestExport": { "...": "fila de automation_exports, o null" },
      "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

### `GET /api/campaigns/:campaignId/dashboard`

Devuelve el estado completo de una campaña: datos de campaña + marca + brand kit + progreso de aprobación + todos los assets generados por los agentes.

**Respuesta `200`**:
```json
{
  "campaign": { "id": "uuid", "name": "string", "objective": "string", "status": "...", "createdAt": "...", "updatedAt": "..." },
  "brand": { "id": "uuid", "name": "string", "description": "string|null", "industry": "string|null", "status": "..." },
  "brandKit": { "...": "fila de brand_kits, o null" },
  "progress": {
    "approved": 0, "total": 6, "readyToPublish": false,
    "pending": ["Brand Kit", "Strategy Agent", "..."],
    "blocks": [{ "key": "brand_kit", "label": "Brand Kit", "approved": false, "missing": true }]
  },
  "agents": {
    "strategy": { "...": "fila de campaign_strategies, o null" },
    "adCopies": [{ "...": "filas de ad_copies" }],
    "visualAssets": [{ "...": "filas de creative_assets" }],
    "videoScripts": [{ "...": "filas de video_scripts" }],
    "voiceovers": [{ "...": "filas de voiceovers, con videoScriptId y videoScriptTitle agregados" }]
  },
  "latestExport": { "...": "fila de automation_exports, o null" }
}
```

`progress.blocks` tiene un bloque por cada uno de los 6 tipos de asset (`brand_kit`, `strategy`, `ad_copy`, `creative_asset`, `video_script`, `voiceover`); un bloque de colección (`ad_copy`, `creative_asset`, `video_script`, `voiceover`) está `approved: true` solo si tiene al menos un item y todos están `approved`/`ready_to_publish`.

**Errores**: `404` si `campaignId` no existe.

### `POST /api/campaigns`

Crea una campaña en estado `draft` para una marca existente.

**Body** (`campaignInputSchema`): `{ "brandId": "uuid", "name": "string", "objective": "string" }`

**Respuesta `201`**: `{ "campaign": { "id", "brandId", "name", "objective", "status": "draft", "createdAt", "updatedAt" } }`

**Errores**: `400` si falta algún campo; `404` si `brandId` no existe.

### `POST /api/campaigns/:campaignId/approve`

Aprueba un asset puntual de la campaña. Si al aprobar quedan todos los bloques de progreso aprobados, la campaña pasa a `ready_to_publish` (si no, a `review`).

**Body** (`assetActionSchema`): `{ "target": "strategy"|"ad_copy"|"creative_asset"|"video_script"|"voiceover", "id": "uuid" }` — `id` es el id de la fila específica (estrategia, copy, creativo, guion o voiceover), no el de la campaña.

**Respuesta `200`**: el dashboard actualizado (misma forma que `GET /campaigns/:campaignId/dashboard`).

**Errores**: `404` si la campaña no existe o si el asset referenciado por `target`/`id` no pertenece a esa campaña.

### `POST /api/campaigns/:campaignId/regenerate`

Regenera un asset puntual (hoy con contenido demo fijo por `target`, no una llamada real a IA; ver F4 en `features.md`). Deja ese asset en `review` y la campaña en `review`.

**Body**: igual que `approve` (`assetActionSchema`).

**Respuesta `200`**: el dashboard actualizado.

**Errores**: igual que `approve`.

### `POST /api/campaigns/:campaignId/meta-ads/export`

Exporta la campaña a Meta Ads (hoy simulado: crea el registro de export con `exportStatus: "sent"` directamente, sin llamar a n8n; ver F7 en `features.md`). Requiere que la campaña esté `readyToPublish` (todos los bloques de progreso aprobados).

**Respuesta `201`**: `{ "export": { "...": "fila de automation_exports creada" }, "dashboard": { "...": "dashboard actualizado" } }`

**Errores**: `404` si la campaña no existe; `409` (`"Campaign is not ready to publish"`, con `details.pending` = lista de bloques faltantes) si aún no está lista.
