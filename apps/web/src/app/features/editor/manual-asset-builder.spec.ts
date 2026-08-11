import { describe, expect, it } from "vitest";
import { compileManualAssetSvg, createManualAssetDocument, createManualAssetElement, normalizeManualAssetDocument } from "./manual-asset-builder";

describe("manual asset builder", () => {
  const palette = ["#B8F34A", "#2F5DE5", "#F2F0E4", "#10251E"];

  it("crea un documento transparente con una flecha editable", () => {
    const document = createManualAssetDocument(palette);
    const svg = compileManualAssetSvg(document);
    expect(document.elements[0].type).toBe("arrow");
    expect(svg).toContain("data-builder-type=\"arrow\"");
    expect(svg).not.toContain("<rect width=\"100%\"");
  });

  it("escapa el texto del usuario antes de compilar el SVG", () => {
    const document = createManualAssetDocument(palette);
    document.elements.push({ ...createManualAssetElement("text", document, palette), text: "Diseño < script & datos" });
    expect(compileManualAssetSvg(document)).toContain("Diseño &lt; script &amp; datos");
  });

  it("limita tamaños y cantidad de capas", () => {
    const source = createManualAssetDocument(palette);
    source.width = 9999;
    source.height = 10;
    source.elements = Array.from({ length: 80 }, () => createManualAssetElement("rect", source, palette));
    const normalized = normalizeManualAssetDocument(source);
    expect(normalized.width).toBe(1200);
    expect(normalized.height).toBe(120);
    expect(normalized.elements).toHaveLength(64);
  });

  it("compila patrones vectoriales reutilizables sin rasterizar el asset", () => {
    const document = createManualAssetDocument(palette);
    document.elements[0] = { ...document.elements[0], pattern: "cross-stitch", patternScale: 14 };
    const svg = compileManualAssetSvg(document);
    expect(svg).toContain("<pattern");
    expect(svg).toContain("url(#manual-pattern-");
    expect(svg).toContain("stroke-linecap=\"round\"");
    expect(svg).not.toContain("<image");
  });

  it("compila estrellas y trazos de pluma como vectores editables", () => {
    const document = createManualAssetDocument(palette);
    document.elements.push(createManualAssetElement("star", document, palette));
    document.elements.push(createManualAssetElement("path", document, palette));
    const svg = compileManualAssetSvg(document);
    expect(svg).toContain("data-builder-type=\"star\"");
    expect(svg).toContain("data-builder-type=\"path\"");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("<path");
    expect(svg).toContain("Q");
  });

  it("no exporta capas ocultas", () => {
    const document = createManualAssetDocument(palette);
    document.elements[0] = { ...document.elements[0], visible: false };
    expect(compileManualAssetSvg(document)).not.toContain("data-builder-type=\"arrow\"");
  });
});
