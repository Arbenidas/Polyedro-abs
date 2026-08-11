import type { SceneDocument } from "./editor.models";

export type ColorPaletteDefinition = {
  id: string;
  name: string;
  mood: string;
  colors: [string, string, string, string];
};

// Token order is warm accent, cool accent, paper, ink. Keeping this order
// preserves compatibility with scenes produced by older catalog versions.
export const DEFAULT_EDITOR_PALETTE: ColorPaletteDefinition["colors"] = ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"];

export const COLOR_PALETTES: ColorPaletteDefinition[] = [
  { id: "arbe-dark", name: "Arbe Dark", mood: "Nocturna · técnica", colors: ["#D94E1E", "#008F99", "#18181B", "#F4F4F5"] },
  { id: "arbe-paper", name: "Arbe Paper", mood: "Papel · editorial", colors: ["#D94E1E", "#008F99", "#F2F0E4", "#1A1A1A"] },
];

export function findPaletteId(colors: string[]) {
  const signature = colors.slice(0, 4).map((color) => color.toUpperCase()).join("|");
  return COLOR_PALETTES.find((palette) => palette.colors.map((color) => color.toUpperCase()).join("|") === signature)?.id ?? "custom";
}

function remapColor(value: string | undefined, from: string[], to: string[]) {
  if (!value) return value;
  const normalized = value.toUpperCase();
  for (let index = 0; index < Math.min(from.length, to.length, 4); index++) {
    const source = from[index].toUpperCase();
    if (normalized === source) return to[index];
    if (source.length === 7 && normalized.length === 9 && normalized.startsWith(source)) return `${to[index]}${value.slice(7)}`;
  }
  return value;
}

function remapSvg(svg: string | undefined, from: string[], to: string[]) {
  if (!svg) return svg;
  return from.slice(0, 4).reduce((result, color, index) => result.replace(new RegExp(color, "gi"), to[index] ?? color), svg);
}

export function applyPaletteToScene(scene: SceneDocument, from: string[], palette: ColorPaletteDefinition): SceneDocument {
  const colors = [...palette.colors];
  return {
    ...scene,
    paletteId: palette.id,
    palette: colors,
    background: remapColor(scene.background, from, colors) ?? colors[2],
    elements: scene.elements.map((element) => ({
      ...element,
      fill: remapColor(element.fill, from, colors),
      stroke: remapColor(element.stroke, from, colors),
      shadowColor: remapColor(element.shadowColor, from, colors),
      svg: remapSvg(element.svg, from, colors),
    })),
    updatedAt: new Date().toISOString(),
  };
}
