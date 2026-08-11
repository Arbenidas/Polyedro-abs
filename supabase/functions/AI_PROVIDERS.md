# Proveedores de IA

Las credenciales viven exclusivamente como secretos de Supabase. Angular nunca recibe una API key.

**Solo se usan DeepSeek y MiMo. No hay Alibaba ni generación de imágenes raster.** Todo el "arte" son assets vectoriales editables que los razonadores (DeepSeek/MiMo) componen usando los recursos existentes (stickers, plantillas, diagramas SVG) y generando nuevas especificaciones de formas SVG que el editor convierte en capas editables.

Las funciones aceptan la clave publicable en el header `apikey`. Cada handler valida la clave contra `SUPABASE_PUBLISHABLE_KEYS` antes de ejecutar el proveedor.

## DeepSeek: razonamiento de texto

Variables requeridas:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL=deepseek-v4-flash`

Funciones que lo usan:

- `generate-editorial-scene`: condensa el texto, genera hooks, arco narrativo, dirección visual y devuelve el plan JSON del carrusel.
- `generate-contextual-visual-spec`: decide si un slide necesita diagrama SVG editable o composición, devolviendo una especificación VisualIntent.
- `generate-editorial-asset`: razona la especificación de un asset VECTORIAL editable (formas SVG + stickers del catálogo + paleta). No genera imágenes.

## MiMo (visión y texto)

Variables requeridas:

- `MIMO_API_KEY`
- `MIMO_BASE_URL=https://api.xiaomimimo.com/v1` (OpenAI-compatible)
- `MIMO_VISION_MODEL=mimo-v2.5` (acepta imágenes)
- `MIMO_TEXT_MODEL=mimo-v2.5-pro` (texto puro)

`analyze-reference-image` recibe una imagen de REFERENCIA pegada en el editor + el borrador/tema. MiMo 2.5 la analiza (solo como inspiración) y devuelve un `VisualIntent` que Angular convierte en capas SVG editables, adaptado al tema. La imagen original nunca se inserta tal cual.

## Dirección de estilo anti-slop

`EDITORIAL_STYLE=neobrutal` (opcional). Fija la estética que respetan los razonadores al componer assets vectoriales y layouts. La librería está en `_shared/style-directions.ts` (12 estilos con dirección positiva + negativa + base anti-cliché).

## Configurar secretos

Desde un proyecto Supabase enlazado:

```bash
supabase secrets set DEEPSEEK_API_KEY=... DEEPSEEK_MODEL=deepseek-v4-flash
supabase secrets set MIMO_API_KEY=... MIMO_BASE_URL=https://api.xiaomimimo.com/v1 MIMO_VISION_MODEL=mimo-v2.5 MIMO_TEXT_MODEL=mimo-v2.5-pro
supabase secrets set EDITORIAL_STYLE=neobrutal
```

Para desarrollo local, copia `.env.example` a un archivo `.env.local` ignorado por Git y ejecuta las funciones con ese archivo.
