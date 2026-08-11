import type { SceneDocument, SceneElement } from "./editor.models";

export type EditorialQualityReport = {
  score: number;
  issues: Array<{ code: "tiny-text" | "too-many-text-blocks" | "overflow" | "dense-copy"; elementId?: string; message: string }>;
};

const isMicrocopy = (element: SceneElement) => /folio|meta|marca|footer|kicker|etiqueta|label|pagin/i.test(element.name);
const isHeadline = (element: SceneElement) => /titular|headline|título|title|hook/i.test(element.name);

export function applyEditorialReadability(scene: SceneDocument): SceneDocument {
  const scale = scene.width / 1080;
  const elements = scene.elements.map((element) => {
    if (element.type !== "text" || !element.visible) return element;
    const content = element.content?.trim() ?? "";
    const minimum = isHeadline(element) ? 42 * scale : isMicrocopy(element) ? 15 * scale : content.length > 80 ? 22 * scale : 19 * scale;
    return (element.fontSize ?? 0) < minimum ? { ...element, fontSize: Math.round(minimum * 10) / 10 } : element;
  });
  return { ...scene, elements };
}

export function auditEditorialScene(scene: SceneDocument): EditorialQualityReport {
  const issues: EditorialQualityReport["issues"] = [];
  const textElements = scene.elements.filter((element) => element.type === "text" && element.visible);
  for (const element of textElements) {
    const minimum = isMicrocopy(element) ? 14 : 18;
    if ((element.fontSize ?? 0) < minimum * scene.width / 1080) issues.push({ code: "tiny-text", elementId: element.id, message: `«${element.name}» queda pequeño para móvil.` });
    if ((element.content?.length ?? 0) > 320) issues.push({ code: "dense-copy", elementId: element.id, message: `«${element.name}» contiene demasiado texto para una lámina.` });
  }
  if (textElements.length > 12) issues.push({ code: "too-many-text-blocks", message: "La composición tiene más de 12 bloques de texto." });
  for (const element of scene.elements.filter((item) => item.visible)) {
    if (element.x < -2 || element.y < -2 || element.x + element.width * element.scaleX > scene.width + 2 || element.y + element.height * element.scaleY > scene.height + 2) issues.push({ code: "overflow", elementId: element.id, message: `«${element.name}» sale del lienzo.` });
  }
  return { score: Math.max(0, 100 - issues.length * 12), issues };
}

export function applyCarouselContinuity(scene: SceneDocument, index: number, total: number): SceneDocument {
  if (total <= 1) return scene;
  const paper = scene.palette?.[3] ?? "#F4F4F5";
  const accent = scene.palette?.[0] ?? "#D94E1E";
  const muted = scene.background.toLocaleLowerCase() === paper.toLocaleLowerCase() ? "#18181B" : paper;
  const pad = scene.width * .075;
  const y = scene.height - scene.height * .045;
  const track = scene.width - pad * 2;
  const progress = track * ((index + 1) / total);
  const z = Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1;
  const elements: SceneElement[] = [
    ...scene.elements,
    { id: crypto.randomUUID(), type: "line", name: "Continuidad · pista", x: pad, y, width: track, height: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: .22, zIndex: z, visible: true, locked: true, stroke: muted, strokeWidth: 2 },
    { id: crypto.randomUUID(), type: "line", name: "Continuidad · progreso", x: pad, y, width: progress, height: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: z + 1, visible: true, locked: true, stroke: accent, strokeWidth: 4 },
    { id: crypto.randomUUID(), type: "text", name: "Continuidad · paginación", content: `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, x: scene.width - pad - 92, y: y - 28, width: 92, height: 24, scaleX: 1, scaleY: 1, rotation: 0, opacity: .72, zIndex: z + 2, visible: true, locked: true, fill: muted, fontFamily: "Share Tech Mono", fontSize: 15, fontWeight: 700, textAlign: "right", lineHeight: 1, charSpacing: 25 },
  ];
  return { ...scene, elements, updatedAt: new Date().toISOString() };
}
