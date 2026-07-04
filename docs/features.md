# Features y user stories

Backlog del MVP de Polyedro /abs para la Buildathon. Cada feature tiene sus user stories, criterios de aceptación y estado actual. Complementa [`data-model.md`](./data-model.md) (esquema), [`database.md`](./database.md) (infra de datos) y [`api.md`](./api.md) (referencia de endpoints).

**Alcance acordado:**

- Backend real (Hono + Drizzle + Supabase) con generación por IA real.
- Integraciones: **ElevenLabs** (voz), **n8n** (automatización/export), **Meta Ads** (export real contra sandbox/test ad account) y **Flux vía Fal.ai o Replicate** (creativos e imágenes).
- Auth real con **Supabase Auth** (proyecto ya creado) — el login es parte de la demo.
- **Runtime de agentes (híbrido):** los agentes de texto (brand kit, estrategia, copies, guiones) corren en `apps/server` llamando directamente a una IA/LLM aún no decidida; ElevenLabs y Fal.ai se llaman también desde el server. n8n orquesta exclusivamente el pipeline de export a Meta Ads.
- **Progreso en vivo:** el server expone un stream **SSE** (Server-Sent Events) por campaña; el frontend consume eventos de agentes (inicio, logs, tokens, fin) para alimentar los logs de terminal y el pipeline de la UI. Fallback trivial a polling si algo se rompe en la demo.
- El frontend actual (`apps/web`) ya implementa todo el flujo de forma simulada; el trabajo es conectarlo al backend real.

**Leyenda de estado:** `✅ UI simulada` = pantalla y flujo existen en el frontend con datos falsos · `⬜ pendiente` = no existe aún · `🔌 por conectar` = existe la UI, falta backend/API real · `✔️ hecho` = implementado con backend real.

---

## F0 — Autenticación y workspace

Usuario autenticado con Supabase Auth; cada usuario ve solo sus marcas.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F0.1 | Como usuario, quiero iniciar sesión para acceder a mi workspace de marca. | P0 | ✔️ hecho — ver [`auth.md`](./auth.md) |
| F0.2 | Como usuario, quiero que mis marcas y campañas queden asociadas a mi cuenta para retomarlas después. | P0 | ⬜ pendiente |

**Criterios de aceptación**
- Login con Supabase Auth; sesión disponible en `apps/web` y validada en `apps/server`.
- Toda query filtra por el usuario autenticado (tabla `users` / `brands.userId`).

---

## F1 — Onboarding de marca

El usuario crea su marca (nombre, descripción, mercados objetivo) y se inicializa el workspace.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F1.1 | Como usuario, quiero registrar mi marca con nombre, descripción y mercados objetivo para inicializar mi workspace. | P0 | 🔌 por conectar |
| F1.2 | Como usuario, quiero ver el progreso de inicialización del workspace mientras los agentes trabajan. | P1 | ✅ UI simulada |

**Criterios de aceptación**
- `POST /brands` crea el registro en `brands` (status `draft`) y dispara la generación del brand kit.
- La pantalla de onboarding existente envía datos reales en lugar de solo cambiar de vista.

---

## F2 — Brand Kit (Brand Agent)

Generación de la identidad de marca: logo conceptual, paleta, tono de voz bilingüe, buyer persona, propuesta de valor, mensajes clave y estilo visual.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F2.1 | Como usuario, quiero que la IA genere el brand kit completo de mi marca a partir de mi descripción. | P0 | 🔌 por conectar |
| F2.2 | Como usuario, quiero ver el brand kit organizado en tarjetas (logo, paleta, tono, persona, propuesta, estilo) para revisarlo de un vistazo. | P0 | ✅ UI simulada |
| F2.3 | Como usuario, quiero ver el log del Brand Agent mientras genera, para entender qué está haciendo. | P2 | ✅ UI simulada |

**Criterios de aceptación**
- El Brand Agent escribe en `brand_kits` (relación 1:1 con `brands`) y transiciona `draft → generating → review`.
- Los campos jsonb (paleta, tono, persona, propuesta, mensajes, estilo visual) se llenan con contenido generado real y bilingüe (es/en).
- La vista Brand Kit lee de la API, no de constantes.

---

## F3 — Creación de campaña (brief)

El usuario describe el objetivo de la campaña y elige entregables; se crea el proyecto de campaña.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F3.1 | Como usuario, quiero describir el objetivo de mi campaña en texto libre para que los agentes trabajen sobre él. | P0 | 🔌 por conectar |
| F3.2 | Como usuario, quiero dictar el brief por voz en lugar de escribirlo. | P2 | ✅ UI simulada |
| F3.3 | Como usuario, quiero elegir qué entregables se generan (estrategia, copies, creativos, video, voz). | P1 | ✅ UI simulada |

**Criterios de aceptación**
- `POST /campaigns` crea el registro en `campaigns` (brandId, name, objective) y dispara el pipeline de agentes.

---

## F4 — Pipeline de agentes (generación)

Los agentes generan en secuencia: estrategia y segmentación, copies ES/EN con variantes A/B, creativos, guion de video.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F4.1 | Como usuario, quiero ver en tiempo real qué agente está corriendo, cuál terminó y cuál está en cola. | P0 | 🔌 por conectar |
| F4.2 | Como usuario, quiero una estrategia de campaña con audiencia, segmentación para Meta Ads y ángulo comercial. | P0 | 🔌 por conectar |
| F4.3 | Como usuario, quiero copies en español e inglés con variantes A/B (headline, primary text, CTA). | P0 | 🔌 por conectar |
| F4.4 | Como usuario, quiero creativos visuales 1080×1080 generados con IA (Flux vía Fal.ai/Replicate) para los anuncios. | P1 | 🔌 por conectar |
| F4.5 | Como usuario, quiero un guion de video corto por escenas. | P1 | 🔌 por conectar |

**Criterios de aceptación**
- Cada agente escribe en su tabla (`campaign_strategies`, `ad_copies`, `creative_assets`, `video_scripts`) con transición de estados `generating → review`.
- El server emite eventos SSE por campaña (`agent_started`, `agent_log`, `agent_completed`, `asset_updated`); el frontend los consume para reemplazar los timers simulados.

---

## F5 — Voiceovers (ElevenLabs) — integración real

Audio generado por ElevenLabs a partir del guion de video, en español e inglés.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F5.1 | Como usuario, quiero voiceovers reales en ES y EN generados desde el guion del video. | P0 | 🔌 por conectar |
| F5.2 | Como usuario, quiero reproducir los audios desde la vista de campaña para evaluarlos antes de aprobar. | P0 | ✅ UI simulada |

**Criterios de aceptación**
- El Voice Agent llama a la API de ElevenLabs y guarda `audioUrl`, `voiceId`, `settings` en `voiceovers`.
- El reproductor de la vista campaña reproduce el audio real.

---

## F6 — Revisión y aprobación (human-in-the-loop)

El usuario aprueba o regenera cada asset; la campaña avanza cuando todo está aprobado.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F6.1 | Como usuario, quiero aprobar cada asset individualmente para mantener control sobre lo que se publica. | P0 | 🔌 por conectar |
| F6.2 | Como usuario, quiero regenerar un asset que no me convence sin afectar el resto. | P0 | 🔌 por conectar |
| F6.3 | Como usuario, quiero ver el progreso de aprobación de la campaña (X de N assets aprobados). | P1 | ✅ UI simulada |
| F6.4 | Como usuario, quiero pedir cambios por comando de voz (ej. "haz el headline más urgente"). | P2 | ✅ UI simulada |

**Criterios de aceptación**
- Aprobar/regenerar actualiza `status` en la tabla del asset (`approved` / vuelta a `generating`).
- Al aprobar todos los assets, la campaña pasa a `ready_to_publish`.

---

## F7 — Export a Meta Ads vía n8n — integración real

Con todo aprobado, el usuario dispara el export; n8n construye el payload y crea la campaña en un sandbox/test ad account de Meta Ads.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F7.1 | Como usuario, quiero enviar la campaña aprobada a Meta Ads con un clic. | P0 | 🔌 por conectar |
| F7.2 | Como usuario, quiero ver el estado del export (pending, processing, sent, failed) y el error si falla. | P1 | ⬜ pendiente |
| F7.3 | Como usuario, quiero ver el pipeline de automatización (pasos de n8n) para entender qué pasa tras el clic. | P2 | ✅ UI simulada |

**Criterios de aceptación**
- "Push to Meta" llama a un webhook real de n8n y crea un registro en `automation_exports` con `metaAdsPayload`.
- n8n llama a la Marketing API de Meta contra un sandbox/test ad account y guarda `metaCampaignId`.
- n8n actualiza `exportStatus` (y `errorMessage` si falla).
- **Prerrequisito:** app de Meta + token del test ad account disponibles durante la buildathon.

---

## F8 — Vistas de librería

Vistas de consulta del workspace: Brand Kit, Agentes y Automatización.

| # | User story | Prioridad | Estado |
|---|---|---|---|
| F8.1 | Como usuario, quiero consultar mi brand kit en cualquier momento desde el sidebar. | P1 | 🔌 por conectar |
| F8.2 | Como usuario, quiero ver el roster de agentes y su rol. | P2 | ✅ UI simulada |
| F8.3 | Como usuario, quiero ver el estado del pipeline de automatización (n8n). | P2 | ✅ UI simulada |

---

## Prioridades para las 24h

**Camino crítico (P0):** F0 → F1 → F2 → F3.1 → F4.1–F4.3 → F5 → F6.1–F6.2 → F7.1

**Demo deseable (P1):** F4.4, F4.5, F6.3, F7.2, F8.1

**Solo si sobra tiempo (P2):** F2.3, F3.2, F6.4, F7.3, F8.2, F8.3 — todos ya lucen bien en la UI simulada, así que aportan a la demo aunque no se conecten.
