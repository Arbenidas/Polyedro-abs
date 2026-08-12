import type { ContentChannel } from "../../editorial.models";

export const SCENE_VERSION = 1;

export const CHANNEL_SIZES: Record<ContentChannel, { width: number; height: number; label: string }> = {
  instagram_portrait: { width: 1080, height: 1350, label: "Instagram 4:5" },
  instagram_square: { width: 1080, height: 1080, label: "Instagram cuadrado" },
  linkedin_portrait: { width: 1080, height: 1350, label: "LinkedIn 4:5" },
  tiktok_vertical: { width: 1080, height: 1920, label: "TikTok vertical" },
};

export type SceneElementType = "text" | "rect" | "circle" | "ellipse" | "line" | "arrow" | "image" | "svg";
export type MotionPreset = "float" | "pulse" | "wiggle" | "orbit" | "draw";
export type ImageFramePreset = "none" | "clean" | "window" | "soft" | "polaroid" | "glass" | "tape" | "sticker";
export type ImageFilterMode = "none" | "bitmap" | "halftone" | "mosaic" | "cross-stitch" | "sepia" | "invert";
export type VisualGenerationMode = "auto" | "diagram" | "image";
export type VisualOutputKind = "diagram" | "image";
export type VisualRole = "shape" | "label" | "connector" | "measurement" | "illustration";
export type VisualComposition = "hick-fitts" | "measurement" | "comparison" | "flow" | "architecture" | "data" | "icon" | "git-merge" | "typographic-poster" | "symbolic-poster" | "editorial-grid" | "editorial-comparison" | "editorial-diagram" | "object" | "scene" | "metaphor";

export type EditorialDiagramKind = "flow" | "timeline" | "comparison" | "layers" | "cycle" | "system";

export type EditorialDiagramProfile = {
  kind: EditorialDiagramKind;
  title: string;
  caption: string;
  nodes: Array<{
    id: string;
    label: string;
    detail: string;
    icon: string;
    group?: "left" | "right" | "center";
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
  compareLabels?: [string, string];
};

export type ReferenceStyleProfile = {
  family: "typographic-poster" | "editorial-layout" | "diagram" | "collage" | "image-led";
  layoutArchetype: "type-led" | "symbol-led" | "grid" | "split" | "framed" | "collage" | "diagrammatic";
  alignment: "left" | "center" | "right" | "asymmetric";
  focalPoint: { x: number; y: number; width: number };
  headlineScale: "medium" | "large" | "massive";
  displayFont: "grotesk" | "condensed" | "serif" | "mono";
  supportingFont: "grotesk" | "condensed" | "serif" | "mono";
  headlineWeight: number;
  lineHeight: number;
  tracking: number;
  textCase: "sentence" | "uppercase" | "mixed";
  accentMode: "word" | "block" | "underline" | "none";
  negativeSpace: "compact" | "balanced" | "expansive";
  texture: "clean" | "paper" | "grain" | "halftone";
  motifPlacement: "corners" | "edges" | "around-focal" | "none";
  dominantMotif: {
    kind: "punctuation" | "number" | "letter" | "geometric" | "frame" | "abstract" | "none";
    value: string;
    treatment: "solid" | "outline" | "cutout" | "repeated" | "cropped";
    x: number;
    y: number;
    width: number;
    rotation: number;
  };
  gridProfile: {
    columns: 2 | 3;
    rows: 1 | 2 | 3;
    numbered: boolean;
    iconStyle: "outlined" | "filled";
    cardTreatment: "open" | "outlined" | "soft";
    footerBand: boolean;
  };
  colorRoles: { paper: string; ink: string; accent: string; secondary: string };
  summary: string;
};

export type TemplateUsageProfile = {
  intent: string;
  roles: Array<"cover" | "intro" | "step" | "comparison" | "summary" | "cta">;
  contentTypes: string[];
  keywords: string[];
  avoidWhen: string[];
};

export type EditorialCopyProfile = {
  kicker: string;
  headline: string;
  deck: string;
  closingInsight: string;
};

export type EditorialComparisonProfile = {
  leftLabel: string;
  rightLabel: string;
  leftItems: Array<{ title: string; detail: string; icon: string }>;
  rightItems: Array<{ title: string; detail: string; icon: string }>;
  footer: string;
};

export type VisualIntent = {
  version: 1;
  output: VisualOutputKind;
  concept: string;
  elements: string[];
  relations: Array<{ from: string; to: string; kind: "connects" | "compares" | "contains" | "measures"; label?: string }>;
  exactLabels: string[];
  composition: VisualComposition;
  aspectRatio: number;
  prompt: string;
  rationale: string;
  signature: string;
  referenceStyle?: ReferenceStyleProfile;
  templateUsage?: TemplateUsageProfile;
  editorialCopy?: EditorialCopyProfile;
  comparisonProfile?: EditorialComparisonProfile;
  diagramProfile?: EditorialDiagramProfile;
};

export type SceneElement = {
  id: string;
  type: SceneElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  content?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  charSpacing?: number;
  assetId?: string;
  src?: string;
  svg?: string;
  motion?: MotionPreset;
  imageFrame?: ImageFramePreset;
  imageBlur?: number;
  imageBrightness?: number;
  imageContrast?: number;
  imageSaturation?: number;
  imagePixelate?: number;
  imageNoise?: number;
  imageFilterMode?: ImageFilterMode;
  imageFit?: "contain" | "cover";
  isBackground?: boolean;
  generatedVisualId?: string;
  visualRole?: VisualRole;
};

export type VisualBlueprint = {
  version: 1;
  kind: "diagram";
  width: number;
  height: number;
  sourceText: string;
  palette: string[];
  intent: VisualIntent;
  elements: SceneElement[];
};

export type SceneDocument = {
  version: typeof SCENE_VERSION;
  id: string;
  projectId: string;
  slideId: string;
  channel: ContentChannel;
  width: number;
  height: number;
  background: string;
  paletteId?: string;
  palette?: string[];
  elements: SceneElement[];
  createdAt: string;
  updatedAt: string;
};

export type AssetKind = "logo" | "icon" | "screenshot" | "illustration" | "texture" | "background" | "arrow" | "diagram" | "mockup" | "sticker";
export type AssetSource = "catalog" | "upload" | "clipboard" | "ai" | "primitive" | "user";

export type LibraryAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  format: "svg" | "png" | "jpeg" | "webp" | "gif";
  source: AssetSource;
  scope?: "atomic" | "reference" | "render";
  technology?: string;
  themes: string[];
  tags: string[];
  style: string;
  colors: string[];
  aspectRatio: number;
  compatibleBackgrounds: Array<"light" | "dark" | "color">;
  prompt?: string;
  model?: string;
  attribution?: string;
  license?: string;
  hash: string;
  perceptualHash?: string;
  useCount: number;
  createdAt: string;
  lastUsedAt?: string;
  version: number;
  derivedFromAssetId?: string;
  svg?: string;
  blob?: Blob;
  motion?: MotionPreset;
  blueprint?: VisualBlueprint;
};

export type CutoutRecord = {
  outputAssetId: string;
  sourceAssetId: string;
  alphaMask: Blob;
  modelId: string;
  modelRevision: string;
  outlineColor: string;
  outlineWidth: number;
  shadowBlur: number;
  createdAt: string;
  updatedAt: string;
};

export type TemplateSlot = {
  id: string;
  role: "headline" | "body" | "hero-image" | "logo" | "icon" | "screenshot" | "cta";
  accepts: Array<"text" | "svg" | "image">;
  required: boolean;
  fit: "contain" | "cover" | "stretch";
  constraints: Record<string, number | string>;
  frame?: { x: number; y: number; width: number; height: number };
};

export type RecipeDecoration = {
  type: "rect" | "circle" | "ellipse" | "line" | "arrow" | "svg";
  frame: { x: number; y: number; width: number; height: number };
  token: "accent" | "brand" | "paper" | "ink" | "marker" | "transparent";
  strokeToken?: "accent" | "brand" | "paper" | "ink" | "marker";
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
  radius?: number;
  svg?: string;
  motion?: MotionPreset;
};

export type TemplateSceneSnapshot = {
  background: string;
  palette: string[];
  elements: SceneElement[];
};

export type EditorialTemplate = {
  id: string;
  family: string;
  name: string;
  channel: ContentChannel;
  width: number;
  height: number;
  slideRole: "cover" | "intro" | "step" | "comparison" | "summary" | "cta";
  density: "low" | "medium" | "high";
  style: "editorial" | "technical" | "notebook" | "minimal" | "bold" | "playful";
  tags: string[];
  slots: TemplateSlot[];
  favorite: boolean;
  useCount: number;
  version: number;
  previewColors: string[];
  recipeId: string;
  source: "builtin" | "user";
  catalogVersion: number;
  compatibleContentTypes: string[];
  assetRequirement: "none" | "optional" | "image" | "screenshot" | "icons";
  safeArea: { top: number; right: number; bottom: number; left: number };
  decorations: RecipeDecoration[];
  selection?: TemplateUsageProfile;
  sceneSnapshot?: TemplateSceneSnapshot;
};

export type ContextAnalysis = {
  entities: string[];
  concepts: string[];
  visualMotifs: string[];
};

export type StorageStatus = {
  usage: number;
  quota: number;
  persistent: boolean;
};
