import { describe, expect, it } from "vitest";
import { applyPaletteToScene, COLOR_PALETTES, DEFAULT_EDITOR_PALETTE, findPaletteId } from "./color-palettes";
import type { SceneDocument } from "./editor.models";

const scene: SceneDocument = {
  version: 1,
  id: "scene-1",
  projectId: "project-1",
  slideId: "slide-1",
  channel: "instagram_portrait",
  width: 1080,
  height: 1350,
  background: DEFAULT_EDITOR_PALETTE[2],
  elements: [{
    id: "text-1", type: "text", name: "Titular", x: 0, y: 0, width: 500, height: 100,
    scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false,
    fill: DEFAULT_EDITOR_PALETTE[3], shadowColor: `${DEFAULT_EDITOR_PALETTE[1]}55`,
    svg: `<svg><path fill="${DEFAULT_EDITOR_PALETTE[0]}"/></svg>`,
  }],
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
};

describe("arbe color palettes", () => {
  it("mantiene una colección enfocada en oscuro y papel", () => {
    expect(COLOR_PALETTES.map((item) => item.id)).toEqual(["arbe-dark", "arbe-paper"]);
    expect(findPaletteId(DEFAULT_EDITOR_PALETTE)).toBe("arbe-dark");
  });

  it("recolorea tokens, colores alpha y SVG sin mutar la escena", () => {
    const paper = COLOR_PALETTES[1];
    const result = applyPaletteToScene(scene, DEFAULT_EDITOR_PALETTE, paper);
    expect(result.background).toBe("#F2F0E4");
    expect(result.elements[0].fill).toBe("#1A1A1A");
    expect(result.elements[0].shadowColor).toBe("#008F9955");
    expect(result.elements[0].svg).toContain("#D94E1E");
    expect(scene.background).toBe("#18181B");
  });
});
