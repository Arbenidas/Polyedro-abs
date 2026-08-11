import type { EditorialBrand, EditorialSlide, ContentChannel } from "../../editorial.models";
import { CHANNEL_SIZES, SCENE_VERSION, type EditorialDiagramProfile, type EditorialTemplate, type SceneDocument, type SceneElement } from "./editor.models";
import { templateByRecipe } from "./template-catalog";
import { pickRecipeForRole } from "./recipe-catalog";
import { createEditorialDiagramElements, normalizeEditorialDiagram } from "./editorial-diagram";
import { applyEditorialReadability } from "./editorial-quality";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function txt(
  name: string, content: string, x: number, y: number, w: number,
  fontSize: number, fill: string, z: number, weight = 700,
  opts: Partial<Pick<SceneElement, "fontFamily" | "textAlign" | "lineHeight" | "charSpacing" | "opacity">> = {},
): SceneElement {
  return {
    id: uid(), type: "text", name, content, x, y, width: w, height: fontSize * 2.5,
    scaleX: 1, scaleY: 1, rotation: 0, opacity: opts.opacity ?? 1, zIndex: z, visible: true, locked: false,
    fill, fontFamily: opts.fontFamily ?? "Space Grotesk", fontSize, fontWeight: weight,
    textAlign: opts.textAlign ?? "left", lineHeight: opts.lineHeight ?? 0.92, charSpacing: opts.charSpacing ?? -18,
  };
}

function ln(x: number, y: number, w: number, h: number, stroke: string, sw: number, o: number, z: number): SceneElement {
  return { id: uid(), type: "line", name: "L", x, y, width: w, height: h, scaleX: 1, scaleY: 1, rotation: 0, opacity: o, zIndex: z, visible: true, locked: false, stroke, strokeWidth: sw };
}

function rect(x: number, y: number, w: number, h: number, fill: string, z: number, opts: { stroke?: string; sw?: number; r?: number } = {}): SceneElement {
  return { id: uid(), type: "rect", name: "R", x, y, width: w, height: h, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: z, visible: true, locked: false, fill, stroke: opts.stroke, strokeWidth: opts.sw, radius: opts.r };
}

function base(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, bg: string, els: SceneElement[]): SceneDocument {
  const { width, height } = CHANNEL_SIZES[ch];
  return { version: SCENE_VERSION, id: `scene-${slide.id}`, projectId: slide.post_id, slideId: slide.id, channel: ch, width, height, background: bg, palette: brand.palette.slice(0, 4), elements: els, createdAt: now(), updatedAt: now() };
}

function fit(content: string, fw: number, fh: number, min: number, max: number): number {
  const e = Math.sqrt((Math.max(1, fw) * Math.max(1, fh)) / (Math.max(12, content.length) * .72)) * .78;
  return Math.round(Math.max(min, Math.min(max, e)));
}

function remapSnapshotColor(value: string | undefined, from: string[], to: string[]) {
  if (!value || value === "transparent") return value;
  const normalized = value.toLocaleUpperCase();
  for (let index = 0; index < Math.min(from.length, to.length, 4); index++) {
    if (normalized === from[index]?.toLocaleUpperCase()) return to[index];
  }
  return value;
}

function splitTemplateHeadline(value: string, count: number) {
  if (count <= 1) return [value];
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    const remainingLines = count - index;
    const take = Math.max(1, Math.ceil((words.length - cursor) / remainingLines));
    lines.push(words.slice(cursor, cursor + take).join(" "));
    cursor += take;
  }
  return lines;
}

function renderSceneSnapshot(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, template: EditorialTemplate, pal: string[]): SceneDocument {
  const snapshot = template.sceneSnapshot!;
  const { width, height } = CHANNEL_SIZES[ch];
  const scaleX = width / Math.max(1, template.width);
  const scaleY = height / Math.max(1, template.height);
  const headlineElements = snapshot.elements.filter((element) => element.type === "text" && /titular|headline|concepto|stat/i.test(element.name));
  const headlineParts = splitTemplateHeadline(slide.headline, headlineElements.length);
  let headlineIndex = 0;
  const elements = snapshot.elements.map((source, index): SceneElement => {
    const element = structuredClone(source);
    const name = element.name.toLocaleLowerCase();
    let content = element.content;
    if (element.type === "text") {
      if (/titular|headline|concepto|stat/.test(name)) content = headlineParts[headlineIndex++] || slide.headline;
      else if (/cuerpo|subt[ií]tulo|descripci[oó]n/.test(name)) content = slide.body || slide.headline;
      else if (/\bcta\b|acci[oó]n/.test(name)) content = (slide.body || "Guárdalo").slice(0, 42).toLocaleUpperCase();
      else if (/^f$|firma|marca|logo/.test(name)) content = `@${brand.name}`;
      else if (/^n$|n[uú]mero/.test(name)) content = String(slide.slide_order).padStart(2, "0");
      else if (/^k$|kicker/.test(name)) content = `— ${String(slide.slide_order).padStart(2, "0")}`;
    }
    return {
      ...element,
      id: uid(),
      x: element.x * scaleX,
      y: element.y * scaleY,
      width: element.width * scaleX,
      height: element.height * scaleY,
      fontSize: element.fontSize == null ? undefined : element.fontSize * Math.min(scaleX, scaleY),
      strokeWidth: element.strokeWidth == null ? undefined : element.strokeWidth * Math.min(scaleX, scaleY),
      radius: element.radius == null ? undefined : element.radius * Math.min(scaleX, scaleY),
      fill: remapSnapshotColor(element.fill, snapshot.palette, pal),
      stroke: remapSnapshotColor(element.stroke, snapshot.palette, pal),
      shadowColor: remapSnapshotColor(element.shadowColor, snapshot.palette, pal),
      content,
      zIndex: index,
      visible: element.visible !== false,
    };
  });
  return base(slide, brand, ch, remapSnapshotColor(snapshot.background, snapshot.palette, pal) ?? pal[2], elements);
}

// ── 8 plantillas limpias ──────────────────────────────────────────────

function renderCover(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];

  // grid lines verticales
  for (let i = 1; i < 5; i++) els.push(ln(w * (.07 + i * .19), 0, 0, h, accent, 1, .08, -10));

  // número pequeño
  els.push(txt("K", `— ${String(slide.slide_order).padStart(2, "0")}`, w * .08, h * .04, w * .15, 18, ink, 0, 600, { fontFamily: "Share Tech Mono" }));
  // brand
  els.push(txt("F", `@${brand.name}`, w * .65, h * .04, w * .27, 18, ink, 0, 600, { textAlign: "right", fontFamily: "Share Tech Mono" }));

  // TÍTULO — el único protagonista
  const sz = fit(slide.headline, w * .84, h * .55, 64, 172);
  els.push(txt("Titular", slide.headline, w * .08, h * .16, w * .84, sz, accent, 1, 900, { lineHeight: .84, charSpacing: -32 }));

  // dots footer
  els.push(rect(w * .08, h * .90, w * .030, w * .030, accent, 2, { r: 999 }));
  els.push(rect(w * .125, h * .90, w * .030, w * .030, "transparent", 3, { stroke: ink, sw: 2.5, r: 999 }));

  return base(slide, brand, ch, bg, els);
}

function renderTypographicPoster(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1], marker = pal[0];
  const els: SceneElement[] = [];
  const lineCount = slide.headline.length > 76 ? 4 : slide.headline.length > 44 ? 3 : slide.headline.length > 20 ? 2 : 1;
  const lines = splitTemplateHeadline(slide.headline, lineCount);
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const headlineSize = Math.max(42, Math.min(148, w * .74 / Math.max(5.2, longest * .56)));
  const leading = headlineSize * .98;
  const blockHeight = leading * lines.length;
  const startY = h * .48 - blockHeight / 2;

  els.push(rect(w * .10, h * .055, w * .014, w * .014, marker, 0, { r: 999 }));
  els.push(txt("K", `SISTEMA / ${String(slide.slide_order).padStart(2, "0")}`, w * .13, h * .048, w * .28, 14, ink, 1, 700, { fontFamily: "Share Tech Mono", charSpacing: 28, opacity: .7 }));
  els.push(txt("F", `@${brand.name}`, w * .62, h * .048, w * .28, 14, ink, 2, 700, { fontFamily: "Share Tech Mono", textAlign: "right", charSpacing: 18, opacity: .58 }));
  els.push(txt("Eyebrow", "idea central", w * .12, startY - headlineSize * .48, w * .76, Math.max(18, headlineSize * .18), ink, 3, 400, { textAlign: "center", charSpacing: 0, opacity: .48 }));

  lines.forEach((line, index) => {
    const finalLine = index === lines.length - 1;
    els.push(txt(`Titular ${index + 1}`, line, w * .12, startY + index * leading, w * .76, headlineSize, finalLine ? marker : ink, 4 + index, 900, {
      textAlign: "center", lineHeight: .82, charSpacing: -30,
    }));
  });

  if (slide.body) {
    els.push(txt("Cuerpo", slide.body, w * .17, Math.min(h * .73, startY + blockHeight + headlineSize * .34), w * .66, 19, ink, 10, 400, { textAlign: "center", lineHeight: 1.25, charSpacing: 0, opacity: .66 }));
  }
  els.push(rect(w * .10, h * .905, w * .20, h * .032, marker, 11, { r: 999 }));
  els.push(txt("CTA", "GUÁRDALO", w * .115, h * .908, w * .17, 13, bg, 12, 800, { textAlign: "center", fontFamily: "Share Tech Mono", charSpacing: 8 }));
  els.push(rect(w * .86, h * .902, w * .035, w * .035, accent, 13, { r: 2 }));
  return base(slide, brand, ch, bg, els);
}

function renderPhoto(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];

  // zona de imagen con borde
  els.push(rect(w * .08, h * .08, w * .84, h * .50, "transparent", 0, { stroke: ink, sw: 2 }));
  // placeholder sutil
  els.push(txt("Img", "imagen", w * .30, h * .28, w * .40, 20, ink, 1, 400, { textAlign: "center", opacity: .10 }));

  // título debajo
  els.push(txt("Titular", slide.headline, w * .08, h * .64, w * .84, fit(slide.headline, w * .84, h * .14, 36, 84), ink, 2, 900));

  // texto opcional
  if (slide.body) {
    els.push(txt("Cuerpo", slide.body, w * .08, h * .80, w * .64, 18, ink, 3, 400, { opacity: .7 }));
  }

  // brand
  els.push(txt("F", `@${brand.name}`, w * .65, h * .93, w * .27, 16, ink, 4, 600, { textAlign: "right" }));

  return base(slide, brand, ch, bg, els);
}

function renderCard(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3];
  const els: SceneElement[] = [];

  // una sola tarjeta con borde
  els.push(rect(w * .10, h * .12, w * .80, h * .60, "transparent", 0, { stroke: ink, sw: 3, r: 18 }));

  // número esquina
  els.push(txt("N", String(slide.slide_order).padStart(2, "0"), w * .14, h * .06, w * .10, 22, ink, 1, 900, { fontFamily: "Share Tech Mono", opacity: .4 }));

  // título
  els.push(txt("Titular", slide.headline, w * .14, h * .18, w * .72, fit(slide.headline, w * .72, h * .22, 36, 72), ink, 2, 900));

  // texto
  if (slide.body) {
    els.push(txt("Cuerpo", slide.body, w * .14, h * .44, w * .72, 19, ink, 3, 400, { opacity: .75 }));
  }

  // brand
  els.push(txt("F", `@${brand.name}`, w * .14, h * .92, w * .40, 16, ink, 4, 600, { fontFamily: "Share Tech Mono", opacity: .45 }));

  return base(slide, brand, ch, bg, els);
}

function renderSplit(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const num = String(slide.slide_order).padStart(2, "0");
  const els: SceneElement[] = [];

  // divisor vertical
  els.push(ln(w * .34, h * .10, 0, h * .80, ink, 1, .4, -1));

  // número grande a la izquierda
  els.push(txt("N", num, w * .06, h * .16, w * .26, h * .24, accent, 0, 900, { fontFamily: "Arial", charSpacing: -30, opacity: .20 }));

  // título a la derecha
  els.push(txt("Titular", slide.headline, w * .40, h * .16, w * .52, fit(slide.headline, w * .52, h * .28, 32, 80), ink, 1, 900));

  // texto a la derecha
  if (slide.body) {
    els.push(txt("Cuerpo", slide.body, w * .40, h * .52, w * .52, 20, ink, 2, 400, { opacity: .75 }));
  }

  // brand
  els.push(txt("F", `@${brand.name}`, w * .08, h * .92, w * .30, 16, ink, 3, 600, { fontFamily: "Share Tech Mono", opacity: .45 }));

  return base(slide, brand, ch, bg, els);
}

function renderQuote(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];

  // frase grande centrada
  els.push(txt("Titular", slide.headline, w * .12, h * .26, w * .76, fit(slide.headline, w * .76, h * .44, 48, 128), ink, 0, 900, { textAlign: "center", lineHeight: .88, charSpacing: -22 }));

  // línea separadora
  els.push(ln(w * .35, h * .70, w * .30, 0, accent, 2, .5, 1));

  // atribución
  els.push(txt("F", `@${brand.name}`, w * .10, h * .76, w * .80, 18, ink, 2, 600, { textAlign: "center", opacity: .6 }));

  return base(slide, brand, ch, bg, els);
}

function renderNumber(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const num = String(slide.slide_order).padStart(2, "0");
  const els: SceneElement[] = [];

  // acento superior
  els.push(rect(w * .08, h * .16, w * .14, h * .015, accent, 0));

  // número gigante
  els.push(txt("N", num, w * .06, h * .18, w * .36, h * .22, accent, 1, 900, { fontFamily: "Arial", charSpacing: -30, opacity: .18 }));

  // título a la derecha del número
  els.push(txt("Titular", slide.headline, w * .44, h * .22, w * .48, fit(slide.headline, w * .48, h * .52, 42, 88), ink, 2, 900));

  // brand
  els.push(txt("F", `@${brand.name}`, w * .08, h * .92, w * .30, 16, ink, 3, 600, { fontFamily: "Share Tech Mono", opacity: .45 }));

  return base(slide, brand, ch, bg, els);
}

function renderCta(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];

  // título
  els.push(txt("Titular", slide.headline, w * .10, h * .20, w * .80, fit(slide.headline, w * .80, h * .36, 40, 96), ink, 0, 900, { charSpacing: -24 }));

  // línea
  els.push(ln(w * .10, h * .58, w * .24, 0, accent, 3, .5, 1));

  // CTA pill
  const ctaH = h * .08;
  els.push(rect(w * .10, h * .64, w * .34, ctaH, accent, 2, { r: 999 }));
  els.push(txt("CTA", slide.body?.toUpperCase().slice(0, 32) ?? "GUÁRDALO", w * .13, h * .65, w * .30, 16, pal[2], 3, 800, { textAlign: "center", fontFamily: "Share Tech Mono" }));

  // brand
  els.push(txt("F", `@${brand.name}`, w * .10, h * .92, w * .40, 16, ink, 4, 600, { opacity: .45 }));

  return base(slide, brand, ch, bg, els);
}

function renderBody(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3];
  const els: SceneElement[] = [];

  // solo texto con márgenes amplios
  els.push(txt("Cuerpo", slide.body || slide.headline, w * .10, h * .10, w * .80, 22, ink, 0, 400, { lineHeight: 1.5 }));

  // brand abajo
  els.push(txt("F", `@${brand.name}`, w * .10, h * .92, w * .40, 16, ink, 1, 600, { opacity: .4 }));

  return base(slide, brand, ch, bg, els);
}

// ── v4: 10 nuevas plantillas ─────────────────────────────────────────

function renderEditorialHero(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(rect(w * .10, h * .08, w * .10, h * .015, accent, 0));
  els.push(txt("K", `— ${String(slide.slide_order).padStart(2, "0")}`, w * .10, h * .04, w * .12, 16, ink, 1, 600, { fontFamily: "Share Tech Mono", opacity: .5 }));
  els.push(txt("Titular", slide.headline, w * .10, h * .14, w * .80, fit(slide.headline, w * .80, h * .18, 40, 80), accent, 2, 900, { charSpacing: -22 }));
  if (slide.body) els.push(txt("Subtítulo", slide.body, w * .10, h * .36, w * .60, 18, ink, 3, 400, { fontFamily: "Merriweather", opacity: .65 }));
  els.push(rect(w * .10, h * .52, w * .80, h * .36, "transparent", 4, { stroke: ink, sw: 2, r: 12 }));
  els.push(txt("Img", "imagen o ilustración", w * .30, h * .66, w * .40, 18, ink, 5, 400, { textAlign: "center", opacity: .12 }));
  els.push(txt("F", `@${brand.name}`, w * .65, h * .93, w * .25, 14, ink, 6, 600, { textAlign: "right", fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderEditorialStep(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(txt("N", String(slide.slide_order).padStart(2, "0"), w * .10, h * .06, w * .08, 20, accent, 0, 900, { fontFamily: "Share Tech Mono" }));
  els.push(txt("Titular", slide.headline, w * .10, h * .12, w * .80, fit(slide.headline, w * .80, h * .14, 32, 64), ink, 1, 900, { charSpacing: -18 }));
  if (slide.body) els.push(txt("Cuerpo", slide.body, w * .10, h * .30, w * .80, 19, ink, 2, 400, { lineHeight: 1.55, opacity: .8 }));
  els.push(rect(w * .10, h * .56, w * .80, h * .34, "transparent", 3, { stroke: ink, sw: 2, r: 8 }));
  els.push(txt("Img", "demo / screenshot", w * .32, h * .70, w * .36, 16, ink, 4, 400, { textAlign: "center", opacity: .12 }));
  els.push(txt("F", `@${brand.name}`, w * .10, h * .93, w * .30, 14, ink, 5, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderEditorialQuote(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(ln(w * .14, h * .18, w * .12, 0, accent, 3, .6, 0));
  els.push(txt("Titular", `"${slide.headline}"`, w * .14, h * .24, w * .72, fit(`"${slide.headline}"`, w * .72, h * .40, 36, 96), ink, 1, 700, { fontFamily: "Merriweather", lineHeight: 1.1, charSpacing: -10 }));
  if (slide.body) els.push(txt("Atribución", `— ${slide.body}`, w * .14, h * .70, w * .50, 16, ink, 2, 400, { opacity: .6 }));
  els.push(txt("F", `@${brand.name}`, w * .14, h * .90, w * .30, 14, ink, 3, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderEditorialList(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(txt("Titular", slide.headline, w * .10, h * .06, w * .80, fit(slide.headline, w * .80, h * .10, 28, 52), ink, 0, 900, { charSpacing: -16 }));
  const items = slide.body.split("\n").filter(Boolean).slice(0, 6);
  items.forEach((item, i) => {
    const y = h * .24 + i * h * .115;
    els.push(txt(`N${i}`, `${i + 1}.`, w * .10, y, w * .08, 32, accent, i * 2 + 1, 900, { fontFamily: "Space Grotesk" }));
    els.push(txt(`Item${i}`, item, w * .20, y + h * .01, w * .68, 18, ink, i * 2 + 2, 400, { opacity: .8 }));
  });
  els.push(txt("F", `@${brand.name}`, w * .10, h * .93, w * .30, 14, ink, 20, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderBoldHeadline(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[1], ink = pal[3];
  const els: SceneElement[] = [];
  els.push(txt("Titular", slide.headline.toUpperCase(), w * .06, h * .20, w * .88, fit(slide.headline, w * .88, h * .56, 56, 140), ink, 0, 900, { lineHeight: .86, charSpacing: -28 }));
  els.push(rect(w * .06, h * .86, w * .10, h * .012, ink, 1));
  els.push(txt("F", `@${brand.name}`, w * .06, h * .90, w * .30, 14, ink, 2, 600, { fontFamily: "Share Tech Mono", opacity: .5 }));
  return base(slide, brand, ch, bg, els);
}

function renderBoldStat(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  const num = slide.headline.replace(/[^0-9%]/g, "").slice(0, 4) || slide.headline.slice(0, 3);
  els.push(txt("Stat", num, w * .06, h * .08, w * .88, h * .48, accent, 0, 900, { fontFamily: "Arial", charSpacing: -30, lineHeight: .84 }));
  els.push(ln(w * .08, h * .62, w * .30, 0, accent, 3, .5, 1));
  els.push(txt("Cuerpo", slide.body || slide.headline, w * .08, h * .66, w * .76, 20, ink, 2, 400, { opacity: .8 }));
  els.push(txt("F", `@${brand.name}`, w * .08, h * .93, w * .30, 14, ink, 3, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderBoldContrast(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(txt("Titular", slide.headline, w * .10, h * .06, w * .80, fit(slide.headline, w * .80, h * .10, 24, 48), ink, 0, 900, { charSpacing: -14 }));
  els.push(ln(w * .50, h * .22, 0, h * .62, ink, 1, .3, -1));
  els.push(txt("Sí", "SÍ", w * .12, h * .28, w * .30, 28, accent, 1, 900));
  els.push(txt("No", "NO", w * .58, h * .28, w * .30, 28, ink, 2, 900, { opacity: .35 }));
  const lines = (slide.body || "").split("\n").filter(Boolean);
  lines.slice(0, 4).forEach((line, i) => {
    const y = h * .40 + i * h * .12;
    els.push(txt(`L${i}`, line, w * .12, y, w * .32, 16, ink, i * 2 + 3, 400, { opacity: .8 }));
  });
  els.push(txt("F", `@${brand.name}`, w * .10, h * .93, w * .30, 14, ink, 20, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderDemoFrame(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(rect(w * .08, h * .14, w * .84, h * .54, "transparent", 0, { stroke: ink, sw: 3, r: 8 }));
  els.push(rect(w * .08, h * .14, w * .84, h * .05, ink, -1));
  const dots = [w * .11, w * .15, w * .19];
  dots.forEach((dx) => els.push(rect(dx, h * .155, w * .02, w * .02, pal[3], 0, { r: 999 })));
  els.push(txt("Img", "demo / screenshot / gif", w * .30, h * .36, w * .40, 18, ink, 1, 400, { textAlign: "center", opacity: .12 }));
  els.push(txt("Titular", slide.headline, w * .08, h * .72, w * .84, fit(slide.headline, w * .84, h * .12, 28, 56), ink, 2, 900, { charSpacing: -16 }));
  if (slide.body) els.push(txt("Cuerpo", slide.body, w * .08, h * .86, w * .60, 16, ink, 3, 400, { opacity: .7 }));
  els.push(txt("F", `@${brand.name}`, w * .65, h * .93, w * .25, 14, ink, 4, 600, { textAlign: "right", fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderCodeBlock(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(txt("Titular", slide.headline, w * .10, h * .06, w * .80, fit(slide.headline, w * .80, h * .10, 24, 48), ink, 0, 900, { charSpacing: -14 }));
  els.push(rect(w * .08, h * .22, w * .84, h * .68, ink, 1, { r: 8 }));
  els.push(rect(w * .08, h * .22, w * .84, h * .05, accent, 2));
  els.push(txt("Tag", "// snippet", w * .12, h * .225, w * .20, 14, pal[3], 3, 600, { fontFamily: "Share Tech Mono", opacity: .7 }));
  const code = slide.body || slide.headline;
  const codeLines = code.split("\n").slice(0, 10);
  codeLines.forEach((line, i) => {
    els.push(txt(`Code${i}`, line || " ", w * .12, h * .30 + i * h * .058, w * .76, 16, pal[3], i + 4, 400, { fontFamily: "Share Tech Mono", lineHeight: 1.4 }));
  });
  els.push(txt("F", `@${brand.name}`, w * .10, h * .93, w * .30, 14, ink, 20, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function renderMinimalText(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[1], ink = pal[3];
  const els: SceneElement[] = [];
  els.push(txt("Titular", slide.headline, w * .14, h * .28, w * .72, fit(slide.headline, w * .72, h * .32, 36, 88), ink, 0, 700, { textAlign: "center", lineHeight: 1.0, charSpacing: -16 }));
  if (slide.body) els.push(txt("Cuerpo", slide.body, w * .14, h * .66, w * .72, 18, ink, 1, 400, { textAlign: "center", opacity: .65 }));
  els.push(ln(w * .42, h * .60, w * .16, 0, ink, 2, .3, 2));
  els.push(txt("F", `@${brand.name}`, w * .14, h * .90, w * .72, 14, ink, 3, 600, { textAlign: "center", fontFamily: "Share Tech Mono", opacity: .5 }));
  return base(slide, brand, ch, bg, els);
}

function renderChecklist(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number): SceneDocument {
  const bg = pal[2], ink = pal[3], accent = pal[1];
  const els: SceneElement[] = [];
  els.push(txt("Titular", slide.headline, w * .10, h * .06, w * .80, fit(slide.headline, w * .80, h * .10, 26, 48), ink, 0, 900, { charSpacing: -14 }));
  const items = (slide.body || "").split("\n").filter(Boolean).slice(0, 6);
  items.forEach((item, i) => {
    const y = h * .22 + i * h * .115;
    els.push(rect(w * .10, y + h * .01, w * .035, w * .035, accent, i * 2 + 1, { r: 4 }));
    els.push(txt(`Check${i}`, "✓", w * .103, y + h * .012, w * .03, 16, pal[3], i * 2 + 2, 700, { textAlign: "center", fontFamily: "Share Tech Mono" }));
    els.push(txt(`Item${i}`, item, w * .17, y, w * .71, 18, ink, i * 2 + 3, 400, { opacity: .85 }));
  });
  els.push(txt("F", `@${brand.name}`, w * .10, h * .93, w * .30, 14, ink, 20, 600, { fontFamily: "Share Tech Mono", opacity: .4 }));
  return base(slide, brand, ch, bg, els);
}

function fallbackDiagram(slide: EditorialSlide): EditorialDiagramProfile {
  const pieces = (slide.body || slide.headline).split(/\n|→|\s[—–-]\s|[.;]\s+/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const labels = pieces.length >= 2 ? pieces : ["Entrada", "Decisión", "Resultado"];
  const nodes = labels.map((label, index) => ({ id: `node-${index + 1}`, label: label.split(/[:,]/)[0]!.slice(0, 44), detail: label.split(/[:,]/).slice(1).join(" ").slice(0, 100), icon: label }));
  return {
    kind: "flow",
    title: slide.headline,
    caption: slide.body,
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1]!.id })),
  };
}

function renderMicroDiagram(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, pal: string[], w: number, h: number, profile?: EditorialDiagramProfile): SceneDocument {
  const diagram = normalizeEditorialDiagram(profile, slide.headline) ?? fallbackDiagram(slide);
  const els = createEditorialDiagramElements(diagram, pal, { width: w, height: h }, {
    headline: slide.headline,
    deck: slide.body || diagram.caption,
    brand: brand.name,
    folio: `MAPA / ${String(slide.slide_order).padStart(2, "0")}`,
  });
  return base(slide, brand, ch, pal[2], els);
}

// ── Dispatch ──────────────────────────────────────────────────────────

function compileSceneRaw(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, template: EditorialTemplate, _iconSvg?: string, diagramProfile?: EditorialDiagramProfile): SceneDocument {
  const { width: w, height: h } = CHANNEL_SIZES[ch];
  const pal = brand.palette.length >= 4 ? brand.palette : ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"];

  if (template.sceneSnapshot) return renderSceneSnapshot(slide, brand, ch, template, pal);

  switch (template.recipeId) {
    case "cover": return renderCover(slide, brand, ch, pal, w, h);
    case "typographic-poster": return renderTypographicPoster(slide, brand, ch, pal, w, h);
    case "photo": return renderPhoto(slide, brand, ch, pal, w, h);
    case "card": return renderCard(slide, brand, ch, pal, w, h);
    case "split": return renderSplit(slide, brand, ch, pal, w, h);
    case "quote": return renderQuote(slide, brand, ch, pal, w, h);
    case "number": return renderNumber(slide, brand, ch, pal, w, h);
    case "cta": return renderCta(slide, brand, ch, pal, w, h);
    case "body": return renderBody(slide, brand, ch, pal, w, h);
    case "editorial-hero": return renderEditorialHero(slide, brand, ch, pal, w, h);
    case "editorial-step": return renderEditorialStep(slide, brand, ch, pal, w, h);
    case "editorial-quote": return renderEditorialQuote(slide, brand, ch, pal, w, h);
    case "editorial-list": return renderEditorialList(slide, brand, ch, pal, w, h);
    case "bold-headline": return renderBoldHeadline(slide, brand, ch, pal, w, h);
    case "bold-stat": return renderBoldStat(slide, brand, ch, pal, w, h);
    case "bold-contrast": return renderBoldContrast(slide, brand, ch, pal, w, h);
    case "demo-frame": return renderDemoFrame(slide, brand, ch, pal, w, h);
    case "code-block": return renderCodeBlock(slide, brand, ch, pal, w, h);
    case "micro-diagram": return renderMicroDiagram(slide, brand, ch, pal, w, h, diagramProfile);
    case "minimal-text": return renderMinimalText(slide, brand, ch, pal, w, h);
    case "checklist": return renderChecklist(slide, brand, ch, pal, w, h);
  }

  // fallback genérico
  const ink = pal[3];
  const els: SceneElement[] = [txt("Titular", slide.headline, w * .12, h * .20, w * .76, fit(slide.headline, w * .76, h * .44, 36, 80), ink, 0, 900)];
  if (slide.body) els.push(txt("Cuerpo", slide.body, w * .12, h * .60, w * .76, 20, ink, 1, 400, { opacity: .7 }));
  return base(slide, brand, ch, pal[2], els);
}

export function compileScene(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, template: EditorialTemplate, iconSvg?: string, diagramProfile?: EditorialDiagramProfile): SceneDocument {
  return applyEditorialReadability(compileSceneRaw(slide, brand, ch, template, iconSvg, diagramProfile));
}

export function createScene(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel, template?: EditorialTemplate): SceneDocument {
  const role = slide.slide_order === 1 ? "cover" : "step";
  return compileScene(slide, brand, ch, template ?? templateByRecipe(ch, slide.composition || pickRecipeForRole(role), role));
}

export function createMarkupScene(slide: EditorialSlide, brand: EditorialBrand, ch: ContentChannel): SceneDocument {
  return createScene(slide, brand, ch);
}

export function cloneScene(scene: SceneDocument): SceneDocument {
  const ts = now();
  return { ...structuredClone(scene), id: `scene-${uid()}`, elements: scene.elements.map((e) => ({ ...e, id: uid() })), createdAt: ts, updatedAt: ts };
}
