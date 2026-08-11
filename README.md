# Polyedro — Editor de contenido para arbe.blog

> **De una idea a un post publicado en redes.** Polyedro investiga el tema en la web, redacta un artículo largo, lo revisás, genera las propuestas visuales (carrusel/single), las editás y al final te da el copy para Instagram/LinkedIn/TikTok y el borrador del artículo. Todo con voz de marca: **técnico con humor seco**.

Polyedro es el motor de contenido de **arbe.blog**: una bitácora de tecnología en vivo con 4 pilares editoriales (noticias, problemas resueltos, rankings y notas de campo). El proyecto convierte cada idea en un flujo completo de creación — con revisión humana en el medio, nunca IA autónoma sin control.

También incluye un **estudio de guiones cortos** para Reels y TikTok: parte de un tema manual o de noticias verificables de las últimas 24 horas / 7 días y entrega hook, beats por segundo, voz, texto en pantalla, indicaciones visuales, cortes, caption y fuentes. La rúbrica de retención es una evaluación editorial, no una promesa de viralidad.

---

## El flujo de creación (5 fases)

```
┌─────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌──────────────────┐
│ FASE 0  │ → │ FASE 1           │ → │ FASE 2           │ → │ FASE 3       │ → │ FASE 4           │
│ Input   │   │ Investiga+Redacta│   │ Revisión humana  │   │ Propuestas   │   │ Publicación      │
└─────────┘   └──────────────────┘   └──────────────────┘   └──────────────┘   └──────────────────┘
 idea/texto    Tavily web search    artículo editable       plan editorial     copy corto/largo
               + DeepSeek redacta  + fuentes + takeaways    → 19 plantillas    + borrador artículo
```

### Fase 0 — Input (composer)

El usuario elige cómo empezar:

- **"Tengo la idea"**: escribe un tema corto (ej. *"Claude Opus 4, una semana de pruebas"*). La IA investiga y desarrolla.
- **"Tengo el texto"**: pega un texto completo. Opción **"usar tal cual"** (no se reescribe) o dejarlo para que la IA lo reorganice y pula.

También define: categoría editorial (opcional, auto-detectada), canal (Instagram 4:5, 1:1, LinkedIn, TikTok), formato (auto/single/carrusel), número de cards, intención (enseñar / ser guardado / conversación / mover a la acción) y audiencia.

### Fase 1 — Investigación + redacción (server)

Dos endpoints:

| Endpoint | Qué hace |
|---|---|
| `POST /public/topic/research` | Si es una idea: busca en la web con **Tavily** (6 fuentes reales), y **DeepSeek** redacta un **post largo de blog (500-900 palabras)** con estructura editorial: TL;DR, problema real, headers descriptivos, errores comunes, conclusión con siguiente paso. |
| `POST /public/topic/rewrite` | Si es texto pegado: lo reestructura como post de blog (o lo deja tal cual con `keepAsIs`). |

El resultado es un **TopicDraft**: título, cuerpo en markdown, fuentes con links, key takeaways.

### Fase 2 — Revisión humana (pantalla de revisión)

- El post largo es **editable** (título, body, takeaways).
- Se ven las **fuentes de investigación** con links.
- **"Aprobar y generar propuestas"** → pasa a la Fase 3.

*Este es el punto de control: nada se publica sin que el humano lo revise.*

### Fase 3 — Propuestas editoriales (plan + escenas)

El post aprobado alimenta el **EditorialPlan**: DeepSeek lo **destila en una publicación** (no lo resume):

- **Copys de alto impacto**: cada headline ancla un dato concreto del texto ("Un error de 200KB sin logging tarda 3 días en encontrarse"), con variedad sintáctica y cero frases genéricas.
- **3 hooks** (resultado / contraste / curiosidad) y un CTA modulado por intención.
- **19 plantillas visuales** en 4 familias: Editorial/Magazine, Bold/Statement, Data/Demo y las 8 clásicas. Se asignan automáticamente según el arco narrativo (how-to, listicle, case-study, myth-bust, comparison, release-log).

Cada slide se compila en una **escena editable** (Fabric.js) y se guarda localmente (IndexedDB).

### Fase 4 — Editor y publicación

**Editor tipo Canva** (motor Fabric.js):
- Panel izquierdo: Diseño (plantillas + paletas), Collage (stickers/cutouts), Capas.
- Canvas central con zoom, historia undo/redo.
- Panel derecho contextual: tipografía, marcos de imagen, looks (11 presets), ajustes finos.
- **↻ Regenerar contenido**: reescribe el copy del slide con IA.
- **▶ Video → GIF**: importa un video y lo convierte a GIF animado para insertarlo en la lámina.
- Subir imágenes, fondos, stickers con recorte automático (ONNX), SVG editable.

**Pantalla Publicar** (`/publish`):
- Resumen: categoría, goal, hook activo.
- **Storyboard visual** de todas las láminas.
- **Copy por lámina** con botón copiar individual.
- **Copy para redes**: toggle **corto** (caption 2-4 líneas) / **largo** (post completo tipo LinkedIn con secciones 1️⃣/2️⃣, regla de oro 💡 y pregunta de engagement 📌) — generado con IA, editable, con contador de caracteres y copiar.
- **Borrador del artículo**: el post largo aprobado en la Fase 2, listo para copiar como markdown para el blog.
- Descarga ZIP de los PNGs en orden.

---

## Arquitectura

```
├── apps/
│   ├── web/          # Frontend Angular 20 + Fabric.js + IndexedDB (local-first)
│   └── server/       # Backend Hono + DeepSeek + Tavily + MiMo
├── packages/
│   ├── env/          # Validación de variables de entorno (zod)
│   └── config/       # tsconfig base del workspace
└── supabase/         # Edge functions (estilo visual, generación de escenas)
```

### Agentes / servicios (server)

| Servicio | Archivo | Rol |
|---|---|---|
| **Tavily Search** | `topic-research.ts` | Búsqueda web real para noticias actuales y contexto fresco |
| **DeepSeek** | `deepseek.ts` | Motor de texto principal: redacción de artículos, planes editoriales, copys, regeneración de slides |
| **MiMo** | `mimo.ts` | Modelo secundario (visión + texto), OpenAI-compatible |
| **Editorial Agent** | `editorial.ts` | Convierte el post aprobado en un plan editorial (hooks, slides, copys, arco narrativo) |
| **Copy Agent** | `copy-generator.ts` | Genera copy corto/largo para redes sociales |
| **Slide Regenerator** | `slide-regenerate.ts` | Reescribe el copy de una lámina específica |
| **Koboyo** | `koboyo.ts` | Iconos hand-drawn para las slides (vía MCP) |

### Endpoints públicos

| Ruta | Qué hace |
|---|---|
| `POST /public/editorial/plan` | Genera el plan editorial (slides + hooks + caption) |
| `POST /public/topic/research` | Investiga en web + redacta el post largo |
| `POST /public/topic/rewrite` | Reorganiza/limpia texto pegado |
| `POST /public/slide/regenerate` | Reescribe el copy de una lámina |
| `POST /public/copy/generate` | Genera copy corto/largo para redes |
| `POST /public/koboyo/*` | Búsqueda y SVG de iconos hand-drawn |
| `POST /public/short-video/trends` | Descubre temas actuales con Tavily y conserva sus fuentes |
| `POST /public/short-video/script` | Genera un guion filmable de 15, 30, 45 o 60 segundos |

### Rutas del frontend

| Ruta | Pantalla |
|---|---|
| `/brands/:id` | Dashboard de proyectos |
| `/brands/:id/content/new` | Composer (Fase 0) |
| `/brands/:id/short-video/new` | Guiones para Reels/TikTok por tema o tendencias |
| `/brands/:id/topic/:draftId/review` | Revisión del artículo (Fase 2) |
| `/brands/:id/content/:postId/edit` | Editor de slides (Fase 3-4) |
| `/brands/:id/content/:postId/publish` | Publicación + copys (Fase 4) |

---

## El brief de arbe.blog

```ts
{
  name: "arbe.blog",
  description: "Bitácora de tecnología en vivo. Lo que pasó esta semana, el
                problema que acabo de resolver y el ranking que te ahorra
                probar cinco cosas. Técnico con punchline — aprendé algo útil
                y salí con una sonrisa seca.",
  voice: { tone: "Técnico con humor seco. Serio con la evidencia, irónico con
           el hype.", register: "casual", humorStyle: "Ironía y observación,
           no chiste plano. El punchline llega al cerrar." },
  pillars: ["news", "problem-solved", "ranking", "field-notes"],
  antiPatterns: ["growth-hacking slop", "clickbait", "guías definitivas",
                 "vender humo", "motivación genérica"],
  references: ["Lenny Rachitsky", "The Pragmatic Engineer", "Big Technology"]
}
```

Este brief alimenta el **system prompt** de todos los agentes de texto: la voz, los pilares (que guían el arco narrativo) y los anti-patrones (lista negra de lo que la marca nunca hace).

---

## Ejemplo real de principio a fin

**Idea**: *"Claude Opus 4 — lo probé una semana"* (categoría: field-notes, intención: enseñar)

### 1. Investigación (Tavily)
6 fuentes reales encontradas: *"No hype Claude Opus 4.8 review — my real experience"*, *"Claude Opus 4.7 Review: Smarter, More Literal"*, etc.

### 2. Artículo generado (DeepSeek)
```markdown
> TL;DR: Opus 4 acelera el prototipado, pero sin manejo de errores
> y trazabilidad el código se vuelve inoperable en producción.

## El problema real
Cada release genera una ola de hype. Pero los developers no vivimos
de benchmarks: vivimos de integrar APIs, leer código ajeno y debuggear
a las 2 AM.

## Lo que encontré al probarlo
- El código vibe-coded carece de manejo de errores y trazabilidad.
- Un error de 200KB en memoria sin logging tarda 3 días en encontrarse.

## Decisiones que tomé
... (567 palabras en total, con 3 key takeaways)
```

### 3. Revisión humana
El usuario edita el artículo, revisa las fuentes y **aprueba**.

### 4. Propuestas editoriales (19 plantillas disponibles)
```
[cover]      Vibe coding: la velocidad es real, la producción no perdona
[comparison] El 70% de los fallos de agentes no son del modelo — son de gestión
[step]       Un error de 200KB sin logging tarda 3 días en encontrarse
[cta]        Guarda este mapa antes de tu próximo agente
```

### 5. Copy para redes (modo largo)
> Elegir entre Cloud Functions y Cloud Run no debería ser una guerra de trincheras...
> 1️⃣ Cloud Functions (Simplicidad pura) — Uso ideal / Ventajas / Costo
> 2️⃣ Cloud Run (Control total con contenedores)
> 💡 Regla de oro: empieza simple, migra cuando duela
> 📌 ¿Has tenido que migrar? Cuéntamelo en los comentarios. 👇

---

## Requisitos y setup

```bash
pnpm install
pnpm run dev          # web (localhost:3001) + server (localhost:3000)
```

Variables de entorno en `apps/server/.env` (ver `.env.example`):

| Variable | Requerida | Nota |
|---|---|---|
| `DEEPSEEK_API_KEY` | Sí (texto) | Motor principal de texto |
| `TAVILY_API_KEY` | Sí (investigación) | Búsqueda web para noticias |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Sí | Auth/edge functions |
| `DATABASE_URL` | Sí | Postgres (Drizzle) |
| `MIMO_API_KEY` | Opcional | Modelo secundario |
| `KOBOYO_MCP_URL` | Opcional | Iconos hand-drawn |
| `ELEVENLABS_API_KEY` | Opcional | Voiceovers (demo) |

> **Nota**: los datos de las escenas y proyectos se guardan en **IndexedDB** (local-first). No se requiere DB para el flujo principal de creación.

### Comandos útiles

```bash
pnpm run check-types   # TypeScript en todo el monorepo
pnpm run test          # Vitest (web + server)
pnpm run dev:web       # Solo frontend
pnpm run dev:server    # Solo backend
```

---

## Cómo se construyó (para feedback)

- **Frontend**: Angular 20 standalone + signals, Fabric.js para el canvas, Dexie (IndexedDB), gifenc (GIF), ONNX (background removal), pdf-lib (PDF).
- **Backend**: Hono, zod, DeepSeek (OpenAI-compatible) para todo el texto, Tavily para búsqueda web, MiMo como secundario.
- **Patrón clave**: **human-in-the-loop** — la IA nunca publica: investiga → redacta → el humano revisa y aprueba → recién ahí se generan las propuestas.
- **Fallas y fallbacks**: si DeepSeek no está configurado, el sistema cae al planner local determinístico (sin IA) con aviso visible. Si Tavily falla, redacta sin fuentes. Nada rompe la UX.
