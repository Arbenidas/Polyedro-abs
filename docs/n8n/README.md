# n8n — Campaign Export workflow

Workflow **"Polyedro /abs — Campaign Export"** (`jFDaLIM6iW32SykP`) en `https://ferodrigop.app.n8n.cloud`. Es el paso de automatización (Automation Agent) que recibe una campaña aprobada y arma su estructura para Meta Ads.

El JSON versionado está en [`campaign-export.workflow.json`](./campaign-export.workflow.json) (importable en n8n: Workflows → Import from File).

## Contrato

`apps/server` dispara el webhook en `exportCampaignToMetaAds` (ver [`services/n8n.ts`](../../apps/server/src/api/services/n8n.ts)):

- **Webhook**: `POST https://ferodrigop.app.n8n.cloud/webhook/polyedro/export`
- **Body**: `{ brandId, campaignId, target: "meta_ads", payload }` — `payload` es el `metaAdsPayload` que el server ensambla (`campaign`, `brand`, `strategy`, `adCopies`, `creativeAssets`, `videoScripts`, `voiceovers`). Viaja en el body porque n8n **no** puede leer Supabase directo (RLS sin policies).
- **Respuesta**: `{ status: "built", brandId, campaignId, target, receivedAt, executionId, metaAds }`.

## Nodos

`Export Webhook` → `Normalize Export Payload` (Set) → `Build Meta Ads Structure` (Code) → `Respond Received`.

El nodo **Build Meta Ads Structure** transforma el payload en la estructura de Meta Ads:
- **campaign**: `objective` mapeado desde el objetivo en texto libre (`OUTCOME_SALES`/`OUTCOME_TRAFFIC`/…), `status: PAUSED`, `special_ad_categories: []`.
- **adSet**: `targeting` desde `strategy.segmentation` (edad, `geo_locations.countries` mapeando nombres LATAM → ISO, fallback a `MX/CO/CL/PE/AR`), `optimization_goal`, `billing_event`, `daily_budget`.
- **ads**: uno por `adCopy` (es/en × A/B), emparejado con el `creativeAsset` de su variante → `object_story_spec.link_data` (`message`/`name`/`description`/`call_to_action`/`picture` = URL del creativo en Supabase Storage). Todo `PAUSED`.

## Fase 2 — publicar real contra Meta Sandbox (pendiente)

Hoy el workflow **arma y devuelve** la estructura (Fase 1: transform-only, sin credenciales). Para publicar de verdad:

1. Crear app de Meta en **Development Mode** + **Sandbox Ad Account** (no entrega anuncios, no gasta, no requiere fondeo — ideal para demo) + **Page ID** + **System User access token**.
2. Agregar nodos HTTP Request tras el Code, en orden (`publishOrder`), contra `https://graph.facebook.com/v25.0`:
   - `POST /act_<AD_ACCOUNT_ID>/campaigns` → `campaign_id`
   - `POST /act_<AD_ACCOUNT_ID>/adsets` (con `campaign_id`) → `adset_id`
   - `POST /act_<AD_ACCOUNT_ID>/adcreatives` (inyectar `page_id` en `object_story_spec`) → `creative_id`
   - `POST /act_<AD_ACCOUNT_ID>/ads` (con `adset_id` + `creative: { creative_id }`) → `ad_id`
3. Guardar los IDs de Meta devueltos (el server ya persiste `metaCampaignId` en `automation_exports`).

El token de Meta se guarda como credencial de n8n (o System User token), nunca en el repo.
