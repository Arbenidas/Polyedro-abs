export type ManualAssetElementType = "rect" | "circle" | "line" | "arrow" | "star" | "path" | "text";
export type ManualAssetPattern = "solid" | "outline" | "halftone" | "lines" | "mosaic" | "cross-stitch";

export type ManualAssetPoint = { x: number; y: number };

export type ManualAssetElement = {
  id: string;
  type: ManualAssetElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  pattern: ManualAssetPattern;
  patternScale: number;
  points?: ManualAssetPoint[];
  visible?: boolean;
  locked?: boolean;
};

export type ManualAssetDocument = {
  width: number;
  height: number;
  elements: ManualAssetElement[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] ?? character);

export function createManualAssetDocument(palette: string[]): ManualAssetDocument {
  return {
    width: 480,
    height: 320,
    elements: [{
      id: crypto.randomUUID(), type: "arrow", name: "Flecha 1", x: 92, y: 126, width: 296, height: 68,
      rotation: -4, fill: palette[1] ?? "#2F5DE5", stroke: palette[3] ?? "#10251E", strokeWidth: 10, radius: 0,
      pattern: "solid", patternScale: 12, visible: true, locked: false,
    }],
  };
}

export function createManualAssetElement(type: ManualAssetElementType, document: ManualAssetDocument, palette: string[]): ManualAssetElement {
  const count = document.elements.filter((item) => item.type === type).length + 1;
  const base = {
    id: crypto.randomUUID(), type, name: `${type === "text" ? "Texto" : type === "rect" ? "Rectángulo" : type === "circle" ? "Círculo" : type === "line" ? "Línea" : type === "arrow" ? "Flecha" : type === "star" ? "Estrella" : "Trazo"} ${count}`,
    x: Math.max(20, document.width / 2 - 80), y: Math.max(20, document.height / 2 - 40), width: 160, height: 80,
    rotation: 0, fill: palette[1] ?? "#2F5DE5", stroke: palette[3] ?? "#10251E", strokeWidth: 8, radius: 18,
    pattern: "solid" as ManualAssetPattern, patternScale: 12, visible: true, locked: false,
  } satisfies ManualAssetElement;
  if (type === "circle") return { ...base, width: 96, height: 96, x: document.width / 2 - 48, y: document.height / 2 - 48 };
  if (type === "line") return { ...base, width: 190, height: 1, y: document.height / 2, fill: "transparent", strokeWidth: 8, radius: 0 };
  if (type === "arrow") return { ...base, width: 210, height: 58, x: document.width / 2 - 105, y: document.height / 2 - 29, strokeWidth: 9, radius: 0 };
  if (type === "star") return { ...base, width: 112, height: 112, x: document.width / 2 - 56, y: document.height / 2 - 56, radius: 0 };
  if (type === "path") {
    const x = document.width / 2 - 100;
    const y = document.height / 2 - 45;
    return {
      ...base, x, y, width: 200, height: 90, fill: "transparent", stroke: palette[1] ?? "#2F5DE5", strokeWidth: 9, radius: 0,
      points: [{ x, y: y + 62 }, { x: x + 38, y: y + 18 }, { x: x + 86, y: y + 54 }, { x: x + 140, y: y + 12 }, { x: x + 200, y: y + 42 }],
    };
  }
  if (type === "text") return { ...base, width: 210, height: 54, x: document.width / 2 - 105, y: document.height / 2 - 27, fill: palette[3] ?? "#10251E", stroke: "transparent", strokeWidth: 0, radius: 0, text: "Tu idea", fontSize: 42, fontWeight: 900 };
  return base;
}

export function normalizeManualAssetDocument(document: ManualAssetDocument): ManualAssetDocument {
  const width = clamp(document.width, 120, 1200);
  const height = clamp(document.height, 120, 1200);
  return {
    width,
    height,
    elements: document.elements.slice(0, 64).map((item) => ({
      ...item,
      x: clamp(item.x, -width, width * 2),
      y: clamp(item.y, -height, height * 2),
      width: clamp(item.width, 1, width * 2),
      height: clamp(item.height, 1, height * 2),
      rotation: clamp(item.rotation, -360, 360),
      strokeWidth: clamp(item.strokeWidth, 0, 60),
      radius: clamp(item.radius, 0, 240),
      fontSize: item.fontSize == null ? undefined : clamp(item.fontSize, 8, 240),
      fontWeight: item.fontWeight == null ? undefined : clamp(item.fontWeight, 100, 900),
      text: item.text?.slice(0, 80),
      pattern: ["solid", "outline", "halftone", "lines", "mosaic", "cross-stitch"].includes(item.pattern) ? item.pattern : "solid",
      patternScale: clamp(item.patternScale, 3, 40),
      points: item.points?.slice(0, 512).map((point) => ({ x: clamp(point.x, -width, width * 2), y: clamp(point.y, -height, height * 2) })),
      visible: item.visible !== false,
      locked: item.locked === true,
    })),
  };
}

function rotation(element: ManualAssetElement) {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  return element.rotation ? ` transform="rotate(${element.rotation} ${centerX} ${centerY})"` : "";
}

export function manualAssetRotation(element: ManualAssetElement) { return rotation(element).trim().replace(/^transform="|"$/g, ""); }
export function manualAssetPatternId(element: ManualAssetElement) { return `manual-pattern-${element.id.replace(/[^a-z0-9_-]/gi, "")}`; }
export function manualAssetPaint(element: ManualAssetElement) {
  if (element.pattern === "outline") return "none";
  return element.pattern === "solid" ? element.fill : `url(#${manualAssetPatternId(element)})`;
}

export function manualAssetArrowPoints(element: ManualAssetElement) {
  const head = Math.min(element.height, Math.max(22, element.width * .22));
  const bodyEnd = element.x + element.width - head * .72;
  const centerY = element.y + element.height / 2;
  return `${bodyEnd},${element.y} ${element.x + element.width},${centerY} ${bodyEnd},${element.y + element.height}`;
}

export function manualAssetStarPoints(element: ManualAssetElement) {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const outerX = element.width / 2;
  const outerY = element.height / 2;
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 ? .43 : 1;
    return `${centerX + Math.cos(angle) * outerX * radius},${centerY + Math.sin(angle) * outerY * radius}`;
  }).join(" ");
}

export function manualAssetPathData(element: ManualAssetElement) {
  const points = element.points ?? [];
  if (!points.length) return "";
  if (points.length < 3) return points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const commands = [`M${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    commands.push(`Q${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`);
  }
  const last = points.at(-1)!;
  commands.push(`L${last.x} ${last.y}`);
  return commands.join(" ");
}

function compilePattern(element: ManualAssetElement) {
  if (["solid", "outline"].includes(element.pattern)) return "";
  const id = manualAssetPatternId(element);
  const scale = element.patternScale;
  const fill = escapeXml(element.fill);
  const stroke = escapeXml(element.stroke);
  if (element.pattern === "halftone") return `<pattern id="${id}" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><circle cx="${scale / 2}" cy="${scale / 2}" r="${Math.max(1, scale * .28)}" fill="${fill}"/></pattern>`;
  if (element.pattern === "lines") return `<pattern id="${id}" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><line x1="0" y1="0" x2="0" y2="${scale}" stroke="${fill}" stroke-width="${Math.max(1, scale * .28)}"/></pattern>`;
  if (element.pattern === "cross-stitch") return `<pattern id="${id}" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><path d="M2 2L${scale - 2} ${scale - 2}M${scale - 2} 2L2 ${scale - 2}" stroke="${fill}" stroke-width="${Math.max(1, scale * .18)}" stroke-linecap="round"/></pattern>`;
  const half = scale / 2;
  return `<pattern id="${id}" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><rect width="${half}" height="${half}" fill="${fill}"/><rect x="${half}" width="${half}" height="${half}" fill="${stroke}"/><rect y="${half}" width="${half}" height="${half}" fill="${stroke}" opacity=".42"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${fill}" opacity=".62"/></pattern>`;
}

function compileElement(element: ManualAssetElement) {
  const id = escapeXml(element.id);
  const common = `data-builder-id="${id}" data-builder-type="${element.type}"`;
  const transform = rotation(element);
  if (element.type === "rect") {
    return `<rect ${common} x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${Math.min(element.radius, element.width / 2, element.height / 2)}" fill="${manualAssetPaint(element)}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}"${transform}/>`;
  }
  if (element.type === "circle") {
    return `<ellipse ${common} cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${manualAssetPaint(element)}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}"${transform}/>`;
  }
  if (element.type === "line") {
    return `<line ${common} x1="${element.x}" y1="${element.y + element.height / 2}" x2="${element.x + element.width}" y2="${element.y + element.height / 2}" stroke="${element.pattern === "solid" || element.pattern === "outline" ? escapeXml(element.stroke) : manualAssetPaint(element)}" stroke-width="${element.strokeWidth}" stroke-linecap="round"${transform}/>`;
  }
  if (element.type === "arrow") {
    const head = Math.min(element.height, Math.max(22, element.width * .22));
    const bodyEnd = element.x + element.width - head * .72;
    const centerY = element.y + element.height / 2;
    const points = manualAssetArrowPoints(element);
    const paint = manualAssetPaint(element);
    return `<g ${common}${transform}><line x1="${element.x}" y1="${centerY}" x2="${bodyEnd + 2}" y2="${centerY}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth + 8}" stroke-linecap="round"/><line x1="${element.x}" y1="${centerY}" x2="${bodyEnd + 2}" y2="${centerY}" stroke="${paint}" stroke-width="${Math.max(3, element.strokeWidth)}" stroke-linecap="round"/><polygon points="${points}" fill="${paint}" stroke="${escapeXml(element.stroke)}" stroke-width="${Math.max(3, element.strokeWidth * .65)}" stroke-linejoin="round"/></g>`;
  }
  if (element.type === "star") {
    return `<polygon ${common} points="${manualAssetStarPoints(element)}" fill="${manualAssetPaint(element)}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}" stroke-linejoin="round"${transform}/>`;
  }
  if (element.type === "path") {
    const stroke = ["solid", "outline"].includes(element.pattern) ? escapeXml(element.stroke) : manualAssetPaint(element);
    return `<path ${common} d="${manualAssetPathData(element)}" fill="none" stroke="${stroke}" stroke-width="${element.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${transform}/>`;
  }
  const baseline = element.y + Math.min(element.height, (element.fontSize ?? 42) * 1.05);
  return `<text ${common} x="${element.x}" y="${baseline}" fill="${manualAssetPaint(element)}" stroke="${element.pattern === "outline" ? escapeXml(element.stroke) : "none"}" stroke-width="${element.pattern === "outline" ? Math.max(1, element.strokeWidth * .35) : 0}" font-family="Arial, sans-serif" font-size="${element.fontSize ?? 42}" font-weight="${element.fontWeight ?? 900}"${transform}>${escapeXml(element.text ?? "Texto")}</text>`;
}

export function compileManualAssetSvg(source: ManualAssetDocument) {
  const document = normalizeManualAssetDocument(source);
  const visibleElements = document.elements.filter((element) => element.visible !== false);
  const definitions = visibleElements.map(compilePattern).filter(Boolean).join("");
  const elements = visibleElements.map(compileElement).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${document.width} ${document.height}" role="img" aria-label="Asset SVG creado en Polyedro">${definitions ? `<defs>${definitions}</defs>` : ""}${elements}</svg>`;
}
