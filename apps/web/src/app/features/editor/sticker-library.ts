// Librería de stickers SVG para las plantillas editoriales. Stickers estilo
// "papelería digital" (floppy, folder, bookmark, spark, etc.) que dan el tono
// editorial-playful de los diseños de referencia, sin depender de imágenes IA
// (cero AI slop). Cada sticker usa la paleta de marca vía tokens — igual que
// las decoraciones geométricas — para que queden coherentes con el brand kit.
//
// Uso: en template-catalog.ts, un sticker se referencia como
// { type: "svg", frame: F(...), token: "transparent", svg: STICKER_FLOPPY, rotation, opacity }.

import type { RecipeDecoration } from "./editor.models";

type StickerToken = "brand" | "accent" | "paper" | "ink" | "marker";

/** Genera un sticker SVG con los colores de la marca inyectados. `main` es el
 *  cuerpo del sticker, `highlight` el detalle/acento, `outline` el trazo. */
function sticker(
  viewBox: string,
  paths: string,
  main: StickerToken,
  highlight: StickerToken,
  outline: StickerToken,
  strokeWidth = 3,
): string {
  const palette = { brand: "#D94E1E", accent: "#008F99", paper: "#F4F4F5", ink: "#18181B", marker: "#F4BE2A" };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths
    .replaceAll("{{main}}", palette[main])
    .replaceAll("{{highlight}}", palette[highlight])
    .replaceAll("{{outline}}", palette[outline])
    .replaceAll("{{sw}}", String(strokeWidth))}</svg>`;
}

/** Floppy disk — el clásico "guardar". */
export const STICKER_FLOPPY = sticker(
  "0 0 200 200",
  `<rect x="28" y="20" width="144" height="160" rx="10" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <rect x="56" y="20" width="88" height="58" fill="{{paper}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M96 78v30M81 108h30" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linecap="round"/>
   <rect x="44" y="118" width="112" height="52" rx="8" fill="{{highlight}}" stroke="{{outline}}" stroke-width="{{sw}}"/>`,
  "brand", "accent", "ink",
);

/** Carpeta con pestaña — recursos/colecciones. */
export const STICKER_FOLDER = sticker(
  "0 0 200 200",
  `<path d="M18 40h52l20 22h92v96a10 10 0 0 1-10 10H38a20 20 0 0 1-20-20Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M18 62h164" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <circle cx="150" cy="46" r="6" fill="{{highlight}}" stroke="{{outline}}" stroke-width="3"/>`,
  "accent", "brand", "ink",
);

/** Bookmark / banderín — "guárdalo". */
export const STICKER_BOOKMARK = sticker(
  "0 0 200 200",
  `<path d="M60 24h80v152l-40-30-40 30Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M74 62h52" stroke="{{paper}}" stroke-width="10" stroke-linecap="round"/>
   <path d="M74 92h52" stroke="{{paper}}" stroke-width="10" stroke-linecap="round"/>`,
  "brand", "paper", "ink",
);

/** Estrella / spark — "guárdalo para después". */
export const STICKER_STAR = sticker(
  "0 0 200 200",
  `<path d="M100 18l22 54 58 6-44 38 14 57-50-30-50 30 14-57L20 78l58-6Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linejoin="round"/>`,
  "marker", "brand", "ink",
);

/** Lápiz — "anota / edita". */
export const STICKER_PENCIL = sticker(
  "0 0 200 200",
  `<path d="M150 26 44 132l-12 38 38-12L176 52Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linejoin="round"/>
   <path d="M120 54l26 26" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linecap="round"/>`,
  "accent", "brand", "ink",
);

/** Cursor — "hazlo tú". */
export const STICKER_CURSOR = sticker(
  "0 0 200 200",
  `<path d="M42 28 160 96l-52 12 28 52-38 20-40-80Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linejoin="round"/>
   <circle cx="150" cy="42" r="14" fill="{{highlight}}" stroke="{{outline}}" stroke-width="4"/>`,
  "brand", "accent", "ink",
);

/** Cohete — "lanzamiento / release". */
export const STICKER_ROCKET = sticker(
  "0 0 200 200",
  `<path d="M100 18c26 0 44 22 44 60 0 18-10 38-20 56H76c-10-18-20-38-20-56 0-38 18-60 44-60Z" fill="{{paper}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M76 132h48l10 44-34-14-34 14Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linejoin="round"/>
   <circle cx="100" cy="62" r="14" fill="{{highlight}}" stroke="{{outline}}" stroke-width="4"/>
   <path d="M100 118v18M84 150l6 18M116 150l-6 18" stroke="{{highlight}}" stroke-width="{{sw}}" stroke-linecap="round"/>`,
  "brand", "accent", "ink",
);

/** Clip / evidencia — "prueba / captura". */
export const STICKER_CLIP = sticker(
  "0 0 200 200",
  `<path d="M60 46h96v118a12 12 0 0 1-12 12H72a12 12 0 0 1-12-12Z" fill="{{paper}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M72 46V28a16 16 0 0 1 16-16h24a16 16 0 0 1 16 16v18" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linecap="round"/>
   <path d="M80 66h40" stroke="{{highlight}}" stroke-width="10" stroke-linecap="round"/>
   <path d="M80 96h64" stroke="{{main}}" stroke-width="10" stroke-linecap="round"/>`,
  "brand", "accent", "ink",
);

/** Flecha de código — "build / stack". */
export const STICKER_CODE = sticker(
  "0 0 200 200",
  `<path d="M34 74l40 28-40 28M112 130h54" fill="none" stroke="{{main}}" stroke-width="{{sw}}" stroke-linecap="square" stroke-linejoin="miter"/>
   <rect x="16" y="16" width="168" height="168" rx="18" fill="transparent" stroke="{{outline}}" stroke-width="4"/>
   <circle cx="150" cy="50" r="6" fill="{{highlight}}" stroke="{{outline}}" stroke-width="3"/>`,
  "brand", "accent", "ink",
);

/** Engranaje — "sistema / configuración". */
export const STICKER_GEAR = sticker(
  "0 0 200 200",
  `<path d="M100 30l12 22 25-5 5 25 22 12-22 12-5 25-25-5-12 22-12-22-25 5-5-25-22-12 22-12 5-25 25 5Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linejoin="round"/>
   <circle cx="100" cy="100" r="26" fill="{{paper}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <circle cx="100" cy="100" r="12" fill="{{highlight}}" stroke="{{outline}}" stroke-width="4"/>`,
  "accent", "brand", "ink",
);

/** Mapa mental / idea — "diagrama". */
export const STICKER_BULB = sticker(
  "0 0 200 200",
  `<path d="M100 18c-32 0-56 22-56 52 0 22 12 36 24 48v26a8 8 0 0 0 8 8h48a8 8 0 0 0 8-8v-26c12-12 24-26 24-48 0-30-24-52-56-52Z" fill="{{main}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M80 156h40M84 176h32" stroke="{{outline}}" stroke-width="{{sw}}" stroke-linecap="round"/>
   <path d="M84 102c-6-10-6-20 0-30" stroke="{{paper}}" stroke-width="7" stroke-linecap="round"/>
   <path d="M116 102c6-10 6-20 0-30" stroke="{{paper}}" stroke-width="7" stroke-linecap="round"/>
   <circle cx="100" cy="80" r="10" fill="{{highlight}}" stroke="{{outline}}" stroke-width="4"/>`,
  "marker", "accent", "ink",
);

/** Hand-drawn underline / subrayado anotado. */
export const STICKER_UNDERLINE = sticker(
  "0 0 220 30",
  `<path d="M8 22C70 6 150 6 212 22" fill="none" stroke="{{main}}" stroke-width="8" stroke-linecap="round"/>`,
  "accent", "brand", "ink",
);

/** Nube — "pensado para ti / recursos". */
export const STICKER_CLOUD = sticker(
  "0 0 200 200",
  `<path d="M56 160a36 36 0 0 1-8-71 48 48 0 0 1 92-12 38 38 0 0 1 12 72 12 12 0 0 1 0 22H56a12 12 0 0 1 0-11Z" fill="{{paper}}" stroke="{{outline}}" stroke-width="{{sw}}"/>
   <path d="M100 66v40M82 84h36" stroke="{{highlight}}" stroke-width="10" stroke-linecap="round"/>`,
  "accent", "brand", "ink",
);

/** Mapa de stickers disponibles para que el planner/AI los pida por nombre. */
export const STICKER_NAMES = [
  "floppy", "folder", "bookmark", "star", "pencil", "cursor",
  "rocket", "clip", "code", "gear", "bulb", "underline", "cloud",
] as const;
export type StickerName = (typeof STICKER_NAMES)[number];

const STICKER_MAP: Record<StickerName, string> = {
  floppy: STICKER_FLOPPY,
  folder: STICKER_FOLDER,
  bookmark: STICKER_BOOKMARK,
  star: STICKER_STAR,
  pencil: STICKER_PENCIL,
  cursor: STICKER_CURSOR,
  rocket: STICKER_ROCKET,
  clip: STICKER_CLIP,
  code: STICKER_CODE,
  gear: STICKER_GEAR,
  bulb: STICKER_BULB,
  underline: STICKER_UNDERLINE,
  cloud: STICKER_CLOUD,
};

export const stickerByName = (name: string): string | undefined => STICKER_MAP[name as StickerName];

export const isStickerName = (name: unknown): name is StickerName =>
  typeof name === "string" && name in STICKER_MAP;

/** Crea una decoración sticker (type: svg) con un frame dado. Conveniente para
 *  que el planner/AI pueda pedir stickers por nombre en `assetQueries`. */
export const stickerDecoration = (
  name: StickerName,
  frame: RecipeDecoration["frame"],
  options: { rotation?: number; opacity?: number } = {},
): RecipeDecoration => ({
  type: "svg",
  frame,
  token: "transparent",
  svg: STICKER_MAP[name],
  rotation: options.rotation,
  opacity: options.opacity,
});

// ---------------------------------------------------------------------------
// Mockups de dispositivo — marcos SVG con pantalla transparente. Se superponen
// sobre el slot de imagen (screenshot/hero-image) con zIndex superior para
// enmarcar la captura dentro de un laptop/teléfono, como en los diseños de
// referencia. La pantalla es transparente para que la imagen del slot se vea.
// ---------------------------------------------------------------------------

/** Laptop con pantalla transparente. Úsalo sobre un slot `screenshot` para
 *  convertir la captura en un mockup de portátil. */
export const MOCKUP_LAPTOP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 270">
  <rect x="8" y="6" width="384" height="228" rx="10" fill="none" stroke="{{ink}}" stroke-width="16"/>
  <rect x="168" y="2" width="64" height="8" rx="4" fill="{{ink}}" opacity=".85"/>
  <path d="M6 240h388l-18 16a14 14 0 0 1-10 4H34a14 14 0 0 1-10-4Z" fill="{{ink}}" opacity=".9"/>
  <rect x="30" y="234" width="340" height="8" rx="4" fill="{{brand}}" opacity=".9"/>
</svg>`
  .replaceAll("{{ink}}", "#18181B")
  .replaceAll("{{brand}}", "#D94E1E");

/** Teléfono con pantalla transparente para capturas verticales. */
export const MOCKUP_PHONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 440">
  <rect x="8" y="4" width="204" height="432" rx="34" fill="none" stroke="{{ink}}" stroke-width="16"/>
  <rect x="88" y="18" width="44" height="6" rx="3" fill="{{ink}}" opacity=".85"/>
  <path d="M20 220h180" stroke="{{accent}}" stroke-width="6" opacity=".4"/>
</svg>`
  .replaceAll("{{ink}}", "#18181B")
  .replaceAll("{{accent}}", "#008F99");

/** Mockup para un slot según su ratio (laptop para horizontal, phone para
 *  vertical). Conveniente para enmarcar `screenshot`/`hero-image`. */
export const mockupForFrame = (
  frameWidth: number,
  frameHeight: number,
  ink = "#18181B",
  brand = "#D94E1E",
  accent = "#008F99",
): string => (frameWidth >= frameHeight ? MOCKUP_LAPTOP : MOCKUP_PHONE)
  .replaceAll("{{ink}}", ink)
  .replaceAll("{{brand}}", brand)
  .replaceAll("{{accent}}", accent);

// ---------------------------------------------------------------------------
// Compilador de assets vectoriales (razonados por DeepSeek/MiMo)
// ---------------------------------------------------------------------------

export type VectorShapeSpec = {
  type: "rect" | "circle" | "ellipse" | "line" | "arrow" | "text";
  x: number; y: number; width: number; height: number;
  fill: string; stroke?: string; strokeWidth: number;
  radius?: number; rotation?: number; label?: string;
};

export type VectorAssetSpecInput = {
  concept: string;
  palette: string[];
  shapes: VectorShapeSpec[];
  stickers: string[];
  motif: string;
};

const escapeXml = (value: string) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

const vectorToken = (value: string, palette: string[]): string => {
  const [brand = "#D94E1E", accent = "#008F99", paper = "#18181B", ink = "#F4F4F5"] = palette;
  return ({ brand, accent, paper, ink, marker: `${brand}33`, transparent: "transparent" } as Record<string, string>)[value] ?? value;
};

/** Convierte una especificación de asset vectorial en un SVG completo. Las
 *  coordenadas normalizadas (0-1) se mapean a un viewBox 600×600. Los stickers
 *  se incrustan desde el catálogo existente. Sin raster, sin texto incrustado
 *  salvo labels de nodo. */
export const compileVectorAssetSvg = (spec: VectorAssetSpecInput): string => {
  const W = 600;
  const H = 600;
  const palette = spec.palette.slice(0, 4);
  const body: string[] = [];
  for (const shape of spec.shapes) {
    const x = shape.x * W;
    const y = shape.y * H;
    const w = shape.width * W;
    const h = shape.height * H;
    const fill = vectorToken(shape.fill, palette);
    const stroke = shape.stroke ? vectorToken(shape.stroke, palette) : "none";
    const sw = shape.strokeWidth;
    const rotation = shape.rotation ? ` transform="rotate(${shape.rotation} ${x + w / 2} ${y + h / 2})"` : "";
    switch (shape.type) {
      case "rect":
        body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape.radius ?? 8}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${rotation}/>`);
        break;
      case "circle":
        body.push(`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${rotation}/>`);
        break;
      case "ellipse":
        body.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${rotation}/>`);
        break;
      case "line":
        body.push(`<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${stroke === "none" ? fill : stroke}" stroke-width="${sw}" stroke-linecap="round"${rotation}/>`);
        break;
      case "arrow": {
        const cy = y + h / 2;
        body.push(`<g${rotation}><line x1="${x}" y1="${cy}" x2="${x + w - 24}" y2="${cy}" stroke="${stroke === "none" ? fill : stroke}" stroke-width="${sw}" stroke-linecap="round"/><path d="M${x + w - 28} ${cy - 16}L${x + w} ${cy}L${x + w - 28} ${cy + 16}Z" fill="${stroke === "none" ? fill : stroke}"/></g>`);
        break;
      }
      case "text": {
        const size = Math.max(18, Math.min(48, w / 6));
        const cy = y + h / 2 + size * .35;
        body.push(`<text x="${x + w / 2}" y="${cy}" fill="${fill}" font-family="Space Grotesk, system-ui, sans-serif" font-size="${size}" font-weight="800" text-anchor="middle">${escapeXml(shape.label ?? "")}</text>`);
        break;
      }
    }
  }
  for (const name of spec.stickers.slice(0, 6)) {
    const svg = stickerByName(name);
    if (!svg) continue;
    const match = svg.match(/viewBox="([^"]+)"/);
    const parts = match?.[1]?.split(/\s+/).map(Number) ?? [0, 0, 200, 200];
    const sw = parts[2] || 200;
    const sh = parts[3] || 200;
    const index = spec.stickers.indexOf(name);
    const sx = 0.06 + (index % 3) * 0.34;
    const sy = 0.08 + Math.floor(index / 3) * 0.4;
    const scale = 0.24;
    const wrapped = svg
      .replace(/<svg([^>]*)>/, `<g transform="translate(${sx * W} ${sy * H}) scale(${scale}) translate(${-parts[0]} ${-parts[1]})">`)
      .replace(/<\/svg>/, "</g>");
    body.push(wrapped);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${body.join("")}</svg>`;
};
