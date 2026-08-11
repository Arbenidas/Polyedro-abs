import { Injectable } from "@angular/core";
import type { Canvas } from "fabric/es";
import type { FabricObject } from "fabric/es";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { LocalLibraryService } from "./local-library.service";
import type { CutoutRecord, EditorialTemplate, LibraryAsset, SceneDocument } from "./editor.models";
import type { ContentProject } from "../content/content.models";
import { SceneRendererService } from "./scene-renderer.service";

type PackManifest = {
  format: "polyedro-pack";
  version: 1 | 2 | 3;
  exportedAt: string;
  scenes: SceneDocument[];
  templates: EditorialTemplate[];
  assets: Array<Omit<LibraryAsset, "blob"> & { blobPath?: string }>;
  projects?: ContentProject[];
  cutouts?: Array<Omit<CutoutRecord, "alphaMask"> & { maskPath: string }>;
};

@Injectable({ providedIn: "root" })
export class ExportService {
  constructor(private readonly library: LocalLibraryService, private readonly renderer: SceneRendererService) {}

  downloadDataUrl(dataUrl: string, filename: string) {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
  }

  downloadText(content: string, filename: string, type = "application/json") {
    this.downloadBlob(new Blob([content], { type }), filename);
  }

  async exportPng(canvas: Canvas, filename: string, scale = 1) {
    await document.fonts.ready;
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: Math.max(1, Math.min(3, scale)) });
    this.downloadDataUrl(dataUrl, filename);
  }

  async exportGif(canvas: Canvas, filename: string, animated: Array<{ object: FabricObject; motion: "float" | "pulse" | "wiggle" | "orbit" | "draw" }>) {
    const states = animated.map(({ object, motion }) => ({ object, motion, left: object.left, top: object.top, scaleX: object.scaleX, scaleY: object.scaleY, angle: object.angle, opacity: object.opacity }));
    const gif = GIFEncoder({ initialCapacity: 1024 * 1024 });
    const frameCount = 24;
    const multiplier = .5;
    try {
      for (let frame = 0; frame < frameCount; frame++) {
        const phase = frame / frameCount * Math.PI * 2;
        for (const [index, state] of states.entries()) {
          const offset = phase + index * .72;
          if (state.motion === "float") state.object.set({ top: state.top + Math.sin(offset) * 16, angle: state.angle + Math.sin(offset) * 1.8 });
          if (state.motion === "wiggle") state.object.set({ angle: state.angle + Math.sin(offset * 2) * 5 });
          if (state.motion === "pulse") {
            const pulse = 1 + Math.sin(offset) * .055;
            state.object.set({ scaleX: state.scaleX * pulse, scaleY: state.scaleY * pulse });
          }
          if (state.motion === "orbit") state.object.set({ left: state.left + Math.cos(offset) * 12, top: state.top + Math.sin(offset) * 12, angle: state.angle + frame * 360 / frameCount });
          if (state.motion === "draw") state.object.set({ opacity: .55 + (Math.sin(offset - Math.PI / 2) + 1) * .225, scaleX: state.scaleX * (.94 + frame / frameCount * .06) });
          state.object.setCoords();
        }
        canvas.requestRenderAll();
        const rendered = canvas.toCanvasElement(multiplier);
        const context = rendered.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("No se pudo preparar el GIF");
        const image = context.getImageData(0, 0, rendered.width, rendered.height);
        const palette = quantize(image.data, 128, { format: "rgb565" });
        const indexed = applyPalette(image.data, palette, "rgb565");
        gif.writeFrame(indexed, rendered.width, rendered.height, { palette, delay: 75, repeat: 0 });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      gif.finish();
      this.downloadBlob(new Blob([gif.bytes() as BlobPart], { type: "image/gif" }), filename);
    } finally {
      for (const state of states) state.object.set({ left: state.left, top: state.top, scaleX: state.scaleX, scaleY: state.scaleY, angle: state.angle, opacity: state.opacity });
      canvas.requestRenderAll();
    }
  }

  exportSvg(canvas: Canvas, filename: string) {
    this.downloadText(canvas.toSVG(), filename, "image/svg+xml");
  }

  exportJson(scene: SceneDocument, filename: string) {
    this.downloadText(JSON.stringify(scene, null, 2), filename);
  }

  async exportCarouselZip(scenes: SceneDocument[], filename: string) {
    const files: Record<string, Uint8Array> = {};
    for (const [index, scene] of scenes.entries()) {
      const blob = await this.renderer.renderPng(scene);
      files[`${String(index + 1).padStart(2, "0")}-${this.slug(scene.id)}.png`] = new Uint8Array(await blob.arrayBuffer());
    }
    this.downloadBlob(new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: "application/zip" }), filename);
  }

  async exportCarouselPdf(scenes: SceneDocument[], filename: string) {
    const pdf = await PDFDocument.create();
    for (const scene of scenes) {
      const blob = await this.renderer.renderPng(scene);
      const image = await pdf.embedPng(await blob.arrayBuffer());
      const page = pdf.addPage([scene.width, scene.height]);
      page.drawImage(image, { x: 0, y: 0, width: scene.width, height: scene.height });
    }
    this.downloadBlob(new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), filename);
  }

  async exportPack(filename = "polyedro-library.polyedro-pack") {
    const [scenes, templates, assets, projects, cutouts] = await Promise.all([this.library.scenes(), this.library.templates(), this.library.assets(), this.library.projects(), this.library.cutouts()]);
    const files: Record<string, Uint8Array> = {};
    const manifestAssets: PackManifest["assets"] = [];
    for (const asset of assets) {
      const { blob: embeddedBlob, ...metadata } = asset;
      const blob = embeddedBlob ?? await this.library.readLargeBlob(asset.id);
      const blobPath = blob ? `assets/${asset.id}.${asset.format === "jpeg" ? "jpg" : asset.format}` : undefined;
      if (blob && blobPath) files[blobPath] = new Uint8Array(await blob.arrayBuffer());
      manifestAssets.push({ ...metadata, blobPath });
    }
    const manifestCutouts: NonNullable<PackManifest["cutouts"]> = [];
    for (const cutout of cutouts) {
      const { alphaMask, ...metadata } = cutout;
      const maskPath = `cutouts/${cutout.outputAssetId}-mask.png`;
      files[maskPath] = new Uint8Array(await alphaMask.arrayBuffer());
      manifestCutouts.push({ ...metadata, maskPath });
    }
    const manifest: PackManifest = { format: "polyedro-pack", version: 3, exportedAt: new Date().toISOString(), scenes, templates, assets: manifestAssets, projects, cutouts: manifestCutouts };
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    this.downloadBlob(new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: "application/zip" }), filename);
  }

  async importPack(file: File) {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const raw = files["manifest.json"];
    if (!raw) throw new Error("El paquete no contiene manifest.json");
    const manifest = JSON.parse(strFromU8(raw)) as PackManifest;
    if (manifest.format !== "polyedro-pack" || ![1, 2, 3].includes(manifest.version)) throw new Error("Versión de paquete no compatible");
    for (const scene of manifest.scenes) await this.library.saveScene(scene);
    for (const project of manifest.projects ?? []) await this.library.saveProject(project);
    for (const template of manifest.templates) await this.library.saveTemplate(template);
    for (const asset of manifest.assets) {
      const { blobPath, ...metadata } = asset;
      const saved = await this.library.saveAsset(metadata);
      const binary = blobPath ? files[blobPath] : undefined;
      if (binary && saved.id === metadata.id) await this.library.writeLargeBlob(saved.id, new Blob([binary as BlobPart]));
    }
    for (const cutout of manifest.cutouts ?? []) {
      const { maskPath, ...metadata } = cutout;
      const binary = files[maskPath];
      if (binary) await this.library.saveCutout({ ...metadata, alphaMask: new Blob([binary as BlobPart], { type: "image/png" }) });
    }
    return { scenes: manifest.scenes.length, templates: manifest.templates.length, assets: manifest.assets.length, cutouts: manifest.cutouts?.length ?? 0 };
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private slug(value: string) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  }
}
