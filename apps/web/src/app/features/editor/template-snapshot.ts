import type { EditorialTemplate, SceneDocument, SceneElement, TemplateSceneSnapshot, TemplateSlot } from "./editor.models";

const normalizedFrame = (element: SceneElement, scene: SceneDocument) => ({
  x: Math.max(0, Math.min(1, element.x / scene.width)),
  y: Math.max(0, Math.min(1, element.y / scene.height)),
  width: Math.max(.01, Math.min(1, element.width / scene.width)),
  height: Math.max(.01, Math.min(1, element.height / scene.height)),
});

function slotRole(element: SceneElement): TemplateSlot["role"] | undefined {
  const name = element.name.toLocaleLowerCase();
  if (/titular|headline|concepto|stat/.test(name)) return "headline";
  if (/cuerpo|subt[ií]tulo|atribuci[oó]n|item|descripci[oó]n/.test(name)) return "body";
  if (/\bcta\b|acci[oó]n/.test(name)) return "cta";
  if (/logo|marca|firma|^f$/.test(name)) return "logo";
  if (/captura|screenshot|demo/.test(name)) return "screenshot";
  if (/imagen|foto|img/.test(name)) return "hero-image";
  if (/icono|ícono/.test(name)) return "icon";
  return undefined;
}

export function templateSlotsFromScene(scene: SceneDocument): TemplateSlot[] {
  const slots: TemplateSlot[] = [];
  const seen = new Set<TemplateSlot["role"]>();
  const candidates = [...scene.elements]
    .filter((element) => element.visible !== false)
    .sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0));

  for (const element of candidates) {
    let role = slotRole(element);
    if (!role && element.type === "text" && !seen.has("headline")) role = "headline";
    if (!role || seen.has(role)) continue;
    seen.add(role);
    slots.push({
      id: `${role}-${slots.length}`,
      role,
      accepts: ["headline", "body", "cta"].includes(role) ? ["text"] : ["svg", "image"],
      required: role === "headline",
      fit: ["hero-image", "screenshot"].includes(role) ? "cover" : "contain",
      constraints: { maxLines: role === "headline" ? 4 : 12 },
      frame: normalizedFrame(element, scene),
    });
  }

  if (!seen.has("headline")) {
    slots.unshift({ id: "headline-0", role: "headline", accepts: ["text"], required: true, fit: "contain", constraints: { maxLines: 4 }, frame: { x: .1, y: .2, width: .8, height: .35 } });
  }
  return slots;
}

function snapshotElement(element: SceneElement, scene: SceneDocument): SceneElement | undefined {
  if (element.visible === false) return undefined;
  if (element.type === "image") {
    if (element.isBackground) return undefined;
    return {
      ...structuredClone(element),
      type: "rect",
      name: `Marco · ${element.name}`,
      src: undefined,
      assetId: undefined,
      fill: "transparent",
      stroke: scene.palette?.[3] ?? "#171717",
      strokeWidth: Math.max(2, element.strokeWidth ?? 2),
      radius: element.radius ?? 10,
    };
  }
  if (element.type === "svg" && !element.svg) return undefined;
  return structuredClone(element);
}

export function createTemplateSceneSnapshot(scene: SceneDocument): TemplateSceneSnapshot {
  return {
    background: scene.background,
    palette: [...(scene.palette?.length ? scene.palette : [scene.background])].slice(0, 4),
    elements: scene.elements.flatMap((element) => {
      const next = snapshotElement(element, scene);
      return next ? [next] : [];
    }),
  };
}

export function templateCharacteristics(scene: SceneDocument): Pick<EditorialTemplate, "style" | "density" | "assetRequirement"> {
  const visible = scene.elements.filter((element) => element.visible !== false);
  const text = visible.filter((element) => element.type === "text");
  const fonts = text.map((element) => element.fontFamily?.toLocaleLowerCase() ?? "");
  const largestText = Math.max(0, ...text.map((element) => element.fontSize ?? 0));
  const hasImage = visible.some((element) => element.type === "image");
  const hasVisualAsset = visible.some((element) => element.type === "svg" || element.type === "image");
  const style: EditorialTemplate["style"] = fonts.some((font) => font.includes("merriweather") || font.includes("serif"))
    ? "editorial"
    : fonts.filter((font) => font.includes("mono")).length >= Math.max(2, text.length / 2)
      ? "technical"
      : largestText >= scene.width * .075 ? "bold" : "editorial";
  const density: EditorialTemplate["density"] = visible.length >= 18 || text.length >= 7 ? "high" : visible.length >= 8 || text.length >= 4 ? "medium" : "low";
  const assetRequirement: EditorialTemplate["assetRequirement"] = hasImage ? "image" : hasVisualAsset ? "optional" : "none";
  return { style, density, assetRequirement };
}
