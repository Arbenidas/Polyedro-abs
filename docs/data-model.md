# Modelo de datos

Descripción del esquema Drizzle definido en [`apps/server/src/db/schema/index.ts`](../apps/server/src/db/schema/index.ts). Cubre el flujo MVP de Polyedro /abs: Marca → Brand Kit → Campaña → Assets generados por agentes → Aprobación → Export a Meta Ads vía n8n.

## Enums

### `asset_status`
Estado genérico del ciclo de vida de un asset generado (marca, brand kit, campaña, estrategia, copy, creativo, guion de video).

| Valor | Significado |
|---|---|a
| `draft` | Creado pero aún no generado por IA |
| `generating` | El agente está generándolo |
| `review` | Generado, pendiente de revisión humana |
| `approved` | Aprobado por el usuario |
| `ready_to_publish` | Aprobado y listo para exportar/publicar |
| `rejected` | Rechazado, requiere regenerar |

### `language`
Idioma de un asset bilingüe. Valores: `es`, `en`. Usado en `ad_copies`, `video_scripts`, `voiceovers`.

### `variant`
Variante A/B de un asset generado. Valores: `a`, `b`. Usado en `ad_copies` y `creative_assets`.

### `export_status`
Estado del envío de la campaña hacia Meta Ads vía n8n. Valores: `pending`, `processing`, `sent`, `failed`. Usado solo en `automation_exports`.

## Tablas

### `users`
Usuario dueño de las marcas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `default random()` |
| `email` | text | único, requerido |
| `name` | text | opcional |
| `createdAt` / `updatedAt` | timestamp | |

### `brands`
Una marca creada por el usuario (ej. "NovaGear Tech"). Contenedor de campañas y del brand kit.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → `users.id` | `onDelete: cascade`, indexado |
| `name` | text | requerido |
| `description` | text | opcional |
| `industry` | text | opcional |
| `status` | `asset_status` | default `draft` |
| `createdAt` / `updatedAt` | timestamp | |

### `brand_kits`
Identidad de marca generada por el **Brand Agent**. Relación 1:1 con `brands` (`brandId` único).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `brandId` | uuid FK → `brands.id`, único | `onDelete: cascade` |
| `status` | `asset_status` | default `draft` |
| `logoUrl` | text | URL del logo generado |
| `logoPrompt` | text | prompt usado para generarlo |
| `colorPalette` | jsonb | `{ primary, secondary, accent, neutrals? }` |
| `toneOfVoice` | jsonb | bilingüe `{ es, en }` |
| `buyerPersona` | jsonb | `{ name, age?, occupation?, goals?, painPoints?, notes? }` |
| `valueProposition` | jsonb | bilingüe `{ es, en }` |
| `keyMessages` | jsonb | bilingüe, cada idioma es un array de strings |
| `visualStyle` | jsonb | `{ mood?, imageryStyle?, typography?, references? }` |
| `createdAt` / `updatedAt` | timestamp | |

### `campaigns`
Proyecto de campaña dentro de una marca (ej. "Sell more smart gadgets in Latin America").

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `brandId` | uuid FK → `brands.id` | `onDelete: cascade`, indexado |
| `name` | text | requerido |
| `objective` | text | requerido |
| `status` | `asset_status` | default `draft` |
| `createdAt` / `updatedAt` | timestamp | |

### `campaign_strategies`
Estrategia generada por el **Strategy Agent**. Relación 1:1 con `campaigns` (`campaignId` único). Se modela aparte de `campaigns` porque tiene su propio ciclo de generar/aprobar/regenerar, independiente del estado general de la campaña.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `campaignId` | uuid FK → `campaigns.id`, único | `onDelete: cascade` |
| `status` | `asset_status` | default `draft` |
| `audience` | jsonb | `{ description, ageRange?, locations?, interests? }` |
| `segmentation` | jsonb | targeting para Meta Ads: `{ ageMin?, ageMax?, genders?, locations?, interests?, placements? }` |
| `commercialAngle` | text | ángulo comercial de la campaña |
| `notes` | text | opcional |
| `createdAt` / `updatedAt` | timestamp | |

### `ad_copies`
Copies de campaña generados por el **Meta Ads Agent**, en español e inglés, con variantes A/B. Una campaña tiene muchos `ad_copies`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `campaignId` | uuid FK → `campaigns.id` | `onDelete: cascade`, indexado |
| `language` | `language` | requerido |
| `variant` | `variant` | default `a` |
| `status` | `asset_status` | default `draft` |
| `headline` | text | opcional |
| `primaryText` | text | opcional |
| `description` | text | opcional |
| `callToAction` | text | opcional |
| `createdAt` / `updatedAt` | timestamp | |

### `creative_assets`
Imágenes/creativos generados por el **Creative Agent**, con variantes A/B. Una campaña tiene muchos `creative_assets`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `campaignId` | uuid FK → `campaigns.id` | `onDelete: cascade`, indexado |
| `variant` | `variant` | default `a` |
| `status` | `asset_status` | default `draft` |
| `imageUrl` | text | opcional |
| `prompt` | text | prompt usado para generar la imagen |
| `altText` | text | opcional |
| `metadata` | jsonb | payload libre del proveedor de generación |
| `createdAt` / `updatedAt` | timestamp | |

### `video_scripts`
Guion de video corto generado por el **Video Agent**. Una campaña tiene muchos `video_scripts`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `campaignId` | uuid FK → `campaigns.id` | `onDelete: cascade`, indexado |
| `status` | `asset_status` | default `draft` |
| `language` | `language` | default `es` |
| `title` | text | opcional |
| `scenes` | jsonb | array de `{ sceneNumber, description, dialogue?, durationSeconds? }` |
| `durationSeconds` | integer | opcional |
| `createdAt` / `updatedAt` | timestamp | |

### `voiceovers`
Audio generado por el **Voice Agent** (ElevenLabs) a partir de un guion de video. Relación 1:muchos con `video_scripts`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `videoScriptId` | uuid FK → `video_scripts.id` | `onDelete: cascade`, indexado |
| `status` | `asset_status` | default `draft` |
| `language` | `language` | requerido |
| `voiceId` | text | id de voz de ElevenLabs, requerido |
| `audioUrl` | text | opcional |
| `durationSeconds` | integer | opcional |
| `settings` | jsonb | parámetros de generación (estabilidad, estilo, etc.) |
| `createdAt` / `updatedAt` | timestamp | |

### `automation_exports`
Registro de envío/publicación de la campaña hacia Meta Ads a través del **Automation Agent** (n8n). Una campaña tiene muchos `automation_exports` (uno por intento de export).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `campaignId` | uuid FK → `campaigns.id` | `onDelete: cascade`, indexado |
| `exportStatus` | `export_status` | default `pending` |
| `n8nWorkflowId` | text | opcional |
| `n8nExecutionId` | text | opcional |
| `metaAdsPayload` | jsonb | payload enviado/recibido de Meta Ads |
| `metaCampaignId` | text | id de campaña ya creada en Meta Ads |
| `errorMessage` | text | detalle si `exportStatus = failed` |
| `requestedAt` | timestamp | cuándo se disparó el export |
| `completedAt` | timestamp | opcional, cuándo terminó |
| `createdAt` / `updatedAt` | timestamp | |

## Relations (Drizzle relational query API)

Habilitan consultas como `db.query.brands.findMany({ with: { brandKit: true, campaigns: true } })`.

| Tabla | Relaciones |
|---|---|
| `users` | `brands`: many |
| `brands` | `user`: one (`users`) · `brandKit`: one (`brand_kits`) · `campaigns`: many |
| `brand_kits` | `brand`: one (`brands`) |
| `campaigns` | `brand`: one (`brands`) · `strategy`: one (`campaign_strategies`) · `adCopies`: many · `creativeAssets`: many · `videoScripts`: many · `automationExports`: many |
| `campaign_strategies` | `campaign`: one (`campaigns`) |
| `ad_copies` | `campaign`: one (`campaigns`) |
| `creative_assets` | `campaign`: one (`campaigns`) |
| `video_scripts` | `campaign`: one (`campaigns`) · `voiceovers`: many |
| `voiceovers` | `videoScript`: one (`video_scripts`) |
| `automation_exports` | `campaign`: one (`campaigns`) |

## Diagrama de relaciones (alto nivel)

```
users
  └─ brands (1:N)
       ├─ brand_kits (1:1)
       └─ campaigns (1:N)
            ├─ campaign_strategies (1:1)
            ├─ ad_copies (1:N)
            ├─ creative_assets (1:N)
            ├─ video_scripts (1:N)
            │    └─ voiceovers (1:N)
            └─ automation_exports (1:N)
```
