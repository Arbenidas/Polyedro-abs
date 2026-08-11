import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { CutoutRecord, LibraryAsset } from "./editor.models";
import { CutoutService } from "./cutout.service";
import { morphMask, processMask } from "./cutout-mask";

export type CutoutEditorSource = {
  asset: LibraryAsset;
  blob: Blob;
  existing?: CutoutRecord;
};

export type CutoutSaveEvent = {
  sourceAssetId: string;
  resultBlob: Blob;
  alphaMask: Blob;
  aspectRatio: number;
  outlineColor: string;
  outlineWidth: number;
  shadowBlur: number;
  replace: boolean;
};

@Component({
  selector: "poly-cutout-editor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cutout-editor.component.html",
  styleUrl: "./cutout-editor.component.css",
})
export class CutoutEditorComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) source!: CutoutEditorSource;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<CutoutSaveEvent>();

  @ViewChild("preview", { static: true }) preview!: ElementRef<HTMLCanvasElement>;

  readonly phase = signal<"loading" | "automatic" | "refine" | "saving">("loading");
  readonly status = signal("Preparando la imagen…");
  readonly progress = signal<number | null>(null);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly before = signal(false);
  readonly tool = signal<"erase" | "restore">("erase");

  brushSize = 54;
  edge = 1;
  feather = 1;
  outlineColor = "#F4F4F5";
  outlineWidth = 10;
  shadowBlur = 16;

  private sourcePixels = new Uint8ClampedArray();
  private mask = new Uint8ClampedArray();
  private width = 1;
  private height = 1;
  private painting = false;
  private changedDuringStroke = false;
  private history: Uint8ClampedArray[] = [];
  private historyIndex = -1;
  private abortController?: AbortController;

  constructor(private readonly cutout: CutoutService) {}

  async ngAfterViewInit() {
    await this.loadSource();
    if (this.source.existing) {
      await this.loadExistingMask(this.source.existing);
      this.outlineColor = this.source.existing.outlineColor;
      this.outlineWidth = this.source.existing.outlineWidth;
      this.shadowBlur = this.source.existing.shadowBlur;
      this.phase.set("refine");
      this.status.set("Sticker abierto. Puedes seguir afinando el borde.");
      return;
    }
    await this.runAutomatic();
  }

  ngOnDestroy() {
    this.abortController?.abort();
  }

  setTool(tool: "erase" | "restore") {
    this.tool.set(tool);
  }

  toggleBefore() {
    this.before.update((value) => !value);
    this.render();
  }

  cancelAutomatic() {
    this.abortController?.abort();
    this.phase.set("refine");
    this.status.set("Modo manual activo. Borra el fondo con el pincel.");
    this.progress.set(null);
  }

  beginStroke(event: PointerEvent) {
    if (this.phase() !== "refine") return;
    this.painting = true;
    this.changedDuringStroke = false;
    this.preview.nativeElement.setPointerCapture(event.pointerId);
    this.paint(event);
  }

  continueStroke(event: PointerEvent) {
    if (this.painting) this.paint(event);
  }

  endStroke(event: PointerEvent) {
    if (!this.painting) return;
    this.painting = false;
    if (this.preview.nativeElement.hasPointerCapture(event.pointerId)) this.preview.nativeElement.releasePointerCapture(event.pointerId);
    if (this.changedDuringStroke) this.pushHistory();
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.mask = this.history[this.historyIndex].slice();
    this.syncHistoryState();
    this.render();
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.mask = this.history[this.historyIndex].slice();
    this.syncHistoryState();
    this.render();
  }

  async save(replace: boolean) {
    this.phase.set("saving");
    this.status.set("Preparando el PNG transparente…");
    try {
      const processed = this.processMask();
      const [resultBlob, alphaMask] = await Promise.all([this.composeResult(processed), this.maskBlob(this.mask)]);
      const resultBitmap = await createImageBitmap(resultBlob);
      const aspectRatio = resultBitmap.width / Math.max(1, resultBitmap.height);
      resultBitmap.close();
      this.saved.emit({
        sourceAssetId: this.source.existing?.sourceAssetId ?? this.source.asset.id,
        resultBlob,
        alphaMask,
        aspectRatio,
        outlineColor: this.outlineColor,
        outlineWidth: this.outlineWidth,
        shadowBlur: this.shadowBlur,
        replace,
      });
    } catch (error) {
      this.phase.set("refine");
      this.status.set(error instanceof Error ? error.message : "No se pudo guardar el sticker.");
    }
  }

  private async runAutomatic() {
    this.phase.set("automatic");
    this.abortController = new AbortController();
    try {
      const input = await this.resizedSourceBlob(1400);
      const result = await this.cutout.removeBackground(input, ({ label, progress }) => {
        this.status.set(label);
        this.progress.set(progress === undefined ? null : Math.max(0, Math.min(100, Math.round(progress))));
      }, this.abortController.signal);
      await this.loadSource(result.width, result.height);
      this.mask = new Uint8ClampedArray(result.width * result.height);
      for (let index = 0; index < this.mask.length; index++) this.mask[index] = result.pixels[index * 4 + 3] ?? 255;
      this.resetHistory();
      this.phase.set("refine");
      this.progress.set(null);
      this.status.set("Recorte listo. Borra o restaura zonas antes de guardarlo.");
      this.render();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      this.mask.fill(255);
      this.resetHistory();
      this.phase.set("refine");
      this.progress.set(null);
      this.status.set("El recorte automático no estuvo disponible. Puedes terminarlo manualmente.");
      this.render();
    }
  }

  private async loadSource(targetWidth?: number, targetHeight?: number) {
    const bitmap = await createImageBitmap(this.source.blob);
    const scale = targetWidth && targetHeight ? 1 : Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    this.width = targetWidth ?? Math.max(1, Math.round(bitmap.width * scale));
    this.height = targetHeight ?? Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(bitmap, 0, 0, this.width, this.height);
    bitmap.close();
    this.sourcePixels = context.getImageData(0, 0, this.width, this.height).data;
    this.mask = new Uint8ClampedArray(this.width * this.height);
    this.mask.fill(255);
    this.preview.nativeElement.width = this.width;
    this.preview.nativeElement.height = this.height;
    this.resetHistory();
    this.render();
  }

  private async loadExistingMask(record: CutoutRecord) {
    const bitmap = await createImageBitmap(record.alphaMask);
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(bitmap, 0, 0, this.width, this.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, this.width, this.height).data;
    this.mask = new Uint8ClampedArray(this.width * this.height);
    for (let index = 0; index < this.mask.length; index++) this.mask[index] = pixels[index * 4 + 3] ?? pixels[index * 4] ?? 255;
    this.resetHistory();
    this.render();
  }

  private paint(event: PointerEvent) {
    const canvas = this.preview.nativeElement;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    const radius = this.brushSize / 2;
    const minX = Math.max(0, Math.floor(x - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(y + radius));
    const restore = this.tool() === "restore";
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const distance = Math.hypot(px - x, py - y);
        if (distance > radius) continue;
        const strength = Math.min(1, (radius - distance) / Math.max(1, radius * .22));
        const index = py * this.width + px;
        this.mask[index] = restore
          ? Math.max(this.mask[index], Math.round(255 * strength))
          : Math.min(this.mask[index], Math.round(255 * (1 - strength)));
      }
    }
    this.changedDuringStroke = true;
    this.render();
  }

  private render() {
    const canvas = this.preview.nativeElement;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || this.sourcePixels.length !== this.width * this.height * 4) return;
    const pixels = new Uint8ClampedArray(this.sourcePixels);
    if (!this.before()) {
      for (let index = 0; index < this.mask.length; index++) pixels[index * 4 + 3] = Math.min(pixels[index * 4 + 3] ?? 255, this.mask[index]);
    }
    context.putImageData(new ImageData(pixels, this.width, this.height), 0, 0);
  }

  private processMask() {
    return processMask(this.mask, this.width, this.height, this.edge, this.feather);
  }

  private async composeResult(mask: Uint8ClampedArray<ArrayBuffer>) {
    const padding = Math.ceil(this.outlineWidth + this.shadowBlur * 1.8 + 4);
    const subject = document.createElement("canvas");
    subject.width = this.width;
    subject.height = this.height;
    const subjectContext = subject.getContext("2d");
    if (!subjectContext) throw new Error("No se pudo componer el sticker.");
    const subjectPixels = new Uint8ClampedArray(this.sourcePixels);
    for (let index = 0; index < mask.length; index++) subjectPixels[index * 4 + 3] = Math.min(subjectPixels[index * 4 + 3] ?? 255, mask[index]);
    subjectContext.putImageData(new ImageData(subjectPixels, this.width, this.height), 0, 0);

    let outlineMask = mask;
    for (let pass = 0; pass < Math.min(18, Math.round(this.outlineWidth)); pass++) outlineMask = morphMask(outlineMask, this.width, this.height, true);
    const outline = document.createElement("canvas");
    outline.width = this.width;
    outline.height = this.height;
    const outlineContext = outline.getContext("2d");
    if (!outlineContext) throw new Error("No se pudo crear el contorno.");
    const rgb = this.hexToRgb(this.outlineColor);
    const outlinePixels = new Uint8ClampedArray(this.width * this.height * 4);
    for (let index = 0; index < outlineMask.length; index++) {
      outlinePixels[index * 4] = rgb[0];
      outlinePixels[index * 4 + 1] = rgb[1];
      outlinePixels[index * 4 + 2] = rgb[2];
      outlinePixels[index * 4 + 3] = outlineMask[index];
    }
    outlineContext.putImageData(new ImageData(outlinePixels, this.width, this.height), 0, 0);

    const output = document.createElement("canvas");
    output.width = this.width + padding * 2;
    output.height = this.height + padding * 2;
    const context = output.getContext("2d");
    if (!context) throw new Error("No se pudo exportar el sticker.");
    if (this.shadowBlur > 0) {
      context.save();
      context.shadowColor = "rgba(0,0,0,.45)";
      context.shadowBlur = this.shadowBlur;
      context.shadowOffsetY = Math.max(2, this.shadowBlur * .35);
      context.drawImage(subject, padding, padding);
      context.restore();
    }
    context.drawImage(outline, padding, padding);
    context.drawImage(subject, padding, padding);
    return this.canvasBlob(output);
  }

  private async maskBlob(mask: Uint8ClampedArray<ArrayBuffer>) {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo guardar la máscara.");
    const pixels = new Uint8ClampedArray(this.width * this.height * 4);
    for (let index = 0; index < mask.length; index++) {
      pixels[index * 4] = 255;
      pixels[index * 4 + 1] = 255;
      pixels[index * 4 + 2] = 255;
      pixels[index * 4 + 3] = mask[index];
    }
    context.putImageData(new ImageData(pixels, this.width, this.height), 0, 0);
    return this.canvasBlob(canvas);
  }

  private async resizedSourceBlob(maxSize: number) {
    const bitmap = await createImageBitmap(this.source.blob);
    if (Math.max(bitmap.width, bitmap.height) <= maxSize) {
      bitmap.close();
      return this.source.blob;
    }
    const scale = maxSize / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return this.canvasBlob(canvas);
  }

  private canvasBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("El navegador no pudo crear el PNG.")), "image/png"));
  }

  private resetHistory() {
    this.history = [this.mask.slice()];
    this.historyIndex = 0;
    this.syncHistoryState();
  }

  private pushHistory() {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(this.mask.slice());
    if (this.history.length > 20) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.syncHistoryState();
  }

  private syncHistoryState() {
    this.canUndo.set(this.historyIndex > 0);
    this.canRedo.set(this.historyIndex < this.history.length - 1);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const value = hex.replace("#", "");
    const normalized = value.length === 3 ? value.split("").map((item) => item + item).join("") : value.padEnd(6, "0");
    return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)];
  }
}
