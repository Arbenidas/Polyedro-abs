import { Injectable } from "@angular/core";
import {
  Circle, Ellipse, FabricImage, FabricObject, Group, Line, Rect, Shadow, StaticCanvas, Textbox, Triangle, filters,
} from "fabric/es";
import { EditorialRasterFilter } from "./editorial-raster-filter";
import type { SceneDocument, SceneElement } from "./editor.models";
import { LocalLibraryService } from "./local-library.service";

@Injectable({ providedIn: "root" })
export class SceneRendererService {
  constructor(private readonly library: LocalLibraryService) {}

  async renderPng(scene: SceneDocument): Promise<Blob> {
    await Promise.all([
      document.fonts.load('600 24px "Space Grotesk"'),
      document.fonts.load('400 16px "Share Tech Mono"'),
      document.fonts.load('700 20px "Merriweather"'),
      document.fonts.ready,
    ]);
    const element = document.createElement("canvas");
    const canvas = new StaticCanvas(element, { width: scene.width, height: scene.height, backgroundColor: scene.background });
    try {
      for (const item of [...scene.elements].sort((a, b) => a.zIndex - b.zIndex)) {
        const object = await this.objectFromElement(item, scene);
        if (object) canvas.add(object);
      }
      canvas.renderAll();
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
      return await (await fetch(dataUrl)).blob();
    } finally {
      canvas.dispose();
    }
  }

  private async objectFromElement(element: SceneElement, scene: SceneDocument): Promise<FabricObject | undefined> {
    const options = {
      left: element.x,
      top: element.y,
      originX: "left" as const,
      originY: "top" as const,
      opacity: element.opacity,
      angle: element.rotation,
      visible: element.visible,
      selectable: false,
      evented: false,
    };
    let object: FabricObject;
    if (element.type === "text") {
      object = new Textbox(element.content ?? "", {
        ...options,
        width: element.width,
        fill: element.fill,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight,
        textAlign: element.textAlign,
        lineHeight: element.lineHeight,
        charSpacing: element.charSpacing,
      });
    } else if (element.type === "rect") {
      object = new Rect({ ...options, width: element.width, height: element.height, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0, rx: element.radius ?? 0, ry: element.radius ?? 0 });
    } else if (element.type === "circle") {
      object = new Circle({ ...options, radius: element.width / 2, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0 });
    } else if (element.type === "ellipse") {
      object = new Ellipse({ ...options, rx: element.width / 2, ry: element.height / 2, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0 });
    } else if (element.type === "line") {
      object = new Line([0, 0, element.width, element.height], { ...options, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 4, strokeLineCap: "round" });
    } else if (element.type === "arrow") {
      const line = new Line([0, element.height / 2, element.width - 30, element.height / 2], { stroke: element.stroke, strokeWidth: element.strokeWidth ?? 9, strokeLineCap: "round" });
      const head = new Triangle({ left: element.width - 30, top: element.height / 2, width: 38, height: 42, originX: "center", originY: "center", angle: 90, fill: element.fill });
      object = new Group([line, head], options);
    } else if (element.type === "image") {
      const source = element.src ?? await this.assetDataUrl(element.assetId);
      if (!source) return undefined;
      const image = await FabricImage.fromURL(source, { crossOrigin: "anonymous" }, options);
      this.fitMedia(image, element);
      this.applyImageVisuals(image, element, scene);
      object = image;
    } else if (element.type === "svg" && element.svg) {
      const source = URL.createObjectURL(new Blob([element.svg], { type: "image/svg+xml" }));
      try {
        object = await FabricImage.fromURL(source, {}, options);
      } finally {
        URL.revokeObjectURL(source);
      }
      this.fitMedia(object, element);
    } else {
      return undefined;
    }
    object.scaleX *= element.scaleX;
    object.scaleY *= element.scaleY;
    if (element.shadowColor) object.set({ shadow: new Shadow({ color: element.shadowColor, blur: element.shadowBlur ?? 20, offsetX: element.shadowOffsetX ?? 0, offsetY: element.shadowOffsetY ?? 12 }) });
    return object;
  }

  private fitMedia(object: FabricObject, element: SceneElement) {
    const naturalWidth = Math.max(1, object.width);
    const naturalHeight = Math.max(1, object.height);
    const scale = element.imageFit === "cover"
      ? Math.max(element.width / naturalWidth, element.height / naturalHeight)
      : Math.min(element.width / naturalWidth, element.height / naturalHeight);
    object.set({
      scaleX: scale,
      scaleY: scale,
      left: element.x + (element.width - naturalWidth * scale) / 2,
      top: element.y + (element.height - naturalHeight * scale) / 2,
    });
  }

  private applyImageVisuals(object: FabricImage, element: SceneElement, scene: SceneDocument) {
    object.set({ stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0, strokeUniform: true, paintFirst: "stroke" });
    if (element.radius) {
      const scale = Math.max(.001, Math.min(Math.abs(object.scaleX || 1), Math.abs(object.scaleY || 1)));
      object.clipPath = new Rect({
        width: object.width,
        height: object.height,
        rx: element.radius / scale,
        ry: element.radius / scale,
        originX: "center",
        originY: "center",
      });
    }
    const activeFilters = [];
    if (element.imageBlur) activeFilters.push(new filters.Blur({ blur: element.imageBlur }));
    if (element.imageBrightness) activeFilters.push(new filters.Brightness({ brightness: element.imageBrightness }));
    if (element.imageContrast) activeFilters.push(new filters.Contrast({ contrast: element.imageContrast }));
    if (element.imageSaturation) activeFilters.push(new filters.Saturation({ saturation: element.imageSaturation }));
    if (["bitmap", "halftone", "cross-stitch"].includes(element.imageFilterMode ?? "")) {
      activeFilters.push(new EditorialRasterFilter({
        style: element.imageFilterMode as "bitmap" | "halftone" | "cross-stitch",
        size: Math.max(3, element.imagePixelate ?? 7),
        ink: scene.palette?.[3] ?? "#F4F4F5",
        paper: scene.palette?.[2] ?? "#18181B",
      }));
    }
    if (element.imageFilterMode === "sepia") activeFilters.push(new filters.Sepia());
    if (element.imageFilterMode === "invert") activeFilters.push(new filters.Invert());
    if (element.imageFilterMode === "mosaic") activeFilters.push(new filters.Pixelate({ blocksize: Math.max(2, element.imagePixelate ?? 12) }));
    if (element.imageNoise) activeFilters.push(new filters.Noise({ noise: element.imageNoise }));
    object.filters = activeFilters;
    object.applyFilters();
  }

  private async assetDataUrl(id?: string) {
    if (!id) return undefined;
    const blob = await this.library.readLargeBlob(id);
    if (!blob) return undefined;
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
