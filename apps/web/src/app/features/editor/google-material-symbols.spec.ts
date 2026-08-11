import { describe, expect, it } from "vitest";
import { googleMaterialSymbolSvg, materialSymbolForConcept } from "./google-material-symbols";

describe("Google Material Symbols", () => {
  it("selects semantic icons instead of a generic repeated glyph", () => {
    expect(materialSymbolForConcept("contexto y objetivo", 0)).toBe("track_changes");
    expect(materialSymbolForConcept("problema de investigación", 1)).toBe("search");
    expect(materialSymbolForConcept("proceso y arquitectura", 2)).toBe("device_hub");
    expect(materialSymbolForConcept("impacto y métricas", 3)).toBe("trending_up");
    expect(materialSymbolForConcept("agente que decide", 4)).toBe("smart_toy");
    expect(materialSymbolForConcept("herramienta que ejecuta", 5)).toBe("build");
    expect(materialSymbolForConcept("guardrails y seguridad", 6)).toBe("shield");
    expect(materialSymbolForConcept("base de datos", 7)).toBe("storage");
  });

  it("returns a self-contained SVG with a safe color", () => {
    const svg = googleMaterialSymbolSvg("groups", "#315DE8");
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('fill="#315DE8"');
    expect(svg).not.toContain("http://fonts.googleapis.com");
  });
});
