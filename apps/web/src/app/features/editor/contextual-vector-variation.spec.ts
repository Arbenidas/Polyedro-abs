import { describe, expect, it } from "vitest";
import { addFreshVectorVariation, contextualVectorSource, stripLegacyContextualOrnament } from "./contextual-vector-variation";

describe("contextual vector variations", () => {
  it("prioritizes the selected copy when building the visual context", () => {
    expect(contextualVectorSource("Ley de Hick y carga mental", "Reduce opciones", "Cuerpo general"))
      .toBe("Ley de Hick y carga mental Reduce opciones Cuerpo general");
  });

  it("creates a distinct SVG for every explicit creation", () => {
    const base = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240"><rect width="360" height="240"/></svg>';
    const first = addFreshVectorVariation(base, "fresh-variation-1", "#10251E", "#AFE33D");
    const second = addFreshVectorVariation(base, "fresh-variation-2", "#10251E", "#AFE33D");

    expect(first).not.toBe(second);
    expect(first).toContain('data-contextual-variation="fresh-variation-1"');
    expect(second).toContain('data-contextual-variation="fresh-variation-2"');
    expect(first).not.toContain('<g data-contextual-variation=');
  });

  it("removes the repeated dot-and-arrow ornament from saved SVGs", () => {
    const legacy = '<svg data-contextual-variation="old"><rect width="360" height="240"/><g data-contextual-variation="old" fill="none"><circle cx="320" cy="30" r="8"/><path d="M 300 30h 12"/></g></svg>';
    const cleaned = stripLegacyContextualOrnament(legacy);

    expect(cleaned).toContain('<rect width="360" height="240"/>');
    expect(cleaned).not.toContain('<g data-contextual-variation=');
    expect(cleaned).not.toContain('<circle cx="320"');
  });
});
