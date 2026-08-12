import { CommonModule } from "@angular/common";
import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output,
  SimpleChanges, ViewChild, computed, signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
  ActiveSelection, Canvas, Circle, Ellipse, FabricImage, FabricObject, Group, Line, Rect,
  Shadow, Textbox, Triangle, filters,
} from "fabric/es";
import type { ContentChannel, EditorialBrand, EditorialSlide } from "../../editorial.models";
import { GenerationService } from "../generation/generation.service";
import { CURATED_ASSETS, editorialPrimitiveAssets } from "./asset-catalog";
import { analyzeContext, detectEnrichmentProfile, isReusableAsset, rankAssets, type EnrichmentProfile } from "./context-resolver";
import { stripLegacyContextualOrnament } from "./contextual-vector-variation";
import {
  buildLocalVisualIntent, compileBlueprintSvg, createVisualBlueprint, normalizeVisualIntent, recolorVisualBlueprint, visualSource,
} from "./contextual-visual-planner";
import { applyPaletteToScene, COLOR_PALETTES, DEFAULT_EDITOR_PALETTE, findPaletteId, type ColorPaletteDefinition } from "./color-palettes";
import { CutoutEditorComponent, type CutoutEditorSource, type CutoutSaveEvent } from "./cutout-editor.component";
import type {
  EditorialTemplate, ImageFilterMode, ImageFramePreset, LibraryAsset, MotionPreset, SceneDocument, SceneElement, StorageStatus,
  VisualBlueprint, VisualGenerationMode, VisualIntent, VisualRole,
} from "./editor.models";
import { CHANNEL_SIZES } from "./editor.models";
import { ExportService } from "./export.service";
import { EditorialRasterFilter } from "./editorial-raster-filter";
import { LocalLibraryService } from "./local-library.service";
import { VideoToGifService } from "./video-to-gif.service";
import {
  compileManualAssetSvg, createManualAssetDocument, createManualAssetElement, manualAssetArrowPoints, manualAssetPaint,
  manualAssetPathData, manualAssetPatternId, manualAssetRotation, manualAssetStarPoints, normalizeManualAssetDocument,
  type ManualAssetDocument, type ManualAssetElement, type ManualAssetElementType, type ManualAssetPattern,
} from "./manual-asset-builder";
import { createScene } from "./scene.factory";
import { compileVectorAssetSvg } from "./sticker-library";
import { inferContentTypesFromText, inferTemplateUsage, rankTemplatesForContext } from "./template-matcher";
import { createTemplateSceneSnapshot, templateCharacteristics, templateSlotsFromScene } from "./template-snapshot";
import { TEMPLATE_CATALOG_VERSION, templateCatalog } from "./template-catalog";
import { SceneThumbnailComponent } from "./scene-thumbnail.component";

type PolyObject = FabricObject & {
  polyId?: string;
  polyType?: SceneElement["type"];
  polyAssetId?: string;
  polyName?: string;
  polySvg?: string;
  polySrc?: string;
  polyMotion?: MotionPreset;
  polyImageFrame?: ImageFramePreset;
  polyImageBlur?: number;
  polyImageBrightness?: number;
  polyImageContrast?: number;
  polyImageSaturation?: number;
  polyImagePixelate?: number;
  polyImageNoise?: number;
  polyImageFilterMode?: ImageFilterMode;
  polyImageFit?: "contain" | "cover";
  polyIsBackground?: boolean;
  polyRadius?: number;
  polyGeneratedVisualId?: string;
  polyVisualRole?: VisualRole;
};
type Panel = "layers" | "templates" | "collage";
type ImageEffectPreset = "original" | "dark" | "soft" | "vivid" | "mono" | "bitmap" | "halftone" | "mosaic" | "cross-stitch" | "grain" | "sepia";
type VisualFeedback = { tone: "neutral" | "working" | "success" | "error"; message: string };
type ManualAssetTool = "select" | "pen" | ManualAssetElementType;
type ManualAssetResizeHandle = "nw" | "ne" | "sw" | "se";
type ManualAssetInteraction = {
  mode: "move" | "resize" | "draw" | "pen";
  id: string;
  startX: number;
  startY: number;
  origin: ManualAssetElement;
  handle?: ManualAssetResizeHandle;
};

@Component({
  selector: "poly-editor-workspace",
  standalone: true,
  imports: [CommonModule, FormsModule, SceneThumbnailComponent, CutoutEditorComponent],
  templateUrl: "./editor-workspace.component.html",
  styleUrl: "./editor-workspace.component.css",
})
export class EditorWorkspaceComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) slide!: EditorialSlide;
  @Input({ required: true }) brand!: EditorialBrand;
  @Input({ required: true }) channel!: ContentChannel;
  @Output() readonly sceneChanged = new EventEmitter<SceneDocument>();
  @ViewChild("canvasElement") canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild("canvasFrame") canvasFrame!: ElementRef<HTMLDivElement>;
  @ViewChild("stage") stage!: ElementRef<HTMLDivElement>;
  @ViewChild("imageInput") imageInput!: ElementRef<HTMLInputElement>;
  @ViewChild("referenceInput") referenceInput!: ElementRef<HTMLInputElement>;
  @ViewChild("backgroundInput") backgroundInput!: ElementRef<HTMLInputElement>;
  @ViewChild("videoInput") videoInput!: ElementRef<HTMLInputElement>;
  @ViewChild("packInput") packInput!: ElementRef<HTMLInputElement>;
  @ViewChild("manualAssetSvgElement") manualAssetSvgElement?: ElementRef<SVGSVGElement>;

  readonly panel = signal<Panel>("templates");
  readonly scene = signal<SceneDocument | null>(null);
  readonly selected = signal<SceneElement | null>(null);
  readonly selectedIds = signal<string[]>([]);
  readonly assets = signal<LibraryAsset[]>([]);
  readonly assetPreviews = signal<Record<string, string>>({});
  readonly templates = signal<EditorialTemplate[]>([]);
  readonly templateSaveOpen = signal(false);
  readonly templateName = signal("");
  readonly templateUsageNote = signal("");
  readonly templateRole = signal<EditorialTemplate["slideRole"]>("step");
  readonly cutoutSource = signal<CutoutEditorSource | null>(null);
  readonly storage = signal<StorageStatus>({ usage: 0, quota: 0, persistent: false });
  readonly status = signal("Preparando editor local…");
  readonly zoom = signal(100);
  readonly enriching = signal(false);
  readonly assetBuilderOpen = signal(false);
  readonly manualAssetName = signal("Mi asset SVG");
  readonly manualAsset = signal<ManualAssetDocument>(createManualAssetDocument(DEFAULT_EDITOR_PALETTE));
  readonly selectedManualAssetId = signal<string | null>(null);
  readonly manualAssetTool = signal<ManualAssetTool>("select");
  readonly manualAssetZoom = signal(120);
  readonly manualAssetCanUndo = signal(false);
  readonly manualAssetCanRedo = signal(false);
  readonly manualAssetSvg = computed(() => compileManualAssetSvg(this.manualAsset()));
  readonly selectedManualAsset = computed(() => this.manualAsset().elements.find((item) => item.id === this.selectedManualAssetId()) ?? null);
  readonly manualAssetLayers = computed(() => [...this.manualAsset().elements].reverse());
  readonly manualAssetSwatches = computed(() => [...new Set([...this.activePalette(), "#FFFFFF", "#10251E", "#FFCD57", "#F04B61"])]);
  readonly assetPrompt = signal("");
  readonly visualGenerationMode = signal<VisualGenerationMode>("auto");
  readonly visualStage = signal<"idle" | "interpreting" | "diagram" | "image">("idle");
  readonly visualFeedback = signal<VisualFeedback>({
    tone: "neutral",
    message: "Automático conserva cifras y relaciones como capas; Imagen IA crea un recurso nuevo sin texto incrustado.",
  });
  readonly exportingGif = signal(false);
  readonly convertingVideo = signal<number | null>(null);
  readonly regenerating = signal(false);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly paletteLibrary = COLOR_PALETTES;
  readonly activePalette = signal<string[]>([...DEFAULT_EDITOR_PALETTE]);
  readonly activePaletteId = signal("arbe-dark");
  readonly analysis = computed(() => analyzeContext(`${this.slide?.headline ?? ""} ${this.slide?.body ?? ""}`));
  readonly layers = computed(() => [...(this.scene()?.elements ?? [])].reverse());
  readonly storagePercent = computed(() => this.storage().quota ? Math.round(this.storage().usage / this.storage().quota * 100) : 0);
  readonly builtinTemplates = computed(() => this.templates().filter((item) => item.source === "builtin"));
  readonly userTemplates = computed(() => this.templates().filter((item) => item.source === "user"));
  readonly favoriteTemplates = computed(() => this.templates().filter((item) => item.favorite));
  readonly stickerAssets = computed(() => this.assets().filter((item) => item.kind === "sticker"));
  readonly canCreateSticker = computed(() => this.selected()?.type === "image" && !this.selected()?.isBackground);
  readonly selectedGeneratedVisualId = computed(() => this.selected()?.generatedVisualId);
  readonly hasGeneratedVisualSelection = computed(() => {
    const ids = new Set(this.selectedIds());
    return Boolean(this.scene()?.elements.some((item) => ids.has(item.id) && item.generatedVisualId));
  });
  readonly inferredTemplateUsage = computed(() => {
    const scene = this.scene();
    if (!scene || !this.slide) return null;
    return inferTemplateUsage(this.slide, scene, this.templateRole(), this.templateUsageNote());
  });
  readonly recommendedTemplates = computed(() => {
    const role = this.slide?.slide_order === 1 ? "cover" : "step";
    const source = `${this.slide?.headline ?? ""} ${this.slide?.body ?? ""}`;
    return rankTemplatesForContext(this.templates(), {
      channel: this.channel,
      role,
      contentType: inferContentTypesFromText(source)[0],
      headline: this.slide?.headline ?? "",
      body: this.slide?.body ?? "",
      hasAssets: Boolean(this.scene()?.elements.some((item) => ["image", "svg"].includes(item.type))),
    }).slice(0, 6).map((item) => item.template);
  });

  private canvas?: Canvas;
  private resizeObserver?: ResizeObserver;
  private baseScale = .5;
  private applying = false;
  private saveTimer?: number;
  private history: SceneDocument[] = [];
  private historyIndex = -1;
  private clipboard?: SceneElement[];
  private manualAssetDrag?: ManualAssetInteraction;
  private manualAssetHistory: ManualAssetDocument[] = [];
  private manualAssetHistoryIndex = -1;
  private lastImageGenerationError = "";
  private lastVisualSource: "selection" | "prompt" = "selection";
  private readonly previewCache = new Map<string, SceneDocument>();
  private readonly assetObjectUrls = new Map<string, string>();

  constructor(
    private readonly library: LocalLibraryService,
    private readonly exporter: ExportService,
    private readonly generation: GenerationService,
    private readonly videoToGif: VideoToGifService,
    private readonly router: Router,
  ) {}

  private activeBrand(): EditorialBrand {
    return { ...this.brand, palette: [...this.activePalette()] };
  }

  async ngAfterViewInit() {
    this.canvas = new Canvas(this.canvasElement.nativeElement, {
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: "#F2F0E4",
      fireRightClick: true,
      stopContextMenu: true,
    });
    this.registerCanvasEvents();
    this.resizeObserver = new ResizeObserver(() => this.fitCanvas());
    this.resizeObserver.observe(this.stage.nativeElement);
    await this.initializeLocalData();
    await this.loadSlide();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes["slide"]?.firstChange && this.canvas) void this.loadSlide();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.canvas?.dispose();
    this.assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  setPanel(panel: Panel) { this.panel.set(panel); }
  assetPreview(asset: LibraryAsset) { return this.assetPreviews()[asset.id]; }
  assetVisualUrl(asset: LibraryAsset) {
    const preview = this.assetPreview(asset);
    return preview ?? (asset.svg ? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(stripLegacyContextualOrnament(asset.svg))}` : undefined);
  }
  formatBytes(value: number) { return value ? `${(value / 1024 / 1024).toFixed(value > 1024 * 1024 * 1024 ? 0 : 1)} MB` : "0 MB"; }

  addText(kind: "headline" | "body" = "headline") {
    const scene = this.scene();
    if (!scene || !this.canvas) return;
    const element: SceneElement = {
      id: crypto.randomUUID(), type: "text", name: kind === "headline" ? "Nuevo titular" : "Nuevo texto",
      content: kind === "headline" ? "Escribe una idea" : "Añade contexto, pasos o una conclusión.",
      x: 100, y: kind === "headline" ? 220 : 540, width: scene.width - 200, height: 160,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length,
      visible: true, locked: false, fill: this.activePalette()[2] ?? "#F2F0E4",
      fontFamily: "Arial", fontSize: kind === "headline" ? 104 : 42, fontWeight: kind === "headline" ? 900 : 500,
      textAlign: "left", lineHeight: 1, charSpacing: kind === "headline" ? -20 : 0,
    };
    this.addElement(element, true);
  }

  addShape(type: "rect" | "circle") {
    const scene = this.scene();
    if (!scene) return;
    this.addElement({ id: crypto.randomUUID(), type, name: type === "rect" ? "Rectángulo" : "Círculo", x: 160, y: 400, width: 300, height: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length, visible: true, locked: false, fill: this.activePalette()[1] ?? "#D94E1E", stroke: "#0A0A0A", strokeWidth: 0 }, true);
  }

  addArrow() {
    const scene = this.scene();
    if (!scene) return;
    this.addElement({ id: crypto.randomUUID(), type: "arrow", name: "Flecha", x: 200, y: 520, width: 220, height: 120, scaleX: 1, scaleY: 1, rotation: -10, opacity: 1, zIndex: scene.elements.length, visible: true, locked: false, fill: this.activePalette()[1], stroke: this.activePalette()[1], strokeWidth: 10 }, true);
  }

  openAssetBuilder() {
    const document = createManualAssetDocument(this.activePalette());
    this.manualAsset.set(document);
    this.manualAssetName.set("Mi asset SVG");
    this.selectedManualAssetId.set(document.elements[0]?.id ?? null);
    this.manualAssetTool.set("select");
    this.manualAssetZoom.set(120);
    this.resetManualAssetHistory(document);
    this.assetBuilderOpen.set(true);
    this.status.set("Editor SVG abierto. Dibuja, ordena capas y guarda el resultado en tu biblioteca.");
  }

  closeAssetBuilder() { this.assetBuilderOpen.set(false); }
  setManualAssetName(value: string) { this.manualAssetName.set(value.slice(0, 60)); }

  setManualAssetTool(tool: ManualAssetTool) { this.manualAssetTool.set(tool); }

  setManualAssetZoom(value: number) {
    this.manualAssetZoom.set(Math.max(25, Math.min(240, Math.round(value))));
  }

  zoomManualAssetWithWheel(event: WheelEvent) {
    if (!event.metaKey && !event.ctrlKey) return;
    event.preventDefault();
    this.setManualAssetZoom(this.manualAssetZoom() + (event.deltaY < 0 ? 10 : -10));
  }

  private resetManualAssetHistory(document: ManualAssetDocument) {
    this.manualAssetHistory = [structuredClone(normalizeManualAssetDocument(document))];
    this.manualAssetHistoryIndex = 0;
    this.updateManualAssetHistoryState();
  }

  private recordManualAssetHistory() {
    const snapshot = structuredClone(normalizeManualAssetDocument(this.manualAsset()));
    const current = this.manualAssetHistory[this.manualAssetHistoryIndex];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
    this.manualAssetHistory = [...this.manualAssetHistory.slice(0, this.manualAssetHistoryIndex + 1), snapshot].slice(-60);
    this.manualAssetHistoryIndex = this.manualAssetHistory.length - 1;
    this.updateManualAssetHistoryState();
  }

  private updateManualAssetHistoryState() {
    this.manualAssetCanUndo.set(this.manualAssetHistoryIndex > 0);
    this.manualAssetCanRedo.set(this.manualAssetHistoryIndex >= 0 && this.manualAssetHistoryIndex < this.manualAssetHistory.length - 1);
  }

  undoManualAsset() {
    if (!this.manualAssetCanUndo()) return;
    this.manualAssetHistoryIndex -= 1;
    this.manualAsset.set(structuredClone(this.manualAssetHistory[this.manualAssetHistoryIndex]));
    this.selectedManualAssetId.set(this.manualAsset().elements.at(-1)?.id ?? null);
    this.updateManualAssetHistoryState();
  }

  redoManualAsset() {
    if (!this.manualAssetCanRedo()) return;
    this.manualAssetHistoryIndex += 1;
    this.manualAsset.set(structuredClone(this.manualAssetHistory[this.manualAssetHistoryIndex]));
    this.selectedManualAssetId.set(this.manualAsset().elements.at(-1)?.id ?? null);
    this.updateManualAssetHistoryState();
  }

  setManualAssetSize(width: number, height: number) {
    this.manualAsset.update((document) => normalizeManualAssetDocument({ ...document, width, height }));
    this.recordManualAssetHistory();
  }

  addManualAssetElement(type: ManualAssetElementType) {
    const document = this.manualAsset();
    const element = createManualAssetElement(type, document, this.activePalette());
    this.manualAsset.set({ ...document, elements: [...document.elements, element] });
    this.selectedManualAssetId.set(element.id);
    this.manualAssetTool.set("select");
    this.recordManualAssetHistory();
  }

  selectManualAssetElement(id: string) { this.selectedManualAssetId.set(id); }

  manualAssetPaint(element: ManualAssetElement) { return manualAssetPaint(element); }
  manualAssetPatternId(element: ManualAssetElement) { return manualAssetPatternId(element); }
  manualAssetRotation(element: ManualAssetElement) { return manualAssetRotation(element); }
  manualAssetArrowPoints(element: ManualAssetElement) { return manualAssetArrowPoints(element); }
  manualAssetStarPoints(element: ManualAssetElement) { return manualAssetStarPoints(element); }
  manualAssetPathData(element: ManualAssetElement) { return manualAssetPathData(element); }
  manualAssetArrowHead(element: ManualAssetElement) { return Math.min(element.height, Math.max(22, element.width * .22)); }
  manualAssetArrowBodyEnd(element: ManualAssetElement) { return element.x + element.width - this.manualAssetArrowHead(element) * .72; }
  manualAssetCenterY(element: ManualAssetElement) { return element.y + element.height / 2; }
  manualAssetLinePaint(element: ManualAssetElement) { return ["solid", "outline"].includes(element.pattern) ? element.stroke : manualAssetPaint(element); }

  setManualAssetPattern(pattern: ManualAssetPattern) {
    this.updateManualAssetElement("pattern", pattern);
  }

  private manualAssetPoint(event: PointerEvent) {
    const svg = this.manualAssetSvgElement?.nativeElement;
    const bounds = svg?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: (event.clientX - bounds.left) * this.manualAsset().width / Math.max(1, bounds.width),
      y: (event.clientY - bounds.top) * this.manualAsset().height / Math.max(1, bounds.height),
    };
  }

  beginManualAssetCanvas(event: PointerEvent) {
    const target = event.target as Element | null;
    if (target?.closest?.("[data-builder-id], .builder-selection")) return;
    const tool = this.manualAssetTool();
    if (tool === "select") {
      this.selectedManualAssetId.set(null);
      return;
    }
    const point = this.manualAssetPoint(event);
    const document = this.manualAsset();
    const type: ManualAssetElementType = tool === "pen" ? "path" : tool;
    let element = createManualAssetElement(type, document, this.activePalette());
    if (type === "text") {
      element = { ...element, x: point.x, y: point.y - (element.fontSize ?? 42) };
      this.manualAsset.set({ ...document, elements: [...document.elements, element] });
      this.selectedManualAssetId.set(element.id);
      this.manualAssetTool.set("select");
      this.recordManualAssetHistory();
      return;
    }
    element = type === "path"
      ? { ...element, x: point.x, y: point.y, width: 1, height: 1, points: [point] }
      : { ...element, x: point.x, y: point.y, width: 1, height: type === "line" ? 1 : 2, rotation: 0 };
    this.manualAsset.set({ ...document, elements: [...document.elements, element] });
    this.selectedManualAssetId.set(element.id);
    this.manualAssetDrag = { mode: type === "path" ? "pen" : "draw", id: element.id, startX: point.x, startY: point.y, origin: structuredClone(element) };
    event.preventDefault();
  }

  beginManualAssetDrag(event: PointerEvent, element: ManualAssetElement) {
    if (element.locked || element.visible === false) return;
    const point = this.manualAssetPoint(event);
    this.selectedManualAssetId.set(element.id);
    this.manualAssetTool.set("select");
    this.manualAssetDrag = { mode: "move", id: element.id, startX: point.x, startY: point.y, origin: structuredClone(element) };
    event.preventDefault();
    event.stopPropagation();
  }

  beginManualAssetResize(event: PointerEvent, handle: ManualAssetResizeHandle, element: ManualAssetElement) {
    if (element.locked) return;
    const point = this.manualAssetPoint(event);
    this.manualAssetDrag = { mode: "resize", id: element.id, startX: point.x, startY: point.y, origin: structuredClone(element), handle };
    event.preventDefault();
    event.stopPropagation();
  }

  updateManualAssetElement(property: keyof ManualAssetElement, value: string | number) {
    const id = this.selectedManualAssetId();
    if (!id) return;
    const numericProperties: Array<keyof ManualAssetElement> = ["x", "y", "width", "height", "rotation", "strokeWidth", "radius", "fontSize", "fontWeight", "patternScale"];
    this.manualAsset.update((document) => normalizeManualAssetDocument({
      ...document,
      elements: document.elements.map((element) => element.id === id
        ? { ...element, [property]: numericProperties.includes(property) ? Number(value) : String(value) }
        : element),
    }));
    this.recordManualAssetHistory();
  }

  nudgeManualAsset(dx: number, dy: number) {
    const element = this.selectedManualAsset();
    if (!element) return;
    this.manualAsset.update((document) => ({ ...document, elements: document.elements.map((item) => item.id === element.id ? {
      ...item, x: item.x + dx, y: item.y + dy,
      points: item.points?.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    } : item) }));
    this.recordManualAssetHistory();
  }

  @HostListener("window:pointermove", ["$event"])
  onManualAssetPointerMove(event: PointerEvent) {
    const drag = this.manualAssetDrag;
    if (!drag) return;
    const point = this.manualAssetPoint(event);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    let next = structuredClone(drag.origin);
    if (drag.mode === "move") {
      next = { ...next, x: drag.origin.x + dx, y: drag.origin.y + dy, points: drag.origin.points?.map((item) => ({ x: item.x + dx, y: item.y + dy })) };
    } else if (drag.mode === "pen") {
      const points = [...(this.manualAsset().elements.find((item) => item.id === drag.id)?.points ?? [])];
      const previous = points.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 2) points.push(point);
      const xs = points.map((item) => item.x);
      const ys = points.map((item) => item.y);
      next = { ...next, points, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
    } else if (drag.mode === "draw") {
      if (["line", "arrow"].includes(next.type)) {
        const distance = Math.max(4, Math.hypot(dx, dy));
        const height = next.type === "arrow" ? 48 : 1;
        next = { ...next, x: (drag.startX + point.x) / 2 - distance / 2, y: (drag.startY + point.y) / 2 - height / 2, width: distance, height, rotation: Math.atan2(dy, dx) * 180 / Math.PI };
      } else {
        next = { ...next, x: Math.min(drag.startX, point.x), y: Math.min(drag.startY, point.y), width: Math.max(4, Math.abs(dx)), height: Math.max(4, Math.abs(dy)) };
      }
    } else if (drag.mode === "resize" && drag.handle) {
      const left = drag.handle.includes("w") ? Math.min(point.x, drag.origin.x + drag.origin.width - 4) : drag.origin.x;
      const top = drag.handle.includes("n") ? Math.min(point.y, drag.origin.y + drag.origin.height - 4) : drag.origin.y;
      const right = drag.handle.includes("e") ? Math.max(point.x, drag.origin.x + 4) : drag.origin.x + drag.origin.width;
      const bottom = drag.handle.includes("s") ? Math.max(point.y, drag.origin.y + 4) : drag.origin.y + drag.origin.height;
      const width = Math.max(4, right - left);
      const height = Math.max(4, bottom - top);
      next = {
        ...next, x: left, y: top, width, height,
        points: drag.origin.points?.map((item) => ({
          x: left + (item.x - drag.origin.x) / Math.max(1, drag.origin.width) * width,
          y: top + (item.y - drag.origin.y) / Math.max(1, drag.origin.height) * height,
        })),
      };
    }
    this.manualAsset.update((document) => ({ ...document, elements: document.elements.map((item) => item.id === drag.id ? next : item) }));
  }

  @HostListener("window:pointerup")
  endManualAssetDrag() {
    if (!this.manualAssetDrag) return;
    const completedTool = this.manualAssetDrag.mode;
    this.manualAssetDrag = undefined;
    this.recordManualAssetHistory();
    if (completedTool !== "pen") this.manualAssetTool.set("select");
  }

  duplicateManualAssetElement() {
    const element = this.selectedManualAsset();
    if (!element) return;
    const copy = { ...structuredClone(element), id: crypto.randomUUID(), name: `${element.name} copia`, x: element.x + 18, y: element.y + 18 };
    this.manualAsset.update((document) => ({ ...document, elements: [...document.elements, copy] }));
    this.selectedManualAssetId.set(copy.id);
    this.recordManualAssetHistory();
  }

  removeManualAssetElement() {
    const id = this.selectedManualAssetId();
    if (!id) return;
    this.manualAsset.update((document) => ({ ...document, elements: document.elements.filter((item) => item.id !== id) }));
    this.selectedManualAssetId.set(this.manualAsset().elements.at(-1)?.id ?? null);
    this.recordManualAssetHistory();
  }

  applyManualAssetColor(color: string, target: "fill" | "stroke" = "fill") {
    this.updateManualAssetElement(target, color);
  }

  moveManualAssetLayer(id: string, direction: -1 | 1) {
    this.manualAsset.update((document) => {
      const elements = [...document.elements];
      const index = elements.findIndex((element) => element.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= elements.length) return document;
      [elements[index], elements[target]] = [elements[target], elements[index]];
      return { ...document, elements };
    });
    this.recordManualAssetHistory();
  }

  toggleManualAssetVisibility(id: string) {
    this.manualAsset.update((document) => ({ ...document, elements: document.elements.map((element) => element.id === id ? { ...element, visible: element.visible === false } : element) }));
    this.recordManualAssetHistory();
  }

  toggleManualAssetLock(id: string) {
    this.manualAsset.update((document) => ({ ...document, elements: document.elements.map((element) => element.id === id ? { ...element, locked: !element.locked } : element) }));
    this.recordManualAssetHistory();
  }

  manualAssetTypeIcon(type: ManualAssetElementType) {
    return ({ rect: "□", circle: "○", line: "—", arrow: "→", star: "★", path: "✎", text: "T" } as const)[type];
  }

  async saveManualAsset(insertAfterSave = false) {
    const document = normalizeManualAssetDocument(this.manualAsset());
    if (!document.elements.length) return void this.status.set("Añade al menos una forma antes de guardar el SVG.");
    const svg = compileManualAssetSvg(document);
    const name = this.manualAssetName().trim() || "Asset SVG sin título";
    const asset: LibraryAsset = {
      id: crypto.randomUUID(), name,
      kind: document.elements.every((item) => ["arrow", "line"].includes(item.type)) ? "arrow" : "icon",
      format: "svg", source: "user", scope: "atomic", themes: this.analysis().concepts,
      tags: ["manual", "svg", ...document.elements.map((item) => item.type)], style: "user-vector",
      colors: [...new Set(document.elements.flatMap((item) => [item.fill, item.stroke]).filter((color) => color !== "transparent"))],
      aspectRatio: document.width / document.height, compatibleBackgrounds: ["light", "dark", "color"],
      hash: await this.hash(svg), useCount: 0, createdAt: new Date().toISOString(), version: 1, svg,
    };
    const saved = await this.library.saveAsset(asset, { deduplicate: false });
    await this.refreshLibrary();
    if (insertAfterSave) await this.insertAsset(saved);
    this.assetBuilderOpen.set(false);
    this.status.set(insertAfterSave ? `“${name}” se guardó y se añadió al canvas.` : `“${name}” se guardó en tu biblioteca SVG.`);
  }

  async insertAsset(asset: LibraryAsset) {
    const scene = this.scene();
    if (!scene || !this.canvas) return;
    const active = this.canvas.getActiveObject() as PolyObject | undefined;
    const slot = active && this.isAssetSlot(active) ? active : undefined;
    if (slot) {
      const bounds = slot.getBoundingRect();
      const ratio = Math.max(.25, asset.aspectRatio || 1);
      const width = Math.min(bounds.width * .86, bounds.height * .86 * ratio);
      const height = width / ratio;
      const x = bounds.left + (bounds.width - width) / 2;
      const y = bounds.top + (bounds.height - height) / 2;
      this.removeAssetSlot(slot);
      await this.insertAssetAt(asset, x, y, width, true);
      this.status.set(`“${asset.name}” reemplazó el slot y sigue siendo una capa editable.`);
      return;
    }
    const width = asset.blueprint ? Math.min(620, scene.width * .58) : asset.kind === "logo" ? Math.min(230, scene.width * .22) : Math.min(320, scene.width * .3);
    const height = width / Math.max(.25, asset.aspectRatio || 1);
    await this.insertAssetAt(asset, (scene.width - width) / 2, (scene.height - height) / 2, width, true);
  }

  async deleteLibraryAsset(asset: LibraryAsset, event: Event) {
    event.stopPropagation();
    if (asset.source !== "user") return;
    await this.library.deleteAsset(asset.id);
    await this.refreshLibrary();
    this.status.set(`“${asset.name}” se eliminó de la biblioteca. Las escenas que ya lo usan permanecen intactas.`);
  }

  private isAssetSlot(object: PolyObject) {
    return object.polyName === "Slot de asset · reemplázame" || object.polyName === "Contexto tecnológico · panel" || object.polyName === "Contexto Git · panel" || object.polyName === "Contexto aprendizaje · panel";
  }

  private removeAssetSlot(slot: PolyObject) {
    if (!this.canvas) return;
    const labels = this.canvas.getObjects().filter((item) => {
      const name = (item as PolyObject).polyName;
      return name === "Asset pendiente" || name?.startsWith("Contexto tecnológico ·") || name?.startsWith("Contexto Git ·") || name?.startsWith("Contexto aprendizaje ·");
    });
    this.canvas.remove(slot, ...labels.filter((item) => item !== slot));
    this.canvas.discardActiveObject();
  }

  private async insertAssetAt(asset: LibraryAsset, x: number, y: number, width: number, commit: boolean) {
    const scene = this.scene();
    if (!scene) return false;
    if (asset.blueprint) return this.insertBlueprintAt(asset, asset.blueprint, x, y, width, commit);
    let element: SceneElement | undefined;
    if (asset.svg) {
      element = { id: crypto.randomUUID(), type: "svg", name: asset.name, x, y, width, height: width / Math.max(.25, asset.aspectRatio), scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length, visible: true, locked: false, assetId: asset.id, svg: asset.svg, motion: asset.motion };
    } else {
      const blob = await this.library.readLargeBlob(asset.id);
      if (!blob) {
        this.status.set(`No encontramos el archivo original de “${asset.name}”.`);
        return false;
      }
      const src = await this.blobToDataUrl(blob);
      const framed = asset.kind === "screenshot";
      const sticker = asset.kind === "sticker";
      element = {
        id: crypto.randomUUID(), type: "image", name: asset.name, x, y, width, height: width / Math.max(.25, asset.aspectRatio),
        scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length, visible: true, locked: false,
        assetId: asset.id, src, imageFrame: sticker ? "sticker" : framed ? "window" : "clean", radius: framed ? 8 : 0,
        stroke: sticker ? undefined : framed ? this.activePalette()[1] : this.activePalette()[3], strokeWidth: sticker ? 0 : framed ? 8 : 2,
        shadowColor: sticker ? undefined : this.activePalette()[3], shadowBlur: sticker ? 0 : framed ? 0 : 8,
        shadowOffsetX: framed ? 8 : 0, shadowOffsetY: framed ? 8 : 10,
        imageBlur: 0, imageBrightness: 0, imageContrast: .04, imageSaturation: 0, imagePixelate: 7, imageNoise: 0, imageFilterMode: "none",
      };
    }
    await this.addElement(element, commit);
    await this.library.markAssetUsed(asset.id);
    if (commit) await this.refreshLibrary();
    return true;
  }

  private async insertBlueprintAt(asset: LibraryAsset, sourceBlueprint: VisualBlueprint, x: number, y: number, width: number, commit: boolean) {
    const scene = this.scene();
    if (!scene || !this.canvas) return false;
    const blueprint = recolorVisualBlueprint(sourceBlueprint, this.activePalette());
    const scale = width / Math.max(1, blueprint.width);
    const generatedVisualId = crypto.randomUUID();
    const ids: string[] = [];
    for (const [index, source] of blueprint.elements.entries()) {
      const id = crypto.randomUUID();
      ids.push(id);
      await this.addElement({
        ...structuredClone(source),
        id,
        name: `${source.name} · ${asset.name}`,
        x: x + source.x * scale,
        y: y + source.y * scale,
        width: Math.max(1, source.width * scale),
        height: Math.max(1, source.height * scale),
        scaleX: 1,
        scaleY: 1,
        fontSize: source.fontSize ? Math.max(10, source.fontSize * scale) : undefined,
        strokeWidth: source.strokeWidth ? Math.max(1, source.strokeWidth * scale) : source.strokeWidth,
        radius: source.radius ? source.radius * scale : source.radius,
        zIndex: scene.elements.length + index,
        assetId: asset.id,
        generatedVisualId,
      }, false);
    }
    const objects = ids.map((id) => this.findObject(id)).filter((item): item is PolyObject => Boolean(item));
    if (objects.length) {
      const selection = new ActiveSelection(objects, { canvas: this.canvas });
      this.canvas.setActiveObject(selection);
      this.canvas.requestRenderAll();
    }
    await this.library.markAssetUsed(asset.id);
    if (commit) {
      this.commit(`Visual editable añadido en ${objects.length} capas`);
      await this.refreshLibrary();
    }
    return objects.length > 0;
  }

  private async applyReferenceBlueprint(asset: LibraryAsset, sourceBlueprint: VisualBlueprint) {
    const scene = this.scene();
    if (!scene) return false;
    const blueprint = structuredClone(sourceBlueprint);
    const scale = Math.min(scene.width / Math.max(1, blueprint.width), scene.height / Math.max(1, blueprint.height));
    const offsetX = (scene.width - blueprint.width * scale) / 2;
    const offsetY = (scene.height - blueprint.height * scale) / 2;
    const generatedVisualId = crypto.randomUUID();
    const elements = blueprint.elements.map((source, index): SceneElement => ({
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: `${source.name} · ${asset.name}`,
      x: offsetX + source.x * scale,
      y: offsetY + source.y * scale,
      width: Math.max(1, source.width * scale),
      height: Math.max(1, source.height * scale),
      scaleX: 1,
      scaleY: 1,
      fontSize: source.fontSize ? Math.max(10, source.fontSize * scale) : undefined,
      strokeWidth: source.strokeWidth ? Math.max(1, source.strokeWidth * scale) : source.strokeWidth,
      radius: source.radius ? source.radius * scale : source.radius,
      zIndex: index,
      assetId: asset.id,
      generatedVisualId,
    }));
    const next: SceneDocument = {
      ...scene,
      background: blueprint.palette[2] ?? scene.background,
      palette: [...blueprint.palette],
      paletteId: undefined,
      elements,
      updatedAt: new Date().toISOString(),
    };
    await this.renderScene(next, true);
    await this.library.markAssetUsed(asset.id);
    await this.refreshLibrary();
    return true;
  }

  uploadImage() { this.imageInput.nativeElement.click(); }
  uploadReferenceImage() { this.referenceInput.nativeElement.click(); }
  uploadBackgroundImage() { this.backgroundInput.nativeElement.click(); }
  importVideo() { this.videoInput.nativeElement.click(); }

  async handleVideoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    this.convertingVideo.set(0);
    this.status.set("Convirtiendo video a GIF… (esto tarda unos segundos)");
    try {
      const result = await this.videoToGif.convert(file, (pct) => this.convertingVideo.set(pct));
      const src = URL.createObjectURL(result.blob);
      const scene = this.scene();
      if (!scene || !this.canvas) return;
      const width = Math.min(560, scene.width * .52);
      const height = width * (result.height / Math.max(1, result.width));
      const asset: LibraryAsset = {
        id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, "") + " · GIF",
        kind: "illustration", format: "gif", source: "user", scope: "atomic",
        themes: [], tags: ["video", "gif", "demo", "animation"], style: "user-gif",
        colors: [], aspectRatio: result.width / Math.max(1, result.height),
        compatibleBackgrounds: ["light", "dark", "color"],
        hash: await this.hash(await result.blob.arrayBuffer()), useCount: 0,
        createdAt: new Date().toISOString(), version: 1,
      };
      await this.library.saveAsset(asset, { deduplicate: false });
      await this.library.writeLargeBlob(asset.id, result.blob);
      const element: SceneElement = {
        id: crypto.randomUUID(), type: "image", name: asset.name,
        x: (scene.width - width) / 2, y: (scene.height - height) / 2,
        width, height, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1,
        zIndex: scene.elements.length, visible: true, locked: false,
        assetId: asset.id, src,
        imageFrame: "window", radius: 8, stroke: this.activePalette()[1], strokeWidth: 8,
        shadowColor: this.activePalette()[3], shadowBlur: 0, shadowOffsetX: 8, shadowOffsetY: 8,
        imageBlur: 0, imageBrightness: 0, imageContrast: 0, imageSaturation: 0,
        imagePixelate: 7, imageNoise: 0, imageFilterMode: "none",
      };
      await this.addElement(element, true);
      this.status.set(`GIF creado: ${result.frames} frames · ${result.width}×${result.height}.`);
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : "No se pudo convertir el video.");
    } finally {
      this.convertingVideo.set(null);
    }
  }

  async handleReferenceUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const ok = await this.pasteImageAsReference(file);
    if (!ok) this.status.set("La referencia no pudo convertirse. La imagen original no se añadió al lienzo.");
  }

  async openCutoutEditor() {
    const selected = this.selected();
    if (!selected?.assetId || selected.type !== "image" || selected.isBackground) {
      this.status.set("Selecciona una imagen libre para convertirla en sticker.");
      return;
    }
    const selectedAsset = await this.library.asset(selected.assetId);
    if (!selectedAsset) {
      this.status.set("No encontramos el archivo original de esta imagen.");
      return;
    }
    const existing = selectedAsset.kind === "sticker" ? await this.library.cutout(selectedAsset.id) : undefined;
    const sourceAsset = existing ? await this.library.asset(existing.sourceAssetId) : selectedAsset;
    if (!sourceAsset) {
      this.status.set("El recurso original del sticker ya no está disponible.");
      return;
    }
    const blob = await this.library.readLargeBlob(sourceAsset.id);
    if (!blob) {
      this.status.set("No encontramos el archivo original de esta imagen.");
      return;
    }
    this.cutoutSource.set({ asset: sourceAsset, blob, existing });
    this.status.set(existing ? "Sticker abierto para retoque." : "Preparando el recorte local…");
  }

  closeCutoutEditor() {
    this.cutoutSource.set(null);
  }

  async saveCutout(event: CutoutSaveEvent) {
    const current = this.cutoutSource();
    const scene = this.scene();
    if (!current || !scene) return;
    const active = this.canvas?.getActiveObject() as PolyObject | undefined;
    const bounds = active?.getBoundingRect();
    const outputAssetId = crypto.randomUUID();
    const now = new Date().toISOString();
    const sourceName = current.asset.name.replace(/\s*·\s*sticker.*$/i, "");
    const asset: LibraryAsset = {
      id: outputAssetId,
      name: `${sourceName} · sticker`,
      kind: "sticker",
      format: "png",
      source: "user",
      scope: "atomic",
      themes: [...current.asset.themes],
      tags: [...new Set([...current.asset.tags, "sticker", "cutout", "collage"])],
      style: "arbe-cutout",
      colors: [event.outlineColor],
      aspectRatio: event.aspectRatio,
      compatibleBackgrounds: ["light", "dark", "color"],
      hash: await this.hash(await event.resultBlob.arrayBuffer()),
      useCount: 0,
      createdAt: now,
      version: 1,
      derivedFromAssetId: event.sourceAssetId,
    };
    await this.library.saveAsset(asset, { deduplicate: false });
    await this.library.writeLargeBlob(outputAssetId, event.resultBlob);
    await this.library.saveCutout({
      outputAssetId,
      sourceAssetId: event.sourceAssetId,
      alphaMask: event.alphaMask,
      modelId: "onnx-community/ormbg-ONNX",
      modelRevision: "33d7cc32d4a8c7a9f9e7654bfc775cf015ae61de",
      outlineColor: event.outlineColor,
      outlineWidth: event.outlineWidth,
      shadowBlur: event.shadowBlur,
      createdAt: now,
      updatedAt: now,
    });
    this.cutoutSource.set(null);
    await this.refreshLibrary();
    if (event.replace && bounds && active && this.canvas) {
      this.canvas.remove(active);
      this.canvas.discardActiveObject();
      await this.insertAssetAt(asset, bounds.left, bounds.top, Math.max(80, bounds.width), true);
      this.status.set("Sticker guardado, reemplazado y disponible en Collage.");
    } else {
      this.status.set("Sticker guardado en Collage. La imagen original sigue intacta.");
    }
  }

  async handleImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) await this.insertImageFile(file, "upload");
    (event.target as HTMLInputElement).value = "";
  }

  async handleBackgroundUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) await this.insertImageFile(file, "upload", undefined, undefined, true);
    (event.target as HTMLInputElement).value = "";
  }

  async applyTemplate(template: EditorialTemplate) {
    const current = this.scene();
    if (!current) return;
    const next = createScene(this.slide, this.activeBrand(), this.channel, template);
    next.palette = [...this.activePalette()];
    next.paletteId = this.activePaletteId();
    // Only preserve real library assets. Template SVG decorations have no assetId
    // and must be replaced with the decorations from the newly selected recipe.
    const nextAssetIds = new Set(next.elements.flatMap((element) => element.assetId ? [element.assetId] : []));
    const preserved = current.elements.filter((element) => ["image", "svg"].includes(element.type) && Boolean(element.assetId) && !nextAssetIds.has(element.assetId!));
    const backgrounds = preserved.filter((element) => element.isBackground);
    const foregroundAssets = preserved.filter((element) => !element.isBackground);
    next.elements = [
      ...backgrounds.map((element, index) => ({ ...element, zIndex: index })),
      ...next.elements.map((element, index) => ({ ...element, zIndex: backgrounds.length + index })),
      ...foregroundAssets.map((element, index) => ({ ...element, zIndex: backgrounds.length + next.elements.length + index })),
    ];
    await this.renderScene(next, true);
    await this.library.saveTemplate({ ...template, useCount: template.useCount + 1 });
    this.status.set(`Template aplicado: ${template.name}. Copy y assets compatibles conservados.`);
  }

  openTemplateSave() {
    const scene = this.scene();
    if (!scene) return;
    const source = `${this.slide.headline} ${this.slide.body}`.toLocaleLowerCase();
    const referencedUsage = scene.elements.flatMap((element) => {
      if (!element.assetId) return [];
      const asset = this.assets().find((candidate) => candidate.id === element.assetId);
      return asset?.blueprint?.intent.templateUsage ? [asset.blueprint.intent.templateUsage] : [];
    })[0];
    const role: EditorialTemplate["slideRole"] = referencedUsage?.roles[0] ?? (this.slide.slide_order === 1
      ? "cover"
      : /antes|despu[eé]s|versus|\bvs\b|compar/.test(source)
        ? "comparison"
        : /guarda|comenta|comparte|prueba|empieza|descarga/.test(source)
          ? "cta"
          : "step");
    const label = referencedUsage?.intent || this.slide.headline;
    this.templateRole.set(role);
    this.templateName.set(`Sistema · ${label || "editorial"}`.slice(0, 72));
    this.templateUsageNote.set("");
    this.templateSaveOpen.set(true);
    window.setTimeout(() => document.querySelector(".template-save-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  templateChannelLabel() {
    return CHANNEL_SIZES[this.channel]?.label ?? this.channel;
  }

  async saveCurrentAsTemplate() {
    const scene = this.scene();
    if (!scene) return;
    const id = crypto.randomUUID();
    const role = this.templateRole();
    const characteristics = templateCharacteristics(scene);
    const sceneSnapshot = createTemplateSceneSnapshot(scene);
    const inferredSelection = inferTemplateUsage(this.slide, scene, role, this.templateUsageNote());
    const referencedUsage = scene.elements.flatMap((element) => {
      if (!element.assetId) return [];
      const asset = this.assets().find((candidate) => candidate.id === element.assetId);
      return asset?.blueprint?.intent.templateUsage ? [asset.blueprint.intent.templateUsage] : [];
    })[0];
    const selection = referencedUsage ? {
      intent: this.templateUsageNote().trim() || referencedUsage.intent || inferredSelection.intent,
      roles: [...new Set([role, ...referencedUsage.roles])],
      contentTypes: [...new Set([...referencedUsage.contentTypes, ...inferredSelection.contentTypes])].slice(0, 8),
      keywords: [...new Set([...referencedUsage.keywords, ...inferredSelection.keywords])].slice(0, 12),
      avoidWhen: [...new Set([...referencedUsage.avoidWhen, ...inferredSelection.avoidWhen])].slice(0, 8),
    } : inferredSelection;
    const name = this.templateName().trim().slice(0, 80) || `Sistema ${new Date().toLocaleDateString()}`;
    const template: EditorialTemplate = {
      id, family: "Mis sistemas", name,
      channel: scene.channel, width: scene.width, height: scene.height, slideRole: role, density: characteristics.density, style: characteristics.style,
      tags: ["personal", "guardado", role, characteristics.style, ...selection.contentTypes, ...selection.keywords],
      slots: templateSlotsFromScene(scene), favorite: true, useCount: 0, version: 3,
      previewColors: [...new Set([scene.background, ...sceneSnapshot.palette])].slice(0, 4),
      recipeId: `user-${id}`, source: "user", catalogVersion: 2, compatibleContentTypes: selection.contentTypes,
      assetRequirement: characteristics.assetRequirement,
      safeArea: { top: .05, right: .05, bottom: .05, left: .05 }, decorations: [], selection, sceneSnapshot,
    };
    await this.library.saveTemplate(template);
    this.templates.set([template, ...this.templates()]);
    this.templateSaveOpen.set(false);
    this.status.set(`“${template.name}” guardado. La IA lo considerará para ${selection.roles.join(", ")} · ${selection.contentTypes.join(", ")}.`);
  }

  async createScriptFromTemplate() {
    const scene = this.scene();
    if (!scene) return;
    const intent = scene.elements.flatMap((element) => {
      if (!element.assetId) return [];
      const asset = this.assets().find((candidate) => candidate.id === element.assetId);
      return asset?.blueprint?.intent ? [asset.blueprint.intent] : [];
    })[0];
    const topic = intent?.editorialCopy?.headline || intent?.concept || this.slide.headline;
    const angle = intent?.editorialCopy?.closingInsight || intent?.editorialCopy?.deck || this.slide.body;
    await this.router.navigate(["/brands", this.brand.id || "local-brand", "short-video", "new"], {
      queryParams: { topic, angle, from: "image-template" },
    });
  }

  templatePreview(template: EditorialTemplate) {
    const key = `${template.id}:${this.slide?.id}:${this.activePaletteId()}`;
    const cached = this.previewCache.get(key);
    if (cached) return cached;
    const scene = createScene(this.slide, this.activeBrand(), this.channel, template);
    this.previewCache.set(key, scene);
    return scene;
  }

  selectLayer(element: SceneElement) {
    const object = this.findObject(element.id);
    if (!object || !this.canvas) return;
    this.canvas.setActiveObject(object);
    this.canvas.requestRenderAll();
    this.syncSelection();
  }

  toggleVisible(element: SceneElement) {
    const object = this.findObject(element.id);
    if (!object) return;
    object.visible = !object.visible;
    this.canvas?.requestRenderAll();
    this.commit("Visibilidad actualizada");
  }

  toggleLocked(element: SceneElement) {
    const object = this.findObject(element.id);
    if (!object) return;
    const locked = !element.locked;
    object.set({ selectable: !locked, evented: !locked, lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked });
    this.commit(locked ? "Capa bloqueada" : "Capa desbloqueada");
  }

  removeSelected() {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObjects();
    active.forEach((object) => this.canvas!.remove(object));
    this.canvas.discardActiveObject();
    this.commit("Elementos eliminados");
  }

  duplicateSelected() {
    const elements = this.selectedSceneElements();
    const visualIds = new Map<string, string>();
    for (const element of elements) {
      if (element.generatedVisualId && !visualIds.has(element.generatedVisualId)) visualIds.set(element.generatedVisualId, crypto.randomUUID());
      this.addElement({ ...structuredClone(element), id: crypto.randomUUID(), generatedVisualId: element.generatedVisualId ? visualIds.get(element.generatedVisualId) : undefined, name: `${element.name} copia`, x: element.x + 28, y: element.y + 28, zIndex: (this.scene()?.elements.length ?? 0) + 1 }, false);
    }
    this.commit("Elementos duplicados");
  }

  /** Reescribe el headline + body del slide actual con DeepSeek (Smart Brevity).
   *  Encuentra los objetos de texto "Titular" y "Cuerpo" en el canvas y
   *  reemplaza su contenido. */
  async regenerateSlideContent() {
    if (this.regenerating()) return;
    this.regenerating.set(true);
    this.status.set("Regenerando contenido del slide…");
    try {
      const headlineEl = this.scene()?.elements.find((e) => e.name === "Titular");
      const bodyEl = this.scene()?.elements.find((e) => ["Cuerpo", "Subtítulo", "CTA", "Atribución"].includes(e.name));
      const role = this.slide?.slide_order === 1 ? "cover" : "cta";
      const result = await this.generation.regenerateSlide({
        slide: {
          headline: headlineEl?.content ?? this.slide?.headline ?? "",
          body: bodyEl?.content ?? this.slide?.body ?? "",
          role,
        },
        brand: { name: this.brand.name, description: this.brand.description },
        goal: "teach",
      });
      if (headlineEl && this.canvas) {
        const obj = this.findObject(headlineEl.id);
        if (obj instanceof Textbox) {
          obj.set("text", result.slide.headline);
          obj.setCoords();
        }
      }
      if (bodyEl && this.canvas) {
        const obj = this.findObject(bodyEl.id);
        if (obj instanceof Textbox) {
          obj.set("text", result.slide.body);
          obj.setCoords();
        }
      }
      this.canvas?.requestRenderAll();
      this.commit("Contenido regenerado");
      this.status.set("Slide regenerado. Revisá el nuevo copy.");
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : "No se pudo regenerar el slide.");
    } finally {
      this.regenerating.set(false);
    }
  }

  bringForward() {
    const object = this.canvas?.getActiveObject();
    if (!object || !this.canvas) return;
    this.canvas.bringObjectToFront(object);
    this.canvas.requestRenderAll();
    this.commit("Elemento enviado al frente");
  }

  sendBackward() {
    const object = this.canvas?.getActiveObject();
    if (!object || !this.canvas) return;
    this.canvas.sendObjectToBack(object);
    this.canvas.requestRenderAll();
    this.commit("Elemento enviado al fondo");
  }

  groupSelected() {
    const active = this.canvas?.getActiveObject();
    if (!(active instanceof ActiveSelection) || !this.canvas) return;
    const members = active.getObjects();
    this.canvas.remove(...members);
    const group = new Group(members, { left: active.left, top: active.top });
    const first = members[0] as PolyObject;
    this.tagObject(group, { id: crypto.randomUUID(), type: "svg", name: "Grupo", x: group.left, y: group.top, width: group.width, height: group.height, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, svg: undefined, assetId: first.polyAssetId });
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    this.commit("Elementos agrupados");
  }

  selectGeneratedVisual() {
    const generatedVisualId = this.selectedGeneratedVisualId() ?? this.selectedSceneElements().find((item) => item.generatedVisualId)?.generatedVisualId;
    if (!generatedVisualId || !this.canvas) return;
    const objects = this.canvas.getObjects().filter((item) => (item as PolyObject).polyGeneratedVisualId === generatedVisualId);
    if (!objects.length) return;
    this.canvas.setActiveObject(objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.syncSelection();
    this.status.set(`${objects.length} capas del visual seleccionadas.`);
  }

  detachGeneratedVisual() {
    const ids = new Set(this.selectedSceneElements().map((item) => item.generatedVisualId).filter((id): id is string => Boolean(id)));
    if (!ids.size || !this.canvas) return;
    this.canvas.getObjects().forEach((item) => {
      const object = item as PolyObject;
      if (object.polyGeneratedVisualId && ids.has(object.polyGeneratedVisualId)) {
        object.polyGeneratedVisualId = undefined;
        object.polyVisualRole = undefined;
      }
    });
    this.commit("Capas separadas del visual generado");
  }

  updateSelected(property: keyof SceneElement, value: string | number | boolean) {
    const object = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!object) return;
    const numeric = ["x", "y", "rotation", "opacity", "fontSize", "lineHeight", "charSpacing"].includes(property) ? Number(value) : value;
    const map: Partial<Record<keyof SceneElement, string>> = { x: "left", y: "top", rotation: "angle" };
    const fabricProperty = map[property] ?? property;
    if (property === "locked") {
      const locked = Boolean(value);
      object.set({ selectable: !locked, evented: !locked, lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked });
    } else if (property === "content" && object instanceof Textbox) object.set("text", String(value));
    else object.set(fabricProperty as never, numeric as never);
    object.setCoords();
    this.canvas?.requestRenderAll();
    this.commit(`Propiedad ${String(property)} actualizada`);
  }

  applyImageFrame(preset: ImageFramePreset) {
    const object = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!(object instanceof FabricImage) || (object as PolyObject).polyType !== "image") return;
    const image = object as FabricImage & PolyObject;
    const [primary, accent, paper, ink] = this.activePalette();
    const frames: Record<ImageFramePreset, { stroke?: string; strokeWidth: number; radius: number; shadow?: { color: string; blur: number; offsetX: number; offsetY: number } }> = {
      none: { strokeWidth: 0, radius: 0 },
      clean: { stroke: ink, strokeWidth: 3, radius: 0, shadow: { color: `${ink}44`, blur: 8, offsetX: 0, offsetY: 8 } },
      window: { stroke: accent, strokeWidth: 8, radius: 6, shadow: { color: ink, blur: 0, offsetX: 8, offsetY: 8 } },
      soft: { stroke: `${accent}33`, strokeWidth: 10, radius: 32, shadow: { color: `${accent}55`, blur: 28, offsetX: 0, offsetY: 18 } },
      polaroid: { stroke: paper, strokeWidth: 24, radius: 0, shadow: { color: `${ink}66`, blur: 10, offsetX: 0, offsetY: 12 } },
      glass: { stroke: primary, strokeWidth: 8, radius: 28, shadow: { color: `${accent}66`, blur: 32, offsetX: 0, offsetY: 14 } },
      tape: { stroke: paper, strokeWidth: 10, radius: 0, shadow: { color: `${ink}55`, blur: 8, offsetX: 0, offsetY: 10 } },
      sticker: { strokeWidth: 0, radius: 0, shadow: { color: `${ink}66`, blur: 12, offsetX: 0, offsetY: 8 } },
    };
    const frame = frames[preset];
    image.polyImageFrame = preset;
    image.polyRadius = frame.radius;
    image.set({
      stroke: frame.stroke,
      strokeWidth: frame.strokeWidth,
      strokeUniform: true,
      paintFirst: "stroke",
      shadow: frame.shadow ? new Shadow(frame.shadow) : undefined,
    });
    this.applyImageClip(image, frame.radius);
    image.setCoords();
    this.canvas?.requestRenderAll();
    this.commit(`Marco ${preset === "none" ? "retirado" : preset} aplicado`);
  }

  updateImageEffect(property: "imageBlur" | "imageBrightness" | "imageContrast" | "imageSaturation" | "imagePixelate" | "imageNoise" | "radius", value: number) {
    const object = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!(object instanceof FabricImage) || (object as PolyObject).polyType !== "image") return;
    const image = object as FabricImage & PolyObject;
    const numeric = Number(value);
    if (property === "imageBlur") image.polyImageBlur = numeric;
    if (property === "imageBrightness") image.polyImageBrightness = numeric;
    if (property === "imageContrast") image.polyImageContrast = numeric;
    if (property === "imageSaturation") image.polyImageSaturation = numeric;
    if (property === "imagePixelate") image.polyImagePixelate = numeric;
    if (property === "imageNoise") image.polyImageNoise = numeric;
    if (property === "radius") {
      image.polyRadius = numeric;
      this.applyImageClip(image, numeric);
    }
    this.applyImageFilters(image);
    image.setCoords();
    this.canvas?.requestRenderAll();
    this.commit("Ajuste de imagen actualizado");
  }

  resetImageEffects() {
    const object = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!(object instanceof FabricImage) || (object as PolyObject).polyType !== "image") return;
    const image = object as FabricImage & PolyObject;
    image.polyImageBlur = 0;
    image.polyImageBrightness = 0;
    image.polyImageContrast = 0;
    image.polyImageSaturation = 0;
    image.polyImagePixelate = 7;
    image.polyImageNoise = 0;
    image.polyImageFilterMode = "none";
    this.applyImageFilters(image);
    this.applyImageFrame("none");
  }

  applyImageEffectPreset(preset: ImageEffectPreset) {
    const object = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!(object instanceof FabricImage) || (object as PolyObject).polyType !== "image") return;
    const image = object as FabricImage & PolyObject;
    const presets: Record<ImageEffectPreset, { blur: number; brightness: number; contrast: number; saturation: number; pixelate: number; noise: number; mode: ImageFilterMode }> = {
      original: { blur: 0, brightness: 0, contrast: 0, saturation: 0, pixelate: 7, noise: 0, mode: "none" },
      dark: { blur: .015, brightness: -.24, contrast: .18, saturation: -.08, pixelate: 7, noise: 0, mode: "none" },
      soft: { blur: .06, brightness: .04, contrast: -.08, saturation: -.12, pixelate: 7, noise: 0, mode: "none" },
      vivid: { blur: 0, brightness: .04, contrast: .2, saturation: .28, pixelate: 7, noise: 0, mode: "none" },
      mono: { blur: 0, brightness: -.04, contrast: .2, saturation: -1, pixelate: 7, noise: 0, mode: "none" },
      bitmap: { blur: 0, brightness: 0, contrast: .12, saturation: 0, pixelate: 7, noise: 0, mode: "bitmap" },
      halftone: { blur: 0, brightness: .03, contrast: .1, saturation: .18, pixelate: 9, noise: 0, mode: "halftone" },
      mosaic: { blur: 0, brightness: .02, contrast: .08, saturation: .08, pixelate: 14, noise: 0, mode: "mosaic" },
      "cross-stitch": { blur: 0, brightness: .03, contrast: .14, saturation: 0, pixelate: 10, noise: 0, mode: "cross-stitch" },
      grain: { blur: 0, brightness: .03, contrast: .16, saturation: -.12, pixelate: 7, noise: 48, mode: "none" },
      sepia: { blur: 0, brightness: .03, contrast: .08, saturation: -.18, pixelate: 7, noise: 8, mode: "sepia" },
    };
    const values = presets[preset];
    image.polyImageBlur = values.blur;
    image.polyImageBrightness = values.brightness;
    image.polyImageContrast = values.contrast;
    image.polyImageSaturation = values.saturation;
    image.polyImagePixelate = values.pixelate;
    image.polyImageNoise = values.noise;
    image.polyImageFilterMode = values.mode;
    this.applyImageFilters(image);
    this.canvas?.requestRenderAll();
    this.commit(`Look de imagen aplicado: ${preset}`);
  }

  toggleSelectedImageBackground() {
    const scene = this.scene();
    const object = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!scene || !(object instanceof FabricImage) || (object as PolyObject).polyType !== "image" || !this.canvas) return;
    const image = object as FabricImage & PolyObject;
    if (image.polyIsBackground) {
      const width = scene.width * .62;
      const scale = width / Math.max(1, image.width);
      image.polyIsBackground = false;
      image.polyImageFit = "contain";
      image.polyName = image.polyName?.replace(/^Fondo · /, "") ?? "Imagen";
      image.set({ left: scene.width * .19, top: scene.height * .24, scaleX: scale, scaleY: scale, angle: 0, selectable: true, evented: true });
      this.applyImageFrame("soft");
      this.status.set("La imagen volvió a ser un objeto libre.");
      return;
    }
    const scale = Math.max(scene.width / Math.max(1, image.width), scene.height / Math.max(1, image.height));
    image.polyIsBackground = true;
    image.polyImageFit = "cover";
    image.polyImageFrame = "none";
    image.polyRadius = 0;
    image.polyName = `Fondo · ${image.polyName ?? "Imagen"}`;
    image.clipPath = undefined;
    image.set({
      left: (scene.width - image.width * scale) / 2,
      top: (scene.height - image.height * scale) / 2,
      scaleX: scale,
      scaleY: scale,
      angle: 0,
      stroke: undefined,
      strokeWidth: 0,
      shadow: undefined,
    });
    this.canvas.sendObjectToBack(image);
    this.canvas.setActiveObject(image);
    image.setCoords();
    this.canvas.requestRenderAll();
    this.commit("Imagen convertida en fondo editable");
  }

  setBackground(color: string) {
    if (!this.canvas) return;
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
    this.commit("Fondo actualizado");
  }

  async selectPalette(palette: ColorPaletteDefinition) {
    const current = this.serializeCanvas();
    if (!current) return;
    const previous = current.palette?.length === 4 ? current.palette : this.activePalette();
    const next = applyPaletteToScene(current, previous, palette);
    this.activePalette.set([...palette.colors]);
    this.activePaletteId.set(palette.id);
    this.previewCache.clear();
    await this.renderScene(next, true);
    this.status.set(`Paleta aplicada: ${palette.name}.`);
  }

  updatePaletteColor(index: number, value: string) {
    const colors = [...this.activePalette()] as ColorPaletteDefinition["colors"];
    colors[index] = value;
    void this.selectPalette({ id: "custom", name: "Paleta personalizada", mood: "Creada por ti", colors });
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    void this.renderScene(structuredClone(this.history[this.historyIndex]), false);
    this.updateHistoryButtons();
    this.status.set("Deshacer");
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    void this.renderScene(structuredClone(this.history[this.historyIndex]), false);
    this.updateHistoryButtons();
    this.status.set("Rehacer");
  }

  setZoom(value: number) {
    this.zoom.set(Number(value));
    this.applyZoom();
  }

  exportPng() { if (this.canvas) this.exporter.exportPng(this.canvas, `${this.slug()}-${this.slide.slide_order}.png`, this.currentScale()); }
  async exportGif() {
    if (!this.canvas || this.exportingGif()) return;
    const animated = this.canvas.getObjects().map((object) => ({ object: object as PolyObject, motion: (object as PolyObject).polyMotion })).filter((entry): entry is { object: PolyObject; motion: MotionPreset } => Boolean(entry.motion));
    if (!animated.length) {
      this.status.set("Esta lámina aún no tiene elementos animados. Usa un asset marcado como ANIMADO desde Collage.");
      this.panel.set("collage");
      return;
    }
    this.exportingGif.set(true);
    this.status.set("Renderizando 24 fotogramas del GIF…");
    try {
      this.canvas.discardActiveObject();
      await this.exporter.exportGif(this.canvas, `${this.slug()}-${this.slide.slide_order}-animado.gif`, animated);
      this.status.set("GIF descargado. La escena editable no cambió.");
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : "No se pudo exportar el GIF.");
    } finally {
      this.exportingGif.set(false);
    }
  }
  exportSvg() { if (this.canvas) this.exporter.exportSvg(this.canvas, `${this.slug()}-${this.slide.slide_order}.svg`); }
  exportJson() { const scene = this.scene(); if (scene) this.exporter.exportJson(scene, `${this.slug()}-${this.slide.slide_order}.polyedro.json`); }
  exportPack() { void this.exporter.exportPack(`${this.slug()}.polyedro-pack`); }
  openPack() { this.packInput.nativeElement.click(); }

  async importPack(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const result = await this.exporter.importPack(file);
      this.status.set(`Backup restaurado: ${result.scenes} escenas, ${result.templates} templates y ${result.assets} assets.`);
      await this.refreshLibrary();
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : "No se pudo restaurar el paquete.");
    }
    (event.target as HTMLInputElement).value = "";
  }

  async enrichWithEditableLayers() {
    if (!this.canvas || !this.scene() || this.enriching()) return;
    this.enriching.set(true);
    this.status.set("Analizando jerarquía, detalles y assets reutilizables…");
    try {
      const scene = this.scene()!;
      const names = new Set(this.canvas.getObjects().map((item) => (item as PolyObject).polyName));
      const accent = this.activePalette()[1] ?? "#D94E1E";
      const marker = "#B9D8F7";
      const ink = this.activePalette()[3] ?? "#1A1A1A";
      const paper = this.activePalette()[2] ?? "#F2F0E4";
      const profile = this.enrichmentProfile();
      let added = 0;

      const legacyNames = [
        "Regla editorial", "Selección editorial", "Control selección · inicio", "Control selección · fin",
        "Manejador selección · inicio", "Manejador selección · fin", "Subrayado de contraste",
        "CTA flotante", "Copy CTA flotante",
      ];
      const legacyObjects = this.canvas.getObjects().filter((item) => legacyNames.includes((item as PolyObject).polyName ?? ""));
      if (profile !== "editorial-emphasis" && legacyObjects.length) this.canvas.remove(...legacyObjects);

      const replaceableAssetIds = new Set(this.canvas.getObjects()
        .filter((item) => ((item as PolyObject).polyName ?? "").startsWith("Contexto "))
        .map((item) => (item as PolyObject).polyAssetId)
        .filter((id): id is string => Boolean(id)));
      const currentAssetIds = new Set(scene.elements.map((item) => item.assetId)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !replaceableAssetIds.has(id)));
      const matchingLogos = this.assets().filter((asset) => asset.kind === "logo" && asset.technology && this.analysis().entities.some((entity) => entity.toLowerCase() === asset.technology!.toLowerCase()) && !currentAssetIds.has(asset.id)).slice(0, 2);
      const contextualSlot = await this.resolveContextSlot(matchingLogos, profile);
      added += contextualSlot.added;

      if (profile === "editorial-emphasis" && !names.has("Regla editorial")) {
        await this.addElement({ id: crypto.randomUUID(), type: "line", name: "Regla editorial", x: 82, y: 118, width: scene.width - 164, height: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length, visible: true, locked: false, stroke: ink, strokeWidth: 3 }, false);
        added++;
      }

      const headline = this.canvas.getObjects().find((item) => (item as PolyObject).polyName === "Titular") as PolyObject | undefined;
      if (profile === "editorial-emphasis" && headline && !names.has("Selección editorial")) {
        const bounds = headline.getBoundingRect();
        const width = Math.min(Math.max(230, bounds.width * .46), scene.width * .58);
        const height = Math.min(94, Math.max(56, bounds.height * .34));
        const x = Math.max(54, bounds.left - 8);
        const y = bounds.top + Math.min(bounds.height * .22, 72);
        const markerId = crypto.randomUUID();
        await this.addElement({ id: markerId, type: "rect", name: "Selección editorial", x, y, width, height, scaleX: 1, scaleY: 1, rotation: 0, opacity: .9, zIndex: scene.elements.length, visible: true, locked: false, fill: marker, radius: 0 }, false);
        const markerObject = this.findObject(markerId);
        if (markerObject) this.canvas.sendObjectToBack(markerObject);
        await this.addElement({ id: crypto.randomUUID(), type: "line", name: "Control selección · inicio", x, y: y - 10, width: 0, height: height + 20, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length + 1, visible: true, locked: false, stroke: "#0879D1", strokeWidth: 5 }, false);
        await this.addElement({ id: crypto.randomUUID(), type: "line", name: "Control selección · fin", x: x + width, y: y - 10, width: 0, height: height + 20, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length + 2, visible: true, locked: false, stroke: "#0879D1", strokeWidth: 5 }, false);
        await this.addElement({ id: crypto.randomUUID(), type: "circle", name: "Manejador selección · inicio", x: x - 10, y: y - 20, width: 20, height: 20, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length + 3, visible: true, locked: false, fill: "#0879D1" }, false);
        await this.addElement({ id: crypto.randomUUID(), type: "circle", name: "Manejador selección · fin", x: x + width - 10, y: y + height, width: 20, height: 20, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length + 4, visible: true, locked: false, fill: "#0879D1" }, false);
        await this.addElement({ id: crypto.randomUUID(), type: "line", name: "Subrayado de contraste", x: bounds.left, y: bounds.top + bounds.height + 14, width: Math.min(bounds.width * .72, scene.width * .65), height: 0, scaleX: 1, scaleY: 1, rotation: -.6, opacity: 1, zIndex: scene.elements.length + 5, visible: true, locked: false, stroke: accent, strokeWidth: 5 }, false);
        added += 6;
      }

      if (profile === "editorial-emphasis" && !names.has("CTA flotante")) {
        const chipWidth = Math.min(480, scene.width * .46);
        const chipX = scene.width - chipWidth - 88;
        const chipY = scene.height - 210;
        await this.addElement({ id: crypto.randomUUID(), type: "rect", name: "CTA flotante", x: chipX, y: chipY, width: chipWidth, height: 76, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length + 7, visible: true, locked: false, fill: paper, stroke: "#D8D8D4", strokeWidth: 2, radius: 28, shadowColor: "#1A1A1A33", shadowBlur: 22, shadowOffsetX: 0, shadowOffsetY: 12 }, false);
        await this.addElement({ id: crypto.randomUUID(), type: "text", name: "Copy CTA flotante", content: "GUÁRDALO · PRUÉBALO · COMPÁRTELO", x: chipX + 28, y: chipY + 22, width: chipWidth - 56, height: 42, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: scene.elements.length + 8, visible: true, locked: false, fill: ink, fontFamily: "Arial", fontSize: 24, fontWeight: 800, textAlign: "center", lineHeight: 1, charSpacing: 0 }, false);
        added += 2;
      }

      for (const [index, asset] of matchingLogos.entries()) {
        if (contextualSlot.usedAssetIds.has(asset.id)) continue;
        if (profile !== "editorial-emphasis") continue;
        if (await this.insertAssetAt(asset, scene.width - 178 - index * 112, 54, 88, false)) added++;
      }

      const arrow = this.assets().find((asset) => asset.id === "primitive-double-chevron" && !currentAssetIds.has(asset.id));
      if (profile === "editorial-emphasis" && arrow && await this.insertAssetAt(arrow, scene.width - 142, scene.height - 116, 72, false)) added++;

      if (added) this.commit(`${added} capas editoriales añadidas`);
      await this.refreshLibrary();

      if (contextualSlot.aiPlacement) await this.generateAiImage(true, contextualSlot.aiPlacement);
      else if (!matchingLogos.length && !contextualSlot.resolved) await this.generateAiImage(true, { x: scene.width * .62, y: scene.height * .57, width: scene.width * .28 });
      this.panel.set("layers");
      this.status.set(`Composición “${this.enrichmentProfileLabel(profile)}” aplicada como capas independientes y editables.`);
    } catch (error) {
      this.status.set(`La escena original sigue disponible. ${error instanceof Error ? error.message : "No se pudo enriquecer."}`);
    } finally {
      this.enriching.set(false);
    }
  }

  async polishWithAi() {
    if (!this.canvas) return;
    this.status.set("Componiendo la lámina editable…");
    try {
      await this.enrichWithEditableLayers();
      const unresolved = this.canvas.getObjects().some((item) => {
        const name = (item as PolyObject).polyName;
        return name === "Slot de asset · reemplázame" || name === "Asset pendiente";
      });
      if (unresolved) throw new Error("El slot visual sigue vacío. Añade, pega o genera un asset antes de exportar.");

      // Sin generación de imágenes raster: la variante "pulida" es el render
      // vectorial de alta calidad de la escena editable. Conserva nitidez,
      // composición y copy exactos — no hay IA de imagen que arriesgue el texto.
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      const final = this.canvas.toDataURL({ format: "png", multiplier: 1 });
      this.exporter.downloadDataUrl(final, `${this.slug()}-final.png`);
      this.status.set("Lámina exportada a máxima calidad. Todo es vectorial: el copy y la composición quedaron intactos.");
    } catch (error) {
      this.status.set(`La escena sigue intacta. ${error instanceof Error ? error.message : "No se pudo exportar."}`);
    }
  }

  async generateMissingMotif() {
    await this.generateContextualVisual();
  }

  setAssetPrompt(value: string) {
    this.assetPrompt.set(value.slice(0, 500));
  }

  useAssetPromptExample(value: string) {
    this.assetPrompt.set(value);
    this.visualFeedback.set({ tone: "neutral", message: "Descripción lista. Elige Auto, SVG editable o Imagen IA." });
  }

  async generatePromptedAsset(mode: VisualGenerationMode = this.visualGenerationMode()) {
    const prompt = this.assetPrompt().trim();
    if (!prompt) {
      this.visualFeedback.set({ tone: "error", message: "Describe primero el asset que quieres crear." });
      return;
    }
    await this.generateContextualVisual(mode, prompt);
  }

  async retryLastVisual(mode: VisualGenerationMode) {
    if (this.lastVisualSource === "prompt" && this.assetPrompt().trim()) await this.generatePromptedAsset(mode);
    else await this.generateContextualVisual(mode);
  }

  setVisualGenerationMode(mode: string) {
    if (!["auto", "diagram", "image"].includes(mode)) return;
    this.visualGenerationMode.set(mode as VisualGenerationMode);
    this.visualFeedback.set({
      tone: "neutral",
      message: mode === "image"
        ? "Crearás un PNG nuevo. El texto y las cifras importantes seguirán como capas editables."
        : mode === "diagram"
          ? "Crearás un SVG con formas, conectores y etiquetas editables."
          : "El sistema elegirá SVG para símbolos y datos; PNG para escenas, objetos o metáforas.",
    });
  }

  visualStageLabel() {
    return ({
      idle: "Listo para interpretar",
      interpreting: "Interpretando texto",
      diagram: "Construyendo diagrama",
      image: "Generando imagen",
    } satisfies Record<ReturnType<typeof this.visualStage>, string>)[this.visualStage()];
  }

  async generateContextualVisual(mode: VisualGenerationMode = this.visualGenerationMode(), promptOverride = "") {
    if (this.enriching()) return;
    const manualPrompt = promptOverride.trim();
    const { selectedText, slideContext, source } = manualPrompt
      ? { selectedText: manualPrompt, slideContext: "", source: manualPrompt }
      : this.visualGenerationContext();
    this.lastVisualSource = manualPrompt ? "prompt" : "selection";
    const request = {
      selectedText,
      slideContext,
      assetOnly: Boolean(manualPrompt),
      palette: this.activePalette(),
      previousSignatures: this.assets().flatMap((asset) => asset.blueprint?.intent.signature ? [asset.blueprint.intent.signature] : []),
      requestedMode: mode,
      variantSeed: crypto.randomUUID(),
    };
    this.enriching.set(true);
    this.visualStage.set("interpreting");
    this.visualFeedback.set({ tone: "working", message: `Interpretando “${source.slice(0, 88)}”…` });
    this.status.set(`Interpretando “${source.slice(0, 88)}”…`);
    try {
      let remote: VisualIntent | undefined;
      try {
        remote = await this.generation.generateVisualIntent(request);
      } catch {
        // Local analysis is deliberately deterministic so a provider or schema
        // failure never blocks the editable diagram path.
      }
      const intent = normalizeVisualIntent(remote ?? buildLocalVisualIntent(request), request);
      const compositionUses = request.previousSignatures.filter((signature) => signature.startsWith(`${intent.composition}:`)).length;
      intent.signature = `${intent.composition}:${compositionUses}:${crypto.randomUUID()}`;
      if (intent.output === "diagram") {
        this.visualStage.set("diagram");
        this.visualFeedback.set({ tone: "working", message: "Construyendo el diagrama como capas editables…" });
        this.status.set("Construyendo el diagrama como capas editables…");
        const blueprint = createVisualBlueprint(intent, this.activePalette(), source);
        const saved = await this.saveVisualBlueprint(blueprint);
        await this.refreshLibrary();
        await this.insertContextualAsset(saved);
        this.status.set(`“${saved.name}” se creó como ${blueprint.elements.length} capas editables. Puedes moverlas juntas o separarlas.`);
        this.visualFeedback.set({ tone: "success", message: `${manualPrompt ? "Asset SVG" : "Diagrama"} creado con ${blueprint.elements.length} capas editables.` });
      } else {
        this.visualStage.set("image");
        this.visualFeedback.set({ tone: "working", message: "Razonando un asset vectorial editable…" });
        this.status.set("Razonando un asset vectorial editable con el contexto seleccionado…");
        const generated = await this.generateAiImage(false, this.contextualVisualPlacement(intent.aspectRatio), source, intent);
        if (generated) {
          this.visualFeedback.set({ tone: "success", message: `${manualPrompt ? "Asset vectorial" : "Asset vectorial"} creado como capas SVG editables.` });
        } else {
          const reason = this.lastImageGenerationError || "El razonador no devolvió una especificación.";
          this.status.set(`La escena sigue intacta. ${reason}`);
          this.visualFeedback.set({ tone: "error", message: reason });
        }
      }
      this.panel.set("layers");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar el visual.";
      this.status.set(`La escena sigue intacta. ${message}`);
      this.visualFeedback.set({ tone: "error", message });
    } finally {
      this.enriching.set(false);
      this.visualStage.set("idle");
    }
  }

  private visualGenerationContext() {
    const selectedText = this.selectedSceneElements()
      .filter((element) => element.type === "text" && element.content?.trim())
      .map((element) => element.content!.trim())
      .join(" · ");
    const slideContext = `${this.slide.headline}. ${this.slide.body}`.trim();
    return { selectedText: selectedText || undefined, slideContext, source: visualSource({ selectedText, slideContext }) };
  }

  private contextualVisualPlacement(aspectRatio = 1.5) {
    const scene = this.scene();
    const active = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!scene || !active) {
      const width = Math.min(440, (scene?.width ?? 1080) * .4);
      return { x: ((scene?.width ?? 1080) - width) / 2, y: (scene?.height ?? 1350) * .5, width, height: width / Math.max(.5, aspectRatio) };
    }
    const bounds = active.getBoundingRect();
    const width = Math.min(420, scene.width * .38);
    const height = width / Math.max(.5, aspectRatio);
    const right = bounds.left + bounds.width + 30;
    const x = right + width < scene.width - 42 ? right : Math.max(42, bounds.left - width - 30);
    const y = Math.max(42, Math.min(scene.height - height - 42, bounds.top + bounds.height * .2));
    return { x, y, width, height };
  }

  private async saveVisualBlueprint(blueprint: VisualBlueprint) {
    const svg = compileBlueprintSvg(blueprint);
    const uses = this.assets().filter((asset) => asset.blueprint?.intent.composition === blueprint.intent.composition).length;
    const concept = blueprint.intent.concept.replace(/[.:].*$/, "").slice(0, 52) || "Visual contextual";
    const asset: LibraryAsset = {
      id: crypto.randomUUID(),
      name: uses ? `${concept} · variante ${uses + 1}` : concept,
      kind: "diagram",
      format: "svg",
      source: "primitive",
      scope: "atomic",
      themes: blueprint.intent.elements.slice(0, 8),
      tags: ["generated-visual", `composition:${blueprint.intent.composition}`, `signature:${blueprint.intent.signature}`, ...blueprint.intent.exactLabels],
      style: "contextual-visual-v1",
      colors: [...blueprint.palette],
      aspectRatio: blueprint.width / blueprint.height,
      compatibleBackgrounds: ["light", "dark", "color"],
      prompt: blueprint.sourceText.slice(0, 1_000),
      hash: await this.hash(svg),
      useCount: 0,
      createdAt: new Date().toISOString(),
      version: uses + 1,
      svg,
      blueprint,
    };
    return this.library.saveAsset(asset, { deduplicate: false });
  }

  private async insertContextualAsset(asset: LibraryAsset) {
    const scene = this.scene();
    const active = this.canvas?.getActiveObject() as PolyObject | undefined;
    if (!scene || !active || this.isAssetSlot(active)) {
      await this.insertAsset(asset);
      return;
    }
    const bounds = active.getBoundingRect();
    const width = asset.blueprint ? Math.min(560, scene.width * .52) : Math.min(280, scene.width * .27);
    const height = width / Math.max(.25, asset.aspectRatio);
    const gap = 28;
    const right = bounds.left + bounds.width + gap;
    const left = bounds.left - width - gap;
    const x = right + width <= scene.width - 42 ? right : left >= 42 ? left : Math.max(42, Math.min(scene.width - width - 42, bounds.left + bounds.width / 2 - width / 2));
    const y = Math.max(42, Math.min(scene.height - height - 42, bounds.top - height - gap >= 42 ? bounds.top - height - gap : bounds.top + bounds.height + gap));
    await this.insertAssetAt(asset, x, y, width, true);
  }

  async generateAiImage(preferExisting = true, placement?: { x: number; y: number; width: number; height?: number }, focus?: string, intent?: VisualIntent): Promise<boolean> {
    const analysis = analyzeContext(focus || `${this.slide.headline} ${this.slide.body}`);
    const motif = intent?.concept ?? analysis.visualMotifs[0] ?? analysis.concepts[0] ?? "ilustración tecnológica editorial";
    const reusable = preferExisting ? rankAssets(analysis, this.assets(), "hero-image").find(({ asset, score }) => asset.source === "ai" && score > 0 && !this.scene()?.elements.some((item) => item.assetId === asset.id))?.asset : undefined;
    if (reusable) {
      this.lastImageGenerationError = "";
      await this.insertAssetAt(reusable, placement?.x ?? 110, placement?.y ?? 430, placement?.width ?? this.scene()!.width * .42, true);
      this.status.set(`Reutilizamos “${reusable.name}” desde tu biblioteca; no se volvió a generar.`);
      return true;
    }
    const prompt = intent?.prompt || [
      `Representa como asset vectorial editable: ${motif}`,
      analysis.entities.length ? `Contexto: ${analysis.entities.join(", ")}` : "",
      focus ? `Debe complementar visualmente este elemento: ${focus.slice(0, 500)}` : "",
      "crea una interpretación nueva y concreta del concepto (no una tarjeta de navegador genérica); elige una metáfora clara",
      "formas vectoriales simples y expresivas, silueta legible, asimetría controlada, trazo negro marcado",
      "asset aislado y centrado, margen generoso, editable forma por forma",
    ].filter(Boolean).join(". ");
    this.status.set(`Razonando el asset vectorial para “${motif}”…`);
    this.lastImageGenerationError = "";
    try {
      const spec = await this.generation.generateAssetSpec({
        prompt,
        palette: this.activePalette(),
        context: {
          selectedText: focus?.slice(0, 2_000),
          concept: motif,
          composition: intent?.composition,
        },
      });
      const svg = compileVectorAssetSvg({
        concept: spec.concept,
        palette: spec.palette.length ? spec.palette : this.activePalette(),
        shapes: spec.shapes,
        stickers: spec.stickers,
        motif: spec.motif || motif,
      });
      const uses = this.assets().filter((asset) => asset.source === "ai" && (asset.style ?? "").startsWith("vector-")).length;
      const name = uses ? `${spec.concept} · variante ${uses + 1}` : spec.concept;
      const asset: LibraryAsset = {
        id: crypto.randomUUID(), name, kind: "illustration", format: "svg", source: "ai", scope: "atomic",
        themes: spec.stickers, tags: ["generated-visual", "vector-asset", ...analysis.entities],
        style: "vector-asset-v1", colors: spec.palette.length ? spec.palette : this.activePalette(),
        aspectRatio: 1, compatibleBackgrounds: ["light", "dark", "color"],
        prompt, model: spec.model, hash: await this.hash(svg), useCount: 0,
        createdAt: new Date().toISOString(), version: uses + 1, svg,
      };
      const saved = await this.library.saveAsset(asset, { deduplicate: false });
      await this.refreshLibrary();
      const insertX = placement?.x ?? 110;
      const insertY = placement?.y ?? 430;
      const width = placement?.width ?? this.scene()!.width * .42;
      await this.insertAssetAt(saved, insertX, insertY, width, true);
      this.lastImageGenerationError = "";
      this.status.set(`Asset vectorial “${saved.name}” creado con ${spec.provider ?? "DeepSeek"} como capas SVG editables.`);
      return true;
    } catch (error) {
      const message = this.imageGenerationErrorMessage(error);
      this.lastImageGenerationError = message;
      this.status.set(`La escena no cambió. ${message}`);
      return false;
    }
  }

  private imageGenerationErrorMessage(error: unknown) {
    const raw = error instanceof Error ? error.message : "No se pudo razonar el asset vectorial.";
    if (/DEEPSEEK_API_KEY_MISSING|MIMO_API_KEY_MISSING/i.test(raw)) return "Falta configurar la clave de DeepSeek/MiMo en las funciones de Supabase.";
    if (/function.*not found|404|generate-editorial-asset.*not found/i.test(raw)) return "La función generate-editorial-asset no está desplegada en este proyecto de Supabase.";
    if (/failed to fetch|failed to send|network|load failed/i.test(raw)) return "No se pudo conectar con generate-editorial-asset. Revisa la función desplegada y la conexión.";
    return raw.slice(0, 360);
  }

  private async resolveContextSlot(matchingLogos: LibraryAsset[], profile: EnrichmentProfile) {
    const empty = { added: 0, resolved: false, usedAssetIds: new Set<string>(), aiPlacement: undefined as { x: number; y: number; width: number; height?: number } | undefined };
    if (!this.canvas || !this.scene()) return empty;
    const slot = this.canvas.getObjects().find((item) => {
      const name = (item as PolyObject).polyName ?? "";
      return name === "Slot de asset · reemplázame" || name === "Contexto tecnológico · panel" || name === "Contexto Git · panel" || name === "Contexto aprendizaje · panel";
    }) as PolyObject | undefined;
    if (!slot) return empty;

    const bounds = slot.getBoundingRect();
    const previousContext = this.canvas.getObjects().filter((item) => {
      const name = (item as PolyObject).polyName ?? "";
      return name === "Asset pendiente" || name.startsWith("Contexto tecnológico ·") || name.startsWith("Contexto Git ·") || name.startsWith("Contexto aprendizaje ·");
    });
    this.canvas.remove(slot, ...previousContext.filter((item) => item !== slot));
    const analysis = this.analysis();

    if (profile === "learning-curve") {
      const result = await this.addLearningCurveDiagram(bounds.left, bounds.top, bounds.width, bounds.height, matchingLogos);
      return { ...empty, added: result.added, resolved: true, usedAssetIds: result.usedAssetIds };
    }

    if (profile === "git-flow") {
      const added = await this.addGitContextDiagram(bounds.left, bounds.top, bounds.width, bounds.height);
      return { ...empty, added, resolved: true };
    }

    const logo = matchingLogos[0];
    if (logo) {
      const paper = this.activePalette()[2] ?? "#F2F0E4";
      const ink = this.activePalette()[3] ?? "#1A1A1A";
      await this.addElement({ id: crypto.randomUUID(), type: "rect", name: "Contexto tecnológico · panel", x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: this.canvas.getObjects().length, visible: true, locked: false, fill: paper, stroke: ink, strokeWidth: 3, radius: 20, shadowColor: "#1A1A1A26", shadowBlur: 18, shadowOffsetX: 8, shadowOffsetY: 12 }, false);
      const logoWidth = Math.min(bounds.width * .26, bounds.height * .38);
      await this.insertAssetAt(logo, bounds.left + 42, bounds.top + 46, logoWidth, false);
      const motifs = analysis.visualMotifs.slice(0, 3).map((motif) => this.motifLabel(motif));
      for (const [index, motif] of motifs.entries()) {
        const y = bounds.top + 62 + index * Math.min(112, bounds.height * .2);
        await this.addElement({ id: crypto.randomUUID(), type: "text", name: `Contexto tecnológico · ${index + 1}`, content: motif.toLocaleUpperCase(), x: bounds.left + logoWidth + 92, y, width: Math.max(160, bounds.width - logoWidth - 150), height: 72, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: this.canvas.getObjects().length, visible: true, locked: false, fill: ink, fontFamily: "Arial", fontSize: Math.max(22, Math.min(34, bounds.width / 20)), fontWeight: 800, textAlign: "left", lineHeight: 1, charSpacing: 0 }, false);
      }
      return { ...empty, added: 2 + motifs.length, resolved: true, usedAssetIds: new Set([logo.id]) };
    }

    return {
      ...empty,
      resolved: true,
      aiPlacement: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height },
    };
  }

  private enrichmentProfile(): EnrichmentProfile {
    return detectEnrichmentProfile(`${this.slide.headline} ${this.slide.body}`, this.analysis(), this.slide.composition);
  }

  private enrichmentProfileLabel(profile: EnrichmentProfile) {
    return ({
      "learning-curve": "curva de aprendizaje",
      "git-flow": "flujo Git",
      technology: "mapa tecnológico",
      "editorial-emphasis": "énfasis editorial",
    } satisfies Record<EnrichmentProfile, string>)[profile];
  }

  private motifLabel(motif: string) {
    const labels: Record<string, string> = {
      "widget tree": "ÁRBOL DE WIDGETS",
      "mobile device": "INTERFAZ MÓVIL",
      "cross-platform layers": "CAPAS MULTIPLATAFORMA",
      "component tree": "ÁRBOL DE COMPONENTES",
      "browser window": "VISTA EN NAVEGADOR",
      "dependency injection": "INYECCIÓN DE DEPENDENCIAS",
      "branch graph": "GRAFO DE RAMAS",
      "commit nodes": "HISTORIAL DE COMMITS",
      "terminal command": "COMANDO DE TERMINAL",
      "browser lock": "CONEXIÓN SEGURA",
      "certificate chain": "CADENA DE CERTIFICADOS",
      "request flow": "FLUJO DE PETICIONES",
    };
    return labels[motif] ?? motif.toLocaleUpperCase();
  }

  private async addLearningCurveDiagram(x: number, y: number, width: number, height: number, matchingLogos: LibraryAsset[]) {
    if (!this.canvas) return { added: 0, usedAssetIds: new Set<string>() };
    const ink = this.activePalette()[3] ?? "#1A1A1A";
    const paper = this.activePalette()[2] ?? "#F2F0E4";
    const accent = this.activePalette()[1] ?? "#D94E1E";
    const brand = this.activePalette()[0] ?? "#008F99";
    const marker = "#B9D8F7";
    const pad = Math.max(34, width * .055);
    const source = `${this.slide.headline} ${this.slide.body}`;
    const duration = source.match(/\b\d+\s*(?:[-–]|a)?\s*\d*\s*(?:d[ií]as?|semanas?|meses?)\b/i)?.[0]?.toLocaleUpperCase() ?? "PASO A PASO";
    const technology = this.analysis().entities[0]?.toLocaleUpperCase() ?? "TECNOLOGÍA";
    const usedAssetIds = new Set<string>();
    let added = 0;
    const base = () => ({ id: crypto.randomUUID(), scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: this.canvas!.getObjects().length, visible: true, locked: false });
    const add = async (element: SceneElement) => { await this.addElement(element, false); added++; };

    await add({ ...base(), type: "rect", name: "Contexto aprendizaje · panel", x, y, width, height, fill: paper, stroke: ink, strokeWidth: 3, radius: 18 });
    await add({ ...base(), type: "text", name: "Contexto aprendizaje · etiqueta", content: "CURVA REALISTA", x: x + pad, y: y + pad, width: width * .42, height: 42, fill: accent, fontFamily: "Arial", fontSize: Math.max(20, width / 30), fontWeight: 900, textAlign: "left", lineHeight: 1, charSpacing: 80 });
    await add({ ...base(), type: "text", name: "Contexto aprendizaje · tecnología", content: technology, x: x + pad, y: y + pad + 55, width: width * .55, height: 74, fill: ink, fontFamily: "Arial", fontSize: Math.max(34, width / 15), fontWeight: 900, textAlign: "left", lineHeight: 1, charSpacing: -10 });
    await add({ ...base(), type: "rect", name: "Contexto aprendizaje · duración", x: x + width - pad - width * .31, y: y + pad + 44, width: width * .31, height: 70, fill: marker, stroke: brand, strokeWidth: 2, radius: 35 });
    await add({ ...base(), type: "text", name: "Contexto aprendizaje · duración copy", content: duration, x: x + width - pad - width * .29, y: y + pad + 62, width: width * .27, height: 42, fill: ink, fontFamily: "Arial", fontSize: Math.max(20, width / 28), fontWeight: 900, textAlign: "center", lineHeight: 1, charSpacing: 10 });

    const chartLeft = x + pad;
    const chartRight = x + width - pad;
    const chartTop = y + Math.max(190, height * .32);
    const chartBottom = y + height - Math.max(92, height * .15);
    await add({ ...base(), type: "line", name: "Contexto aprendizaje · eje X", x: chartLeft, y: chartBottom, width: chartRight - chartLeft, height: 0, stroke: ink, strokeWidth: 3 });
    await add({ ...base(), type: "line", name: "Contexto aprendizaje · eje Y", x: chartLeft, y: chartTop, width: 0, height: chartBottom - chartTop, stroke: ink, strokeWidth: 3 });

    const points = [
      { x: chartLeft + (chartRight - chartLeft) * .08, y: chartBottom - (chartBottom - chartTop) * .12, label: "EMPIEZAS" },
      { x: chartLeft + (chartRight - chartLeft) * .42, y: chartBottom - (chartBottom - chartTop) * .38, label: "CONSTRUYES" },
      { x: chartLeft + (chartRight - chartLeft) * .76, y: chartBottom - (chartBottom - chartTop) * .78, label: "ERES PRODUCTIVO" },
    ];
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      if (index) {
        const previous = points[index - 1];
        await add({ ...base(), type: "line", name: `Contexto aprendizaje · tramo ${index}`, x: previous.x, y: previous.y, width: point.x - previous.x, height: point.y - previous.y, stroke: accent, strokeWidth: 10 });
      }
      await add({ ...base(), type: "circle", name: `Contexto aprendizaje · punto ${index + 1}`, x: point.x - 16, y: point.y - 16, width: 32, height: 32, fill: index === points.length - 1 ? accent : brand, stroke: paper, strokeWidth: 5 });
      await add({ ...base(), type: "text", name: `Contexto aprendizaje · hito ${index + 1}`, content: point.label, x: Math.max(chartLeft, point.x - 80), y: point.y + 30, width: 180, height: 48, fill: ink, fontFamily: "Arial", fontSize: Math.max(16, width / 42), fontWeight: 800, textAlign: "center", lineHeight: 1, charSpacing: 20 });
    }

    const logo = matchingLogos[0];
    if (logo && await this.insertAssetAt(logo, x + width - pad - 58, y + pad - 4, 54, false)) {
      usedAssetIds.add(logo.id);
      added++;
    }
    return { added, usedAssetIds };
  }

  private async addGitContextDiagram(x: number, y: number, width: number, height: number) {
    if (!this.canvas || this.canvas.getObjects().some((item) => (item as PolyObject).polyName === "Contexto Git · panel")) return 0;
    const ink = this.activePalette()[3] ?? "#1A1A1A";
    const paper = this.activePalette()[2] ?? "#F2F0E4";
    const accent = this.activePalette()[1] ?? "#D94E1E";
    const brand = this.activePalette()[0] ?? "#008F99";
    const pad = Math.max(26, width * .045);
    const headerHeight = Math.max(72, height * .14);
    const cardGap = Math.max(20, width * .025);
    const cardWidth = (width - pad * 2 - cardGap * 2) / 3;
    const cardHeight = Math.min(190, height * .34);
    const cardY = y + headerHeight + Math.max(36, height * .08);
    let added = 0;
    const add = async (element: SceneElement) => { await this.addElement(element, false); added++; };
    const base = () => ({ id: crypto.randomUUID(), scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: this.canvas!.getObjects().length, visible: true, locked: false });

    await add({ ...base(), type: "rect", name: "Contexto Git · panel", x, y, width, height, fill: paper, stroke: ink, strokeWidth: 3, radius: 20, shadowColor: "#1A1A1A2B", shadowBlur: 22, shadowOffsetX: 8, shadowOffsetY: 12 });
    await add({ ...base(), type: "rect", name: "Contexto Git · terminal", x: x + pad, y: y + pad, width: width - pad * 2, height: headerHeight, fill: ink, radius: 12 });
    await add({ ...base(), type: "circle", name: "Contexto Git · luz 1", x: x + pad + 22, y: y + pad + 22, width: 18, height: 18, fill: accent });
    await add({ ...base(), type: "circle", name: "Contexto Git · luz 2", x: x + pad + 50, y: y + pad + 22, width: 18, height: 18, fill: brand });
    await add({ ...base(), type: "text", name: "Contexto Git · comando", content: "$ git remote -v", x: x + pad + 86, y: y + pad + 16, width: width - pad * 2 - 110, height: 44, fill: paper, fontFamily: "monospace", fontSize: Math.max(22, Math.min(31, width / 25)), fontWeight: 700, textAlign: "left", lineHeight: 1, charSpacing: 0 });

    const cards = [
      { title: "LOCAL", body: "TU REPOSITORIO", color: ink },
      { title: "ORIGIN", body: "ALIAS POR DEFECTO", color: accent },
      { title: "REMOTE", body: "URL DEL SERVIDOR", color: brand },
    ];
    for (const [index, card] of cards.entries()) {
      const cardX = x + pad + index * (cardWidth + cardGap);
      await add({ ...base(), type: "rect", name: `Contexto Git · tarjeta ${card.title}`, x: cardX, y: cardY, width: cardWidth, height: cardHeight, fill: "#FFFFFF", stroke: card.color, strokeWidth: 4, radius: 16 });
      await add({ ...base(), type: "circle", name: `Contexto Git · nodo ${card.title}`, x: cardX + cardWidth / 2 - 18, y: cardY + 30, width: 36, height: 36, fill: card.color });
      await add({ ...base(), type: "text", name: `Contexto Git · título ${card.title}`, content: card.title, x: cardX + 16, y: cardY + 82, width: cardWidth - 32, height: 48, fill: ink, fontFamily: "Arial", fontSize: Math.max(24, Math.min(36, cardWidth / 5)), fontWeight: 900, textAlign: "center", lineHeight: 1, charSpacing: 0 });
      await add({ ...base(), type: "text", name: `Contexto Git · detalle ${card.title}`, content: card.body, x: cardX + 12, y: cardY + 132, width: cardWidth - 24, height: 42, fill: card.color, fontFamily: "Arial", fontSize: Math.max(14, Math.min(20, cardWidth / 8)), fontWeight: 800, textAlign: "center", lineHeight: 1, charSpacing: 20 });
      if (index < cards.length - 1) {
        await add({ ...base(), type: "arrow", name: `Contexto Git · conexión ${index + 1}`, x: cardX + cardWidth - 4, y: cardY + cardHeight / 2 - 18, width: cardGap + 8, height: 36, fill: accent, stroke: accent, strokeWidth: 6 });
      }
    }

    const footerY = y + height - Math.max(90, height * .15);
    await add({ ...base(), type: "text", name: "Contexto Git · ejemplo URL", content: "origin   https://github.com/usuario/proyecto.git", x: x + pad, y: footerY, width: width - pad * 2, height: 52, fill: ink, fontFamily: "monospace", fontSize: Math.max(18, Math.min(27, width / 28)), fontWeight: 700, textAlign: "center", lineHeight: 1, charSpacing: 0 });
    return added;
  }

  @HostListener("window:keydown", ["$event"])
  onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.matches("input, textarea") || target?.isContentEditable) return;
    const command = event.metaKey || event.ctrlKey;
    if (this.assetBuilderOpen()) {
      const key = event.key.toLowerCase();
      if (command && key === "z") { event.preventDefault(); event.shiftKey ? this.redoManualAsset() : this.undoManualAsset(); return; }
      if (command && key === "d") { event.preventDefault(); this.duplicateManualAssetElement(); return; }
      if (command && key === "s") { event.preventDefault(); void this.saveManualAsset(false); return; }
      if (["backspace", "delete"].includes(key)) { event.preventDefault(); this.removeManualAssetElement(); return; }
      const tool = ({ v: "select", p: "pen", r: "rect", o: "circle", l: "line", a: "arrow", s: "star", t: "text" } as Record<string, ManualAssetTool>)[key];
      if (tool && !command) { event.preventDefault(); this.setManualAssetTool(tool); return; }
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        if (key === "arrowleft") this.nudgeManualAsset(-amount, 0);
        if (key === "arrowright") this.nudgeManualAsset(amount, 0);
        if (key === "arrowup") this.nudgeManualAsset(0, -amount);
        if (key === "arrowdown") this.nudgeManualAsset(0, amount);
        return;
      }
      if (key === "escape") { this.setManualAssetTool("select"); this.selectedManualAssetId.set(null); return; }
      return;
    }
    if (command && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); }
    if (command && event.key.toLowerCase() === "d") { event.preventDefault(); this.duplicateSelected(); }
    if (command && event.key.toLowerCase() === "c") { event.preventDefault(); this.clipboard = this.selectedSceneElements().map((item) => structuredClone(item)); }
    if (command && event.key.toLowerCase() === "v" && this.clipboard?.length) { event.preventDefault(); for (const element of this.clipboard) this.addElement({ ...structuredClone(element), id: crypto.randomUUID(), x: element.x + 32, y: element.y + 32 }, false); this.commit("Elementos pegados"); }
    if (["Backspace", "Delete"].includes(event.key)) { event.preventDefault(); this.removeSelected(); }
  }

  @HostListener("window:paste", ["$event"])
  async onPaste(event: ClipboardEvent) {
    const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      // La imagen pegada es una REFERENCIA: la analiza MiMo 2.5 y se intenta
      // generar una versión editable siguiendo el borrador/tema en desarrollo.
      const ok = await this.pasteImageAsReference(file);
      if (!ok) await this.insertImageFile(file, "clipboard");
    }
  }

  /** Pega una imagen como REFERENCIA: la envía a MiMo 2.5 (visión), que extrae
   *  composición/paleta/elementos adaptados al borrador actual, y construye un
   *  blueprint SVG editable (nada del contenido literal de la imagen). Devuelve
   *  true si se generó la versión editable, false para que el caller caiga al
   *  insertado directo como capa de imagen. */
  private async pasteImageAsReference(file: File): Promise<boolean> {
    const scene = this.scene();
    if (!scene) return false;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      const draft = `${this.slide.headline} ${this.slide.body}`.trim();
      const genericDraft = /(?:titular|cuerpo) de prueba|el sistema antes que el prompt|la plantilla conserva|lorem ipsum|sin t[ií]tulo/iu.test(draft);
      this.enriching.set(true);
      this.visualStage.set("interpreting");
      this.visualFeedback.set({ tone: "working", message: "MiMo está analizando la referencia y adaptándola al borrador…" });
      this.status.set("Analizando la imagen de referencia con MiMo 2.5…");

      const reference = await this.generation.analyzeReferenceImage({
        imageBase64: dataUrl,
        draftContext: draft,
        theme: this.slide.headline,
        palette: this.activePalette(),
        autoDemo: genericDraft,
      });

      // Normaliza el spec remoto al VisualIntent canónico (mismo path que el
      // generador contextual) y construye el blueprint editable.
      const referencePalette = reference.referenceStyle?.colorRoles
        ? [reference.referenceStyle.colorRoles.secondary, reference.referenceStyle.colorRoles.accent, reference.referenceStyle.colorRoles.paper, reference.referenceStyle.colorRoles.ink]
        : reference.palette?.length ? reference.palette : this.activePalette();
      const request = {
        selectedText: reference.concept ?? this.slide.headline,
        slideContext: draft,
        assetOnly: false,
        palette: referencePalette,
        previousSignatures: this.assets().flatMap((asset) => asset.blueprint?.intent.signature ? [asset.blueprint.intent.signature] : []),
        requestedMode: "auto" as VisualGenerationMode,
        variantSeed: crypto.randomUUID(),
      };
      const intent = normalizeVisualIntent(reference, request);
      intent.signature = `${intent.composition}:${request.previousSignatures.filter((s) => s.startsWith(`${intent.composition}:`)).length}:${crypto.randomUUID()}`;

      this.visualStage.set("diagram");
      this.visualFeedback.set({ tone: "working", message: "Construyendo la versión editable de la referencia…" });
      const blueprint = createVisualBlueprint(intent, request.palette, draft);
      const saved = await this.saveVisualBlueprint(blueprint);
      await this.refreshLibrary();
      const reconstructsFullLayout = ["typographic-poster", "symbolic-poster", "editorial-grid", "editorial-comparison"].includes(intent.composition)
        || ["editorial-layout", "collage"].includes(intent.referenceStyle?.family ?? "");
      if (reconstructsFullLayout) await this.applyReferenceBlueprint(saved, blueprint);
      else await this.insertContextualAsset(saved);
      this.status.set(`Referencia analizada → “${saved.name}” creado como ${blueprint.elements.length} capas editables, adaptado a tu borrador.`);
      this.visualFeedback.set({ tone: "success", message: `Versión editable creada con ${blueprint.elements.length} capas SVG.` });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo analizar la referencia.";
      this.status.set(`No se generó versión editable (${message}). Se inserta la imagen original como capa.`);
      this.visualFeedback.set({ tone: "error", message: `MiMo no pudo generar la versión editable: ${message}` });
      return false;
    } finally {
      this.enriching.set(false);
      this.visualStage.set("idle");
    }
  }

  private async initializeLocalData() {
    this.storage.set(await this.library.initialize());
    for (const asset of [...CURATED_ASSETS, ...editorialPrimitiveAssets()]) await this.library.saveAsset(asset);
    await this.library.upsertBuiltinTemplates(templateCatalog(this.channel));
    await this.refreshLibrary();
  }

  private async refreshLibrary() {
    const [assets, templates, storage] = await Promise.all([this.library.assets(), this.library.templates(), this.library.storageStatus()]);
    const cleanedAssets = await Promise.all(assets.map(async (asset) => {
      if (!asset.svg) return asset;
      const svg = stripLegacyContextualOrnament(asset.svg);
      if (svg === asset.svg) return asset;
      const migrated = { ...asset, svg, hash: await this.hash(svg), version: asset.version + 1 };
      await this.library.saveAsset(migrated, { deduplicate: false });
      return migrated;
    }));
    const reusableAssets = cleanedAssets.filter(isReusableAsset);
    this.assets.set(reusableAssets);
    this.assetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.assetObjectUrls.clear();
    const previews: Record<string, string> = {};
    await Promise.all(reusableAssets.filter((asset) => asset.format !== "svg").map(async (asset) => {
      const blob = await this.library.readLargeBlob(asset.id);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      this.assetObjectUrls.set(asset.id, url);
      previews[asset.id] = url;
    }));
    this.assetPreviews.set(previews);
    this.templates.set(templates.filter((template) => template.channel === this.channel && (template.source === "user" || template.catalogVersion >= TEMPLATE_CATALOG_VERSION)));
    this.storage.set(storage);
  }

  private async loadSlide() {
    if (!this.canvas || !this.slide || !this.brand) return;
    const sceneId = `scene-${this.slide.id}`;
    const stored = await this.library.scene(sceneId);
    const sourceScene = stored ? this.cleanLegacyTemplateDecorations(stored) : createScene(this.slide, this.brand, this.channel);
    const palette = sourceScene.palette?.length === 4 ? sourceScene.palette : this.brand.palette.length >= 4 ? this.brand.palette.slice(0, 4) : [...DEFAULT_EDITOR_PALETTE];
    const scene = { ...sourceScene, palette: [...palette], paletteId: sourceScene.paletteId ?? findPaletteId(palette) };
    this.activePalette.set([...palette]);
    this.activePaletteId.set(scene.paletteId);
    this.history = [];
    this.historyIndex = -1;
    this.previewCache.clear();
    await this.renderScene(scene, true);
    const removed = stored ? stored.elements.length - scene.elements.length : 0;
    this.status.set(stored
      ? removed > 0 ? `Escena restaurada y ${removed} decoraciones antiguas acumuladas fueron retiradas.` : "Escena restaurada desde el almacenamiento local."
      : "Escena editable creada. Todo lo que ves son objetos independientes.");
  }

  private cleanLegacyTemplateDecorations(scene: SceneDocument): SceneDocument {
    let changed = false;
    const elements = scene.elements
      .filter((element) => !(element.type === "svg" && !element.assetId && element.name === "Decoración SVG"))
      .map((element, index) => {
        const svg = element.type === "svg" && element.svg ? stripLegacyContextualOrnament(element.svg) : element.svg;
        if (svg !== element.svg || element.zIndex !== index) changed = true;
        return { ...element, svg, zIndex: index };
      });
    return !changed && elements.length === scene.elements.length ? scene : { ...scene, elements, updatedAt: new Date().toISOString() };
  }

  private async renderScene(scene: SceneDocument, pushHistory: boolean) {
    if (!this.canvas) return;
    this.applying = true;
    const palette = scene.palette?.length === 4 ? scene.palette : this.activePalette();
    this.activePalette.set([...palette]);
    this.activePaletteId.set(scene.paletteId ?? findPaletteId(palette));
    this.scene.set(structuredClone(scene));
    this.canvas.clear();
    this.canvas.setDimensions({ width: scene.width, height: scene.height });
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.backgroundColor = scene.background;
    for (const element of [...scene.elements].sort((a, b) => a.zIndex - b.zIndex)) await this.addElement(element, false);
    this.canvas.discardActiveObject();
    this.selected.set(null);
    this.selectedIds.set([]);
    this.fitCanvas();
    this.canvas.requestRenderAll();
    this.applying = false;
    if (pushHistory) this.pushHistory(scene);
    this.scheduleSave();
    this.sceneChanged.emit(structuredClone(scene));
  }

  private async addElement(element: SceneElement, commit: boolean) {
    if (!this.canvas) return;
    if (element.type === "svg" && !element.svg && element.assetId) {
      const asset = this.assets().find((item) => item.id === element.assetId);
      if (asset?.svg) element = { ...element, svg: asset.svg, motion: element.motion ?? asset.motion };
    }
    if (element.type === "svg" && element.svg) {
      const svg = stripLegacyContextualOrnament(element.svg);
      if (svg !== element.svg) element = { ...element, svg };
    }
    if (element.type === "image" && !element.src && element.assetId) {
      const blob = await this.library.readLargeBlob(element.assetId);
      if (blob) element = { ...element, src: await this.blobToDataUrl(blob) };
    }
    // Fabric 7 uses centered origins in this build. SceneDocument coordinates are
    // top-left based, so leaving the origin implicit shifts wide elements half
    // their width outside the publication (most visible with headlines).
    const options = {
      left: element.x,
      top: element.y,
      originX: "left" as const,
      originY: "top" as const,
      opacity: element.opacity,
      angle: element.rotation,
      visible: element.visible,
      selectable: !element.locked,
      evented: !element.locked,
    };
    let object: PolyObject;
    if (element.type === "text") {
      object = new Textbox(element.content ?? "", { ...options, width: element.width, fill: element.fill, fontFamily: element.fontFamily, fontSize: element.fontSize, fontWeight: element.fontWeight, textAlign: element.textAlign, lineHeight: element.lineHeight, charSpacing: element.charSpacing, editable: !element.locked }) as PolyObject;
    } else if (element.type === "rect") {
      object = new Rect({ ...options, width: element.width, height: element.height, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0, rx: element.radius ?? 8, ry: element.radius ?? 8 }) as PolyObject;
    } else if (element.type === "circle") {
      object = new Circle({ ...options, radius: element.width / 2, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0 }) as PolyObject;
    } else if (element.type === "ellipse") {
      object = new Ellipse({ ...options, rx: element.width / 2, ry: element.height / 2, fill: element.fill, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0 }) as PolyObject;
    } else if (element.type === "line") {
      object = new Line([0, 0, element.width, element.height], { ...options, stroke: element.stroke, strokeWidth: element.strokeWidth ?? 4, strokeLineCap: "round" }) as PolyObject;
    } else if (element.type === "arrow") {
      const line = new Line([0, element.height / 2, element.width - 30, element.height / 2], { stroke: element.stroke, strokeWidth: element.strokeWidth ?? 9, strokeLineCap: "round" });
      const head = new Triangle({ left: element.width - 30, top: element.height / 2, width: 38, height: 42, originX: "center", originY: "center", angle: 90, fill: element.fill });
      object = new Group([line, head], { ...options }) as PolyObject;
    } else if (element.type === "image" && element.src) {
      object = await FabricImage.fromURL(element.src, { crossOrigin: "anonymous" }, options) as PolyObject;
      this.fitMediaObject(object, element);
    } else if (element.type === "svg" && element.svg) {
      const source = await this.svgToPngDataUrl(element.svg);
      object = await FabricImage.fromURL(source, {}, options) as PolyObject;
      this.fitMediaObject(object, element);
    } else return;
    object.scaleX *= element.scaleX;
    object.scaleY *= element.scaleY;
    if (object instanceof FabricImage && element.type === "image") this.applyImageVisuals(object, element);
    if (element.shadowColor) object.set({ shadow: new Shadow({ color: element.shadowColor, blur: element.shadowBlur ?? 20, offsetX: element.shadowOffsetX ?? 0, offsetY: element.shadowOffsetY ?? 12 }) });
    object.set({ lockMovementX: element.locked, lockMovementY: element.locked, lockRotation: element.locked, lockScalingX: element.locked, lockScalingY: element.locked, transparentCorners: false, cornerColor: "#B8F34A", cornerStrokeColor: "#10251E", borderColor: "#2F5DE5", cornerSize: 18 });
    this.tagObject(object, element);
    this.canvas.add(object);
    if (commit) { this.canvas.setActiveObject(object); this.commit(`${element.name} añadido`); }
  }

  private fitMediaObject(object: PolyObject, element: SceneElement) {
    const naturalWidth = Math.max(1, object.width);
    const naturalHeight = Math.max(1, object.height);
    const targetWidth = Math.max(1, element.width);
    const targetHeight = Math.max(1, element.height);
    const scale = element.imageFit === "cover"
      ? Math.max(targetWidth / naturalWidth, targetHeight / naturalHeight)
      : Math.min(targetWidth / naturalWidth, targetHeight / naturalHeight);
    object.set({
      scaleX: scale,
      scaleY: scale,
      left: element.x + (targetWidth - naturalWidth * scale) / 2,
      top: element.y + (targetHeight - naturalHeight * scale) / 2,
    });
  }

  private applyImageVisuals(object: FabricImage & PolyObject, element: SceneElement) {
    object.polyImageFrame = element.imageFrame ?? "none";
    object.polyImageBlur = element.imageBlur ?? 0;
    object.polyImageBrightness = element.imageBrightness ?? 0;
    object.polyImageContrast = element.imageContrast ?? 0;
    object.polyImageSaturation = element.imageSaturation ?? 0;
    object.polyImagePixelate = element.imagePixelate ?? 7;
    object.polyImageNoise = element.imageNoise ?? 0;
    object.polyImageFilterMode = element.imageFilterMode ?? "none";
    object.polyImageFit = element.imageFit ?? "contain";
    object.polyIsBackground = element.isBackground ?? false;
    object.polyRadius = element.radius ?? 0;
    object.set({ stroke: element.stroke, strokeWidth: element.strokeWidth ?? 0, strokeUniform: true, paintFirst: "stroke" });
    this.applyImageClip(object, element.radius ?? 0);
    this.applyImageFilters(object);
  }

  private applyImageClip(object: FabricImage & PolyObject, radius: number) {
    if (!radius) {
      object.clipPath = undefined;
      return;
    }
    const scale = Math.max(.001, Math.min(Math.abs(object.scaleX || 1), Math.abs(object.scaleY || 1)));
    const naturalRadius = radius / scale;
    object.clipPath = new Rect({
      width: object.width,
      height: object.height,
      rx: naturalRadius,
      ry: naturalRadius,
      originX: "center",
      originY: "center",
    });
  }

  private applyImageFilters(object: FabricImage & PolyObject) {
    const activeFilters = [];
    if (object.polyImageBlur) activeFilters.push(new filters.Blur({ blur: object.polyImageBlur }));
    if (object.polyImageBrightness) activeFilters.push(new filters.Brightness({ brightness: object.polyImageBrightness }));
    if (object.polyImageContrast) activeFilters.push(new filters.Contrast({ contrast: object.polyImageContrast }));
    if (object.polyImageSaturation) activeFilters.push(new filters.Saturation({ saturation: object.polyImageSaturation }));
    if (["bitmap", "halftone", "cross-stitch"].includes(object.polyImageFilterMode ?? "")) {
      activeFilters.push(new EditorialRasterFilter({
        style: object.polyImageFilterMode as "bitmap" | "halftone" | "cross-stitch",
        size: Math.max(3, object.polyImagePixelate ?? 7), ink: this.activePalette()[3] ?? "#10251E", paper: this.activePalette()[2] ?? "#F3F7F2",
      }));
    }
    if (object.polyImageFilterMode === "sepia") activeFilters.push(new filters.Sepia());
    if (object.polyImageFilterMode === "invert") activeFilters.push(new filters.Invert());
    if (object.polyImageFilterMode === "mosaic") activeFilters.push(new filters.Pixelate({ blocksize: Math.max(2, object.polyImagePixelate ?? 12) }));
    if (object.polyImageNoise) activeFilters.push(new filters.Noise({ noise: object.polyImageNoise }));
    object.filters = activeFilters;
    object.applyFilters();
  }

  private async svgToPngDataUrl(svg: string) {
    const match = svg.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    const width = Math.max(1, Number(match?.[1] ?? 512));
    const height = Math.max(1, Number(match?.[2] ?? 512));
    const scale = Math.min(4, 1024 / Math.max(width, height));
    const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("No se pudo renderizar el SVG"));
        element.src = source;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No se pudo preparar la vista previa del SVG");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  private tagObject(object: PolyObject, element: SceneElement) {
    object.polyId = element.id;
    object.polyType = element.type;
    object.polyAssetId = element.assetId;
    object.polyName = element.name;
    object.polySvg = element.svg;
    object.polySrc = element.src;
    object.polyMotion = element.motion;
    object.polyImageFrame = element.imageFrame;
    object.polyImageBlur = element.imageBlur;
    object.polyImageBrightness = element.imageBrightness;
    object.polyImageContrast = element.imageContrast;
    object.polyImageSaturation = element.imageSaturation;
    object.polyImagePixelate = element.imagePixelate;
    object.polyImageNoise = element.imageNoise;
    object.polyImageFilterMode = element.imageFilterMode;
    object.polyImageFit = element.imageFit;
    object.polyIsBackground = element.isBackground;
    object.polyRadius = element.radius;
    object.polyGeneratedVisualId = element.generatedVisualId;
    object.polyVisualRole = element.visualRole;
  }

  private registerCanvasEvents() {
    if (!this.canvas) return;
    this.canvas.on("selection:created", () => this.syncSelection());
    this.canvas.on("selection:updated", () => this.syncSelection());
    this.canvas.on("selection:cleared", () => { this.selected.set(null); this.selectedIds.set([]); });
    this.canvas.on("object:modified", () => this.commit("Transformación guardada"));
    this.canvas.on("text:changed", () => this.commit("Texto actualizado"));
    this.canvas.on("object:moving", ({ target }) => this.snapObject(target));
  }

  private snapObject(object?: FabricObject) {
    const scene = this.scene();
    if (!object || !scene) return;
    const tolerance = 12;
    const centerX = object.left + object.getScaledWidth() / 2;
    const centerY = object.top + object.getScaledHeight() / 2;
    if (Math.abs(centerX - scene.width / 2) < tolerance) object.left = scene.width / 2 - object.getScaledWidth() / 2;
    if (Math.abs(centerY - scene.height / 2) < tolerance) object.top = scene.height / 2 - object.getScaledHeight() / 2;
    if (Math.abs(object.left - 72) < tolerance) object.left = 72;
    if (Math.abs(object.top - 72) < tolerance) object.top = 72;
  }

  private serializeCanvas(): SceneDocument | null {
    const current = this.scene();
    if (!current || !this.canvas) return null;
    const elements = this.canvas.getObjects().map((object, index) => this.objectToElement(object as PolyObject, index));
    return { ...current, background: String(this.canvas.backgroundColor ?? current.background), elements, updatedAt: new Date().toISOString() };
  }

  private objectToElement(object: PolyObject, zIndex: number): SceneElement {
    const type = object.polyType ?? "rect";
    const element: SceneElement = {
      id: object.polyId ?? crypto.randomUUID(), type, name: object.polyName ?? "Elemento", x: object.left, y: object.top,
      width: object.width, height: object.height, scaleX: object.scaleX, scaleY: object.scaleY, rotation: object.angle,
      opacity: object.opacity, zIndex, visible: object.visible, locked: !object.selectable, assetId: object.polyAssetId,
      motion: object.polyMotion, generatedVisualId: object.polyGeneratedVisualId, visualRole: object.polyVisualRole,
      fill: typeof object.fill === "string" ? object.fill : undefined, stroke: typeof object.stroke === "string" ? object.stroke : undefined, strokeWidth: object.strokeWidth,
    };
    if (object instanceof Textbox) Object.assign(element, { content: object.text, fontFamily: object.fontFamily, fontSize: object.fontSize, fontWeight: object.fontWeight, textAlign: object.textAlign as SceneElement["textAlign"], lineHeight: object.lineHeight, charSpacing: object.charSpacing });
    const previous = this.scene()?.elements.find((item) => item.id === element.id);
    const shadow = object.shadow instanceof Shadow ? object.shadow : undefined;
    if (shadow) Object.assign(element, { shadowColor: shadow.color, shadowBlur: shadow.blur, shadowOffsetX: shadow.offsetX, shadowOffsetY: shadow.offsetY });
    if (object instanceof Rect) element.radius = object.rx;
    if (type === "svg") element.svg = object.polySvg ?? previous?.svg;
    if (type === "image") Object.assign(element, {
      src: object.polySrc ?? previous?.src,
      radius: object.polyRadius ?? previous?.radius,
      imageFrame: object.polyImageFrame ?? previous?.imageFrame,
      imageBlur: object.polyImageBlur ?? previous?.imageBlur ?? 0,
      imageBrightness: object.polyImageBrightness ?? previous?.imageBrightness ?? 0,
      imageContrast: object.polyImageContrast ?? previous?.imageContrast ?? 0,
      imageSaturation: object.polyImageSaturation ?? previous?.imageSaturation ?? 0,
      imagePixelate: object.polyImagePixelate ?? previous?.imagePixelate ?? 7,
      imageNoise: object.polyImageNoise ?? previous?.imageNoise ?? 0,
      imageFilterMode: object.polyImageFilterMode ?? previous?.imageFilterMode ?? "none",
      imageFit: object.polyImageFit ?? previous?.imageFit ?? "contain",
      isBackground: object.polyIsBackground ?? previous?.isBackground ?? false,
    });
    if (type === "image" && element.isBackground) Object.assign(element, {
      x: 0,
      y: 0,
      width: this.scene()?.width ?? element.width,
      height: this.scene()?.height ?? element.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
    return element;
  }

  private commit(message: string) {
    if (this.applying) return;
    const scene = this.serializeCanvas();
    if (!scene) return;
    this.scene.set(scene);
    this.pushHistory(scene);
    this.syncSelection();
    this.scheduleSave();
    this.status.set(message);
    this.sceneChanged.emit(structuredClone(scene));
  }

  private pushHistory(scene: SceneDocument) {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(structuredClone(scene));
    if (this.history.length > 60) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.updateHistoryButtons();
  }

  private updateHistoryButtons() {
    this.canUndo.set(this.historyIndex > 0);
    this.canRedo.set(this.historyIndex >= 0 && this.historyIndex < this.history.length - 1);
  }

  private scheduleSave() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(async () => {
      const scene = this.scene();
      if (!scene) return;
      await this.library.saveScene(scene);
      this.storage.set(await this.library.storageStatus());
    }, 500);
  }

  private syncSelection() {
    const active = this.canvas?.getActiveObjects().map((item) => item as PolyObject) ?? [];
    const ids = active.map((item) => item.polyId).filter((id): id is string => Boolean(id));
    this.selectedIds.set(ids);
    const scene = this.serializeCanvas();
    if (scene) this.scene.set(scene);
    this.selected.set(ids.length === 1 ? scene?.elements.find((element) => element.id === ids[0]) ?? null : null);
  }

  private selectedSceneElements() {
    const ids = new Set(this.selectedIds());
    return this.scene()?.elements.filter((element) => ids.has(element.id)) ?? [];
  }

  private findObject(id: string) { return this.canvas?.getObjects().find((item) => (item as PolyObject).polyId === id) as PolyObject | undefined; }

  private fitCanvas() {
    const scene = this.scene();
    if (!this.canvas || !scene || !this.stage) return;
    const available = Math.max(280, this.stage.nativeElement.clientWidth - 36);
    const availableHeight = Math.max(420, this.stage.nativeElement.clientHeight - 84);
    this.baseScale = Math.min(available / scene.width, availableHeight / scene.height);
    this.applyZoom();
  }

  private applyZoom() {
    const scene = this.scene();
    if (!this.canvas || !scene) return;
    const scale = this.currentScale();
    const width = Math.round(scene.width * scale);
    const height = Math.round(scene.height * scale);
    this.canvasFrame.nativeElement.style.width = `${width}px`;
    this.canvasFrame.nativeElement.style.height = `${height}px`;
    const container = this.canvasElement.nativeElement.parentElement;
    if (container) {
      container.style.position = "absolute";
      container.style.inset = "0 auto auto 0";
      container.style.transformOrigin = "top left";
      container.style.transform = `scale(${scale})`;
    }
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
  }

  private currentScale() { return this.baseScale * this.zoom() / 100; }

  private async insertImageFile(file: File, source: "upload" | "clipboard" | "ai", generation?: { prompt: string; model: string }, placement?: { x: number; y: number; width: number; height?: number }, asBackground = false) {
    const scene = this.scene();
    if (!scene) return;
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const bitmap = await createImageBitmap(file);
    const aspectRatio = bitmap.width / Math.max(1, bitmap.height);
    bitmap.close();
    const hash = await this.hash(await file.arrayBuffer());
    const asset: LibraryAsset = {
      id: crypto.randomUUID(), name: file.name || "Imagen pegada", kind: asBackground ? "background" : source === "ai" ? "illustration" : "screenshot",
      format: file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpeg", source, scope: "atomic",
      themes: this.analysis().concepts, tags: [...this.analysis().entities, source === "ai" ? "generated" : "screenshot"],
      style: source === "ai" ? "contextual-editorial" : "original", colors: source === "ai" ? this.activePalette() : [],
      aspectRatio, compatibleBackgrounds: ["light", "dark", "color"], prompt: generation?.prompt, model: generation?.model,
      hash, useCount: 0, createdAt: new Date().toISOString(), version: 1,
    };
    const saved = await this.library.saveAsset(asset);
    await this.library.writeLargeBlob(saved.id, file);
    const width = asBackground ? scene.width : placement?.width ?? scene.width * (source === "ai" ? .42 : .68);
    const height = asBackground ? scene.height : placement?.height ?? width / aspectRatio;
    const isScreenshot = source !== "ai" && aspectRatio > 1.12;
    const palette = this.activePalette();
    const elementId = crypto.randomUUID();
    await this.addElement({
      id: elementId, type: "image", name: asBackground ? `Fondo · ${saved.name}` : saved.name, x: asBackground ? 0 : placement?.x ?? 110, y: asBackground ? 0 : placement?.y ?? 430,
      width, height, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, zIndex: asBackground ? 0 : scene.elements.length,
      visible: true, locked: false, assetId: saved.id, src: dataUrl,
      imageFrame: asBackground ? "none" : isScreenshot ? "window" : "soft", radius: asBackground ? 0 : isScreenshot ? 18 : 32,
      stroke: asBackground ? undefined : isScreenshot ? palette[1] : `${palette[1]}33`, strokeWidth: asBackground ? 0 : isScreenshot ? 12 : 10,
      shadowColor: asBackground ? undefined : isScreenshot ? palette[3] : `${palette[1]}55`, shadowBlur: asBackground ? 0 : isScreenshot ? 0 : 28,
      shadowOffsetX: isScreenshot ? 12 : 0, shadowOffsetY: isScreenshot ? 12 : 18,
      imageBlur: 0, imageBrightness: 0, imageContrast: .04, imageSaturation: 0, imagePixelate: 7, imageNoise: 0, imageFilterMode: "none",
      imageFit: asBackground ? "cover" : "contain", isBackground: asBackground,
    }, false);
    const inserted = this.findObject(elementId);
    if (inserted && this.canvas) {
      if (asBackground) this.canvas.sendObjectToBack(inserted);
      this.canvas.setActiveObject(inserted);
      this.commit(asBackground ? "Imagen añadida como fondo editable" : "Imagen añadida");
    }
    await this.refreshLibrary();
    this.status.set(asBackground ? "Fondo añadido. Puedes oscurecerlo, desenfocarlo o cambiar su contraste." : "Imagen añadida como objeto editable y guardada en la biblioteca.");
  }

  private async hash(value: string | ArrayBuffer) {
    const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  private blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private slug() { return `${this.brand.name}-${this.slide.headline}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
}
